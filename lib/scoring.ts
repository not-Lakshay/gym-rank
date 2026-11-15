/**
 * Strength scoring.
 *
 * Two separate jobs:
 *   1. estimatedOneRepMax — turn a real working set (weight x reps) into a 1RM
 *   2. dotsScore          — adjust a lift for bodyweight so lifters of
 *                           different sizes are actually comparable
 */

export type Sex = "male" | "female";

/* ------------------------------------------------------------------ */
/* Estimated 1RM (Epley)                                               */
/* ------------------------------------------------------------------ */

/**
 * Epley: 1RM = w x (1 + reps / 30)
 *
 * We ask for weight x reps rather than a 1RM because almost nobody in a
 * college gym has tested a true single, and the ones who guess, guess high.
 *
 * Two corrections to the raw formula:
 *   - reps === 1 returns the weight unchanged. A single IS the 1RM; Epley
 *     is fitted for multi-rep sets and would inflate it by 3.3%.
 *   - reps are capped at 12. Past that, a set is limited by conditioning
 *     rather than maximal strength and the estimate degrades badly.
 */
export function estimatedOneRepMax(weightKg: number, reps: number): number {
  if (weightKg <= 0 || reps <= 0) return 0;
  if (reps === 1) return weightKg;

  const cappedReps = Math.min(reps, 12);
  return weightKg * (1 + cappedReps / 30);
}

/* ------------------------------------------------------------------ */
/* DOTS                                                                */
/* ------------------------------------------------------------------ */

// Published IPF DOTS coefficients (2019), P(x) = a + bx + cx^2 + dx^3 + ex^4.
// Verified against published worked examples — see scoring.test.mjs.
// Nothing calls this with "female" today — the first gym was male-only —
// but the coefficients stay so the maths is correct if that ever changes.
const DOTS_COEFFICIENTS: Record<Sex, [number, number, number, number, number]> = {
  male: [-307.75076, 24.0900756, -0.1918759221, 0.0007391293, -0.000001093],
  female: [-57.96288, 13.6175032, -0.1126655495, 0.0005158568, -0.0000010706],
};

// The polynomial is fitted on adult competitive bodyweights. Below the
// lower bound very light lifters get absurd scores; above the upper bound
// the polynomial approaches an asymptote.
const MIN_BODYWEIGHT_KG = 40;
const MAX_BODYWEIGHT_KG = 201.9;

/**
 * DOTS = liftedKg x 500 / P(bodyweightKg)
 *
 * Higher means stronger relative to size, so a 60kg lifter and a 90kg
 * lifter can be compared directly.
 *
 * Pass the squat+bench+deadlift total for an overall score, or a single
 * lift for a per-lift ranking.
 */
export function dotsScore(
  liftedKg: number,
  bodyweightKg: number,
  sex: Sex = "male",
): number {
  if (liftedKg <= 0 || bodyweightKg <= 0) return 0;

  const bw = Math.min(
    Math.max(bodyweightKg, MIN_BODYWEIGHT_KG),
    MAX_BODYWEIGHT_KG,
  );
  const [a, b, c, d, e] = DOTS_COEFFICIENTS[sex];
  const denominator = a + b * bw + c * bw ** 2 + d * bw ** 3 + e * bw ** 4;

  if (denominator <= 0) return 0;
  return (liftedKg * 500) / denominator;
}

/* ------------------------------------------------------------------ */
/* Weight classes                                                      */
/* ------------------------------------------------------------------ */

/**
 * Buckets for the per-class boards. Deliberately few: more classes means
 * more people top a board (good), but with ~40 lifters, too many classes
 * leaves each one nearly empty (bad).
 */
export const WEIGHT_CLASSES = [
  { label: "Up to 65kg", min: 0, max: 65 },
  { label: "65-75kg", min: 65, max: 75 },
  { label: "75-85kg", min: 75, max: 85 },
  { label: "85kg+", min: 85, max: Infinity },
] as const;

export function weightClassFor(bodyweightKg: number): string {
  const found = WEIGHT_CLASSES.find(
    (c) => bodyweightKg > c.min && bodyweightKg <= c.max,
  );
  return found?.label ?? WEIGHT_CLASSES[0].label;
}
