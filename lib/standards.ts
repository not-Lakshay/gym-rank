/*
  A typical one-rep max for someone who has never trained a lift, so a
  lifter who has never squatted (say) can still get a DOTS score.

  Novice-level strength standards, as multiples of bodyweight: roughly what
  an active, untrained man lifts after a few weeks of learning the lift.
  Commonly cited figures, not a measured study — good enough to stand in
  for a lift you have not done, and easy to beat once you do it.
*/
import { MOVEMENTS, type Movement } from "./movements.ts";

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

/**
 * A stand-in 1RM for a lift not done yet. Scaled from the lifter's other
 * squat/bench/deadlift 1RMs when there are any (a 150 kg squatter is no
 * beginner at deadlift), using the same ratios as the table; bodyweight
 * alone otherwise. `from` names the lifts it was scaled from, empty when
 * it's the bodyweight figure.
 */
export function estimatedLift(
  movement: Movement,
  bodyweightKg: number,
  known: Partial<Record<Movement, number>>,
): { kg: number; from: Movement[] } | null {
  const target = NOVICE_MULTIPLE[movement];
  if (target === undefined) return null;
  const from = (Object.keys(NOVICE_MULTIPLE) as Movement[]).filter(
    (m) => m !== movement && (known[m] ?? 0) > 0,
  );
  if (from.length === 0) {
    return { kg: noviceOneRepMax(movement, bodyweightKg)!, from };
  }
  // 0.9: a saved guess counts on the board like a real lift, so keep it a
  // little under what they'd likely pull, easy to beat once they do it.
  const raw =
    (0.9 * from.reduce((sum, m) => sum + (known[m]! * target) / NOVICE_MULTIPLE[m]!, 0)) /
    from.length;
  // Never past the plausibility cap, whatever was typed into the other rows,
  // and never "0 kg" while a tiny number is mid-typing in another row.
  const cap = MOVEMENTS.find((m) => m.id === movement)?.maxKg ?? Infinity;
  return { kg: Math.max(2.5, Math.min(Math.round(raw / 2.5) * 2.5, cap)), from };
}
