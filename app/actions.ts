"use server";

import { refresh } from "next/cache";
import { auth, signIn, signOut } from "@/auth";
import { BATCH_COLLEGE, batchOptions } from "@/lib/batch";
import { collegeForEmail, getCollegeBySlug } from "@/lib/colleges";
import { getRankFor } from "@/lib/leaderboard";
import {
  MOVEMENTS,
  type Movement,
  UsernameTakenError,
  cosignLift,
  deleteLifter,
  getLifterByEmail,
  getLiftById,
  isUsernameTaken,
  recordEvent,
  saveLift,
  upsertProfile,
} from "@/lib/lifters";
import { sendWelcome } from "@/lib/mail";
import { notifyCosigned, notifyPassed } from "@/lib/notifications";
import { normalizeUsername, validateUsername } from "@/lib/username";
import { validateBodyweight, validateLift } from "@/lib/validate";

/**
 * Every action returns this instead of throwing. A thrown error inside a
 * server action surfaces as Next's error boundary — a crash screen — which
 * is the wrong response to someone typing 500 in a kilo box. The forms read
 * `error` via useActionState and show it next to the field.
 */
export type ActionState = { error: string | null; savedAt?: number };

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
async function quietly(work: () => Promise<void>): Promise<void> {
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

  let saved: { id: string; isNew: boolean };
  try {
    saved = await upsertProfile({
      email,
      username,
      displayName,
      bodyweightKg,
      collegeId: college.id,
      batchYear,
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

  refresh();
  return ok();
}

export async function saveLiftAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const email = await requireEmail();
  if (!email) return fail("You are signed out. Sign in again.");

  const lifter = await getLifterByEmail(email);
  if (!lifter) return fail("Set up your profile first.");
  if (!lifter.college) return fail("Pick your college first.");

  const movementId = String(formData.get("movement") ?? "");
  const movement = MOVEMENTS.find((m) => m.id === movementId);
  if (!movement) return fail("Unknown movement.");

  const reps = Number(formData.get("reps"));
  const weightKg =
    movement.id === "pullups" ? null : Number(formData.get("weightKg"));

  // Same rules the home page calculator applies, from the same module.
  const liftError = validateLift({
    movement: movement.id as Movement,
    weightKg,
    reps,
    bodyweightKg: lifter.bodyweightKg,
  });
  if (liftError) return fail(liftError);

  const before = (await getRankFor(lifter.id))?.dots ?? null;

  await saveLift({
    lifterId: lifter.id,
    movement: movement.id as Movement,
    weightKg,
    reps,
    bodyweightKg: lifter.bodyweightKg,
  });
  await recordEvent(`lift_saved:${movement.id}`, lifter.id);

  const collegeId = lifter.college.id;
  await quietly(() =>
    notifyPassed({ lifterId: lifter.id, collegeId, dotsBefore: before }),
  );

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
  if (!done) return fail("Couldn't co-sign that lift.");

  await recordEvent("lift_cosigned", witness.id);
  await quietly(() =>
    notifyCosigned({
      lifterId: lift.lifterId,
      witnessId: witness.id,
      movement: lift.movement,
    }),
  );

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

  await signOut({ redirectTo: "/" });
  return ok();
}
