import { MOVEMENTS, type Movement } from "./movements";
import { estimatedOneRepMax } from "./scoring";

/*
  Every plausibility rule, in one client-safe place.

  Two code paths take lifts: the server action, and the try-it calculator
  on the home page. They were drifting — the calculator put min/max on its
  inputs, which only constrain native form submission and do nothing at all
  for an input that is read with onChange. So the board had server-side
  rules and the preview had none.

  These are plausibility caps, not world records. The job is to keep typos
  and jokes off the board, not to adjudicate. Someone determined to lie
  plausibly still can — that is what co-signing is for.
*/

export const MIN_BODYWEIGHT = 30;
export const MAX_BODYWEIGHT = 250;

/**
 * Epley is fitted to low-rep work and degrades badly past a dozen reps.
 * lib/scoring.ts caps its input at 12, so a 26-rep set would otherwise be
 * scored as a 12-rep set — a number the lifter never entered. Rejecting is
 * more honest than silently rewriting the input.
 */
export const MAX_SCORED_REPS = 12;

export const MAX_PULLUP_REPS = 100;

/**
 * No human has pulled five times their bodyweight. This is the check that
 * catches the entries the per-lift caps miss: 300 kg is legitimate for a
 * heavyweight and absurd for someone who weighs 45 kg.
 */
export const MAX_BODYWEIGHT_MULTIPLE = 5;

export function validateBodyweight(bodyweightKg: number): string | null {
  if (!Number.isFinite(bodyweightKg)) return "Enter your bodyweight in kg.";
  if (bodyweightKg < MIN_BODYWEIGHT || bodyweightKg > MAX_BODYWEIGHT) {
    return `Bodyweight must be between ${MIN_BODYWEIGHT} and ${MAX_BODYWEIGHT} kg.`;
  }
  return null;
}

export function validateLift(params: {
  movement: Movement;
  weightKg: number | null;
  reps: number;
  bodyweightKg: number;
}): string | null {
  const { movement, weightKg, reps, bodyweightKg } = params;

  const spec = MOVEMENTS.find((m) => m.id === movement);
  if (!spec) return "Unknown movement.";

  if (!Number.isInteger(reps) || reps < 1) {
    return "Reps must be a whole number, at least 1.";
  }

  if (movement === "pullups") {
    if (reps > MAX_PULLUP_REPS) return `${MAX_PULLUP_REPS} pull-ups is the cap.`;
    return null;
  }

  if (!Number.isFinite(weightKg) || weightKg === null || weightKg <= 0) {
    return "Weight must be greater than zero.";
  }

  if (spec.maxKg !== null && weightKg > spec.maxKg) {
    return `${weightKg} kg is above the ${spec.maxKg} kg cap for ${spec.label.toLowerCase()}.`;
  }

  if (reps > MAX_SCORED_REPS) {
    return `A one-rep max can only be estimated up to ${MAX_SCORED_REPS} reps. Enter a heavier set for fewer reps.`;
  }

  // Only meaningful once bodyweight itself is sane, or the ratio is noise.
  if (validateBodyweight(bodyweightKg) === null) {
    const multiple = estimatedOneRepMax(weightKg, reps) / bodyweightKg;
    if (multiple > MAX_BODYWEIGHT_MULTIPLE) {
      return `That estimates to ${multiple.toFixed(1)}× your bodyweight. Check the weight and reps.`;
    }
  }

  return null;
}

/** A v4-ish UUID. Used to reject junk ids before they reach Postgres. */
export function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}
