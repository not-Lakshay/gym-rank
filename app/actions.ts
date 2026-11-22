"use server";

import { refresh, updateTag } from "next/cache";
import { DATA_TAG } from "@/lib/cached";
import { auth, signIn, signOut } from "@/auth";
import { avatarFrom } from "@/lib/avatars";
import { BATCH_COLLEGE, batchOptions } from "@/lib/batch";
import { collegeForEmail, getCollegeBySlug } from "@/lib/colleges";
import { getRankFor } from "@/lib/leaderboard";
import {
  MOVEMENTS,
  UsernameTakenError,
  bestsFor,
  clearCosignsFor,
  cosignLift,
  deleteLifter,
  doubtLift,
  getLifterByEmail,
  getLiftById,
  getLiftsFor,
  isUsernameTaken,
  recordEvent,
  removeLift,
  saveLift,
  undoubtLift,
  upsertProfile,
} from "@/lib/lifters";
import { sendWelcome } from "@/lib/mail";
import type { Movement } from "@/lib/movements";
import {
  notifyCosigned,
  notifyDoubted,
  notifyFriend,
  notifyPassed,
  notifyTitleChances,
} from "@/lib/notifications";
import {
  acceptRequest,
  cancelRequest,
  declineRequest,
  removeFriend,
  requestFriend,
} from "@/lib/friends";
import { normalizeUsername, validateUsername } from "@/lib/username";
import { isUuid, liftChanges, recordsBroken, validateBodyweight, validateLift } from "@/lib/validate";

/**
 * Every action returns this instead of throwing. A thrown error inside a
 * server action surfaces as Next's error boundary — a crash screen — which
 * is the wrong response to someone typing 500 in a kilo box. The forms read
 * `error` via useActionState and show it next to the field.
 */
export type ActionState = {
  error: string | null;
  savedAt?: number;
  /** After saving lifts: the ones that beat their best-ever entry. */
  prs?: Movement[];
  /** After saving lifts: who on the college board you just went past. */
  passed?: string[];
};

const ok = (): ActionState => ({ error: null, savedAt: Date.now() });
const fail = (error: string): ActionState => ({ error });

// Module-level rather than inline closures in the pages: an inline
// "use server" action gets its closure encrypted with random bytes at
// render time, which trips the prerender on routes with cacheComponents.
export async function signInAction(formData: FormData): Promise<void> {
  const raw = String(formData.get("redirectTo") ?? "/me");
  const redirectTo = raw.startsWith("/") && !raw.startsWith("//") ? raw : "/me";
  await signIn("google", { redirectTo });
}

export async function signOutAction(): Promise<void> {
  await signOut({ redirectTo: "/" });
}

async function requireEmail(): Promise<string | null> {
  const session = await auth();
  return session?.user?.email ?? null;
}

/**
 * Notifications are a side effect of a save, never a reason for one to
 * fail. A Neon hiccup while working out who got passed must not turn a
 * saved lift into an error message.
 */
async function quietly(work: () => Promise<unknown>): Promise<void> {
  try {
    await work();
  } catch (err) {
    console.error("notification failed", err);
  }
}

/**
 * Live availability for the username field. Returns the message to show,
 * or null when the handle is valid and free. Your own current handle counts
 * as free, so editing your profile without changing it never complains.
 */
export async function checkUsernameAction(
  raw: string,
): Promise<{ ok: boolean; message: string }> {
  const username = normalizeUsername(raw);
  const error = validateUsername(username);
  if (error) return { ok: false, message: error };

  const email = await requireEmail();
  if (await isUsernameTaken(username, email)) {
    return { ok: false, message: `@${username} is taken.` };
  }
  return { ok: true, message: `@${username} is yours.` };
}

export async function saveProfileAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const email = await requireEmail();
  if (!email) return fail("You are signed out. Sign in again.");

  const displayName = String(formData.get("displayName") ?? "").trim();
  const username = normalizeUsername(String(formData.get("username") ?? ""));
  const bodyweightKg = Number(formData.get("bodyweightKg"));

  if (displayName.length < 2 || displayName.length > 40) {
    return fail("Display name must be between 2 and 40 characters.");
  }
  const usernameError = validateUsername(username);
  if (usernameError) return fail(`Username: ${usernameError}`);
  if (await isUsernameTaken(username, email)) {
    return fail(`@${username} is taken.`);
  }
  const bodyweightError = validateBodyweight(bodyweightKg);
  if (bodyweightError) return fail(bodyweightError);

  // An institute email decides the college; the form's value is ignored.
  // That is the only check the app has that someone is where they say.
  const detected = await collegeForEmail(email);
  const college =
    detected ??
    (await getCollegeBySlug(String(formData.get("collegeSlug") ?? "")));
  if (!college) return fail("Pick your college.");

  // Batch is LNMIIT-only and optional; anything else, or a year outside
  // the current batches, is dropped rather than trusted.
  const rawBatch = Number(formData.get("batchYear"));
  const batchYear =
    college.slug === BATCH_COLLEGE && batchOptions().includes(rawBatch) ? rawBatch : null;

  // Bodyweight moves the score, so a profile edit can pass people too.
  const existing = await getLifterByEmail(email);
  const before = existing ? (await getRankFor(existing.id))?.dots ?? null : null;

  // Only ids on the list are kept; "" means initials. A form from before
  // the picker existed sends nothing, and that keeps what they had.
  const rawAvatar = formData.get("avatar");
  const avatar = rawAvatar === null ? existing?.avatar ?? null : avatarFrom(rawAvatar);

  // The board scores with the profile bodyweight, so changing it changes
  // every score: re-check the lifts against it, and void co-signs, or a
  // co-signed lifter could drop 20 kg on paper and keep their global spot.
  // Compared to 2 decimals, as numeric(5,2) stores it.
  const bodyweightChanged =
    !!existing && Math.round(existing.bodyweightKg * 100) !== Math.round(bodyweightKg * 100);
  if (existing && bodyweightChanged) {
    for (const lift of await getLiftsFor(existing.id)) {
      const error = validateLift({ ...lift, bodyweightKg });
      const label = MOVEMENTS.find((m) => m.id === lift.movement)?.label ?? lift.movement;
      if (error) return fail(`${label}: ${error} Update it before changing your bodyweight.`);
    }
  }

  // Moving college voids co-signs from the old one. Cleared before the
  // move is written, as saveLift does: a crash in between loses co-signs,
  // never carries them to a board where nobody watched.
  if (existing && existing.college?.id !== college.id) {
    await clearCosignsFor(existing.id);
  } else if (existing && bodyweightChanged) {
    await clearCosignsFor(existing.id, true);
  }

  let saved: { id: string; isNew: boolean };
  try {
    saved = await upsertProfile({
      email,
      username,
      displayName,
      bodyweightKg,
      collegeId: college.id,
      batchYear,
      avatar,
    });
  } catch (err) {
    if (err instanceof UsernameTakenError) return fail(`@${username} is taken.`);
    throw err;
  }
  const { id, isNew } = saved;
  await recordEvent(isNew ? "profile_created" : "profile_updated", id);

  // The one email the app sends, on the first save only. Awaited inside
  // quietly() so a Brevo outage can't fail the save, but not deferred:
  // a serverless function may be frozen the moment the response goes out.
  if (isNew) {
    await quietly(() =>
      sendWelcome({
        email,
        displayName,
        username,
        collegeShort: college.shortName,
      }),
    );
  }

  if (!isNew && existing?.college?.id === college.id) {
    await quietly(() =>
      notifyPassed({ lifterId: id, collegeId: college.id, dotsBefore: before }),
    );
  }
  // A new bodyweight or a move reorders lift tabs: here, and where they left.
  if (!isNew) {
    await quietly(() => notifyTitleChances(college.id));
    const left = existing?.college?.id;
    if (left && left !== college.id) await quietly(() => notifyTitleChances(left));
  }

  updateTag(DATA_TAG);
  refresh();
  return ok();
}

/**
 * Saves every lift on the form at once. Fields are named `<movement>.kg`
 * and `<movement>.reps`. A blank row is skipped (the optional lifts), and
 * so is a row that matches what is stored: re-saving an unchanged lift
 * would void its co-signs for nothing. Every row is checked before any is
 * written, so one typo saves nothing rather than half the form.
 */
export async function saveLiftsAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const email = await requireEmail();
  if (!email) return fail("You are signed out. Sign in again.");

  const lifter = await getLifterByEmail(email);
  if (!lifter) return fail("Set up your profile first.");
  if (!lifter.college) return fail("Pick your college first.");

  const parsed = liftChanges(
    (name) => String(formData.get(name) ?? ""),
    await getLiftsFor(lifter.id),
    lifter.bodyweightKg,
  );
  if ("error" in parsed) return fail(parsed.error);
  const { changes } = parsed;
  if (changes.length === 0) return ok();

  const collegeId = lifter.college.id;
  // Read before writing: the score to compare against, and the records a
  // new entry has to beat to count as a PR. The PR check is decoration, so
  // a failed read means no stamp, never a failed save.
  const [card, bests] = await Promise.all([
    getRankFor(lifter.id, collegeId),
    bestsFor(lifter.id).catch(() => ({})),
  ]);
  const before = card?.dots ?? null;

  for (const change of changes) {
    await saveLift({ lifterId: lifter.id, ...change, bodyweightKg: lifter.bodyweightKg });
    await recordEvent(`lift_saved:${change.movement}`, lifter.id);
  }

  let passed: string[] = [];
  await quietly(async () => {
    passed = await notifyPassed({ lifterId: lifter.id, collegeId, dotsBefore: before });
  });
  await quietly(() => notifyTitleChances(collegeId));

  updateTag(DATA_TAG);
  refresh();
  return { ...ok(), prs: recordsBroken(changes, bests), passed };
}

/**
 * Remove one of your own lifts. Only ever your own: the lifter comes from
 * the session, never the form. Without squat, bench and deadlift there is
 * no total, so removing one also takes you off the board until re-entered.
 */
export async function removeLiftAction(
  // Bound by the button (removeLiftAction.bind(null, id)). Reading it from
  // the submitting button's name/value lost it, and every removal failed.
  movementId: string,
  _prev: ActionState,
): Promise<ActionState> {
  const email = await requireEmail();
  if (!email) return fail("You are signed out. Sign in again.");
  const lifter = await getLifterByEmail(email);
  if (!lifter) return fail("Set up your profile first.");

  // Still checked: a bound argument comes from the client like any other.
  const movement = MOVEMENTS.find((m) => m.id === movementId);
  if (!movement) return fail("Unknown movement.");

  if (!(await removeLift(lifter.id, movement.id))) {
    return fail(`No ${movement.label.toLowerCase()} to remove.`);
  }
  await recordEvent(`lift_removed:${movement.id}`, lifter.id);

  updateTag(DATA_TAG);
  refresh();
  return ok();
}

/**
 * Co-sign someone else's lift. The server re-checks that the witness is a
 * different lifter at the same college; hiding the button on your own page
 * is not security.
 */
export async function cosignLiftAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const email = await requireEmail();
  if (!email) return fail("Sign in to co-sign.");

  const witness = await getLifterByEmail(email);
  if (!witness) return fail("Set up your own profile before co-signing.");

  const liftId = String(formData.get("liftId") ?? "");
  const lift = await getLiftById(liftId);
  if (!lift) return fail("That lift no longer exists.");
  if (lift.lifterId === witness.id) {
    return fail("You can't co-sign your own lift.");
  }
  // A co-sign means "I was in the room". Across colleges it means nothing.
  if (!witness.college || lift.collegeId !== witness.college.id) {
    return fail("Co-signs come from lifters at the same college.");
  }

  const done = await cosignLift(liftId, witness.id);
  // The owner and same-college checks passed above, so a no-op insert
  // means this witness is already on the lift.
  if (!done) return fail("You've already co-signed this lift.");

  await recordEvent("lift_cosigned", witness.id);
  await quietly(() =>
    notifyCosigned({
      lifterId: lift.lifterId,
      witnessId: witness.id,
      movement: lift.movement,
    }),
  );

  updateTag(DATA_TAG);
  refresh();
  return ok();
}

/**
 * Doubt someone's lift, or take a doubt back (`undo`). Same server checks
 * as a co-sign. Only the admin sees doubts; the lifter gets one anonymous
 * nudge on the first.
 */
export async function doubtLiftAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const email = await requireEmail();
  if (!email) return fail("Sign in first.");

  const doubter = await getLifterByEmail(email);
  if (!doubter) return fail("Set up your own profile first.");

  const liftId = String(formData.get("liftId") ?? "");
  if (formData.get("undo")) {
    await undoubtLift(liftId, doubter.id);
    updateTag(DATA_TAG); // profiles show the doubt count
    refresh();
    return ok();
  }

  const lift = await getLiftById(liftId);
  if (!lift) return fail("That lift no longer exists.");
  if (lift.lifterId === doubter.id) return fail("That's your own lift.");
  if (!doubter.college || lift.collegeId !== doubter.college.id) {
    return fail("Only lifters at the same college can doubt a lift.");
  }

  const count = await doubtLift(liftId, doubter.id);
  if (count === null) return fail("Can't doubt this one: already doubted, co-signed by you, or reviewed.");

  await recordEvent("lift_doubted", doubter.id);
  if (count === 1) {
    await quietly(() => notifyDoubted({ lifterId: lift.lifterId, movement: lift.movement }));
  }

  updateTag(DATA_TAG);
  refresh();
  return ok();
}

/**
 * Self-service deletion. The privacy page promises it; making people email
 * for it would be the kind of thing a reviewer flags. Deletes the lifter
 * and, by cascade, their lifts, history and notifications; usage events
 * keep an anonymous row. Then signs them out.
 */
export async function deleteMyAccountAction(
  _prev: ActionState,
  _formData: FormData,
): Promise<ActionState> {
  const email = await requireEmail();
  if (!email) return fail("You are signed out.");
  const lifter = await getLifterByEmail(email);
  if (!lifter) return fail("No profile to delete.");

  await recordEvent("account_deleted", null);
  const done = await deleteLifter(lifter.id);
  if (!done) return fail("Couldn't delete the account. Email the address on the privacy page.");

  updateTag(DATA_TAG);
  await signOut({ redirectTo: "/" });
  return ok();
}

const FRIEND_INTENTS = ["request", "cancel", "accept", "decline", "remove"] as const;

/**
 * Every friend step, by `intent`: send a request, take it back, accept or
 * decline one sent to you, or unfriend. `friendId` is the other lifter.
 */
export async function friendAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const email = await requireEmail();
  if (!email) return fail("Sign in first.");
  const me = await getLifterByEmail(email);
  if (!me) return fail("Set up your own profile first.");

  const friendId = String(formData.get("friendId") ?? "");
  const intent = String(formData.get("intent") ?? "");
  if (!isUuid(friendId)) return fail("No such lifter.");
  if (friendId === me.id) return fail("That's you.");
  if (!(FRIEND_INTENTS as readonly string[]).includes(intent)) return fail("Unknown action.");

  if (intent === "request") {
    const result = await requestFriend(me.id, friendId);
    if (result === "sent") {
      await recordEvent("friend_requested", me.id);
      await quietly(() => notifyFriend({ lifterId: friendId, actorId: me.id, kind: "friend_request" }));
    } else if (result === "accepted") {
      await recordEvent("friend_accepted", me.id);
      await quietly(() => notifyFriend({ lifterId: friendId, actorId: me.id, kind: "friend_accepted" }));
    }
  } else if (intent === "accept") {
    if (!(await acceptRequest(me.id, friendId))) return fail("That request is gone.");
    await recordEvent("friend_accepted", me.id);
    await quietly(() => notifyFriend({ lifterId: friendId, actorId: me.id, kind: "friend_accepted" }));
  } else if (intent === "decline") {
    await declineRequest(me.id, friendId);
  } else if (intent === "cancel") {
    await cancelRequest(me.id, friendId);
  } else {
    await removeFriend(me.id, friendId);
  }

  updateTag(DATA_TAG); // Friends boards are cached
  refresh();
  return ok();
}
