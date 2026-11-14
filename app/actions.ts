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

const MIN_BODYWEIGHT = 30;
const MAX_BODYWEIGHT = 250;
const MAX_PULLUP_REPS = 100;

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
  if (
    !Number.isFinite(bodyweightKg) ||
    bodyweightKg < MIN_BODYWEIGHT ||
    bodyweightKg > MAX_BODYWEIGHT
  ) {
    return fail(
      `Bodyweight must be between ${MIN_BODYWEIGHT} and ${MAX_BODYWEIGHT} kg.`,
    );
  }

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
  if (!Number.isInteger(reps) || reps < 1) {
    return fail("Reps must be a whole number of at least 1.");
  }

  let weightKg: number | null = null;

  if (movement.id === "pullups") {
    if (reps > MAX_PULLUP_REPS) {
      return fail(`${MAX_PULLUP_REPS} pull-ups is the cap.`);
    }
  } else {
    weightKg = Number(formData.get("weightKg"));
    if (!Number.isFinite(weightKg) || weightKg <= 0) {
      return fail("Weight must be greater than zero.");
    }
    if (movement.maxKg !== null && weightKg > movement.maxKg) {
      return fail(
        `${weightKg} kg is above the ${movement.maxKg} kg cap for ${movement.label.toLowerCase()}.`,
      );
    }
    if (reps > 100) return fail("Reps must be 100 or fewer.");
  }

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
