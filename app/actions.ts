"use server";

import { refresh } from "next/cache";
import { auth, signIn, signOut } from "@/auth";
import { collegeForEmail, getCollegeBySlug } from "@/lib/colleges";
import { getRankFor } from "@/lib/leaderboard";
import {
  MOVEMENTS,
  type Movement,
  cosignLift,
  getLifterByEmail,
  getLiftById,
  recordEvent,
  saveLift,
  upsertProfile,
} from "@/lib/lifters";
import { notifyCosigned, notifyPassed } from "@/lib/notifications";
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

export async function saveProfileAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const email = await requireEmail();
  if (!email) return fail("You are signed out. Sign in again.");

  const displayName = String(formData.get("displayName") ?? "").trim();
  const bodyweightKg = Number(formData.get("bodyweightKg"));

  if (displayName.length < 2 || displayName.length > 40) {
    return fail("Display name must be between 2 and 40 characters.");
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

  // Bodyweight moves the score, so a profile edit can pass people too.
  const existing = await getLifterByEmail(email);
  const before = existing ? (await getRankFor(existing.id))?.dots ?? null : null;

  const { id, isNew } = await upsertProfile(
    email,
    displayName,
    bodyweightKg,
    college.id,
  );
  await recordEvent(isNew ? "profile_created" : "profile_updated", id);

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
