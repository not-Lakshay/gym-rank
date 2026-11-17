/*
  A typical one-rep max for someone who has never trained a lift, so a
  lifter who has never squatted (say) can still get a DOTS score.

  Novice-level strength standards, as multiples of bodyweight: roughly what
  an active, untrained man lifts after a few weeks of learning the lift.
  Commonly cited figures, not a measured study — good enough to stand in
  for a lift you have not done, and easy to beat once you do it.
*/
import type { Movement } from "./movements";

// shortcut: male ratios only, matching the male-only DOTS in lib/scoring.ts;
// add female ratios when the app scores women.
const NOVICE_MULTIPLE: Partial<Record<Movement, number>> = {
  squat: 1.0,
  bench: 0.75,
  deadlift: 1.25,
};

/** The bodyweights the table lists, in kg. */
export const STANDARD_BODYWEIGHTS = [50, 60, 70, 80, 90, 100];

/** Typical novice 1RM in kg, rounded to a loadable 2.5 kg. Null for lifts without a standard. */
export function noviceOneRepMax(movement: Movement, bodyweightKg: number): number | null {
  const multiple = NOVICE_MULTIPLE[movement];
  if (multiple === undefined) return null;
  return Math.round((bodyweightKg * multiple) / 2.5) * 2.5;
}
