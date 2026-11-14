"use server";

import { refresh } from "next/cache";
import { auth } from "@/auth";
import {
  MOVEMENTS,
  type Movement,
  getLifterByEmail,
  recordEvent,
  saveLift,
  upsertProfile,
} from "@/lib/lifters";

const MIN_BODYWEIGHT = 30;
const MAX_BODYWEIGHT = 250;
const MAX_PULLUP_REPS = 100;

async function requireEmail(): Promise<string> {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) throw new Error("Not signed in");
  return email;
}

export async function saveProfileAction(formData: FormData) {
  const email = await requireEmail();

  const displayName = String(formData.get("displayName") ?? "").trim();
  const bodyweightKg = Number(formData.get("bodyweightKg"));

  if (displayName.length < 2 || displayName.length > 40) {
    throw new Error("Display name must be between 2 and 40 characters.");
  }
  if (
    !Number.isFinite(bodyweightKg) ||
    bodyweightKg < MIN_BODYWEIGHT ||
    bodyweightKg > MAX_BODYWEIGHT
  ) {
    throw new Error(
      `Bodyweight must be between ${MIN_BODYWEIGHT} and ${MAX_BODYWEIGHT} kg.`,
    );
  }

  const { id, isNew } = await upsertProfile(email, displayName, bodyweightKg);
  await recordEvent(isNew ? "profile_created" : "profile_updated", id);

  refresh();
}

export async function saveLiftAction(formData: FormData) {
  const email = await requireEmail();

  const lifter = await getLifterByEmail(email);
  if (!lifter) throw new Error("Set up your profile first.");

  const movementId = String(formData.get("movement") ?? "");
  const movement = MOVEMENTS.find((m) => m.id === movementId);
  if (!movement) throw new Error("Unknown movement.");

  const reps = Number(formData.get("reps"));
  if (!Number.isInteger(reps) || reps < 1) {
    throw new Error("Reps must be a whole number of at least 1.");
  }

  let weightKg: number | null = null;

  if (movement.id === "pullups") {
    if (reps > MAX_PULLUP_REPS) {
      throw new Error(`${MAX_PULLUP_REPS} pull-ups is the cap.`);
    }
  } else {
    weightKg = Number(formData.get("weightKg"));
    if (!Number.isFinite(weightKg) || weightKg <= 0) {
      throw new Error("Weight must be greater than zero.");
    }
    if (movement.maxKg !== null && weightKg > movement.maxKg) {
      throw new Error(
        `${weightKg}kg is above the ${movement.maxKg}kg cap for ${movement.label}.`,
      );
    }
    if (reps > 100) throw new Error("Reps must be 100 or fewer.");
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
}
