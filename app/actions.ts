"use server";

import { refresh } from "next/cache";
import { auth } from "@/auth";
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

async function requireEmail(): Promise<string | null> {
  const session = await auth();
  return session?.user?.email ?? null;
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

  const { id, isNew } = await upsertProfile(email, displayName, bodyweightKg);
  await recordEvent(isNew ? "profile_created" : "profile_updated", id);

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

  await saveLift({
    lifterId: lifter.id,
    movement: movement.id as Movement,
    weightKg,
    reps,
    bodyweightKg: lifter.bodyweightKg,
  });
  await recordEvent(`lift_saved:${movement.id}`, lifter.id);

  refresh();
  return ok();
}

/**
 * Co-sign someone else's lift. The server re-checks that the witness is a
 * different lifter; hiding the button on your own page is not security.
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

  const done = await cosignLift(liftId, witness.id);
  if (!done) return fail("Couldn't co-sign that lift.");

  await recordEvent("lift_cosigned", witness.id);
  refresh();
  return ok();
}
