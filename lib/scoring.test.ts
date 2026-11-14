/**
 * Tests for the scoring maths.
 *
 * Run:  node lib/scoring.test.ts
 * (older Node:  node --experimental-strip-types lib/scoring.test.ts)
 *
 * The DOTS expectations are published worked examples, not numbers this
 * code produced. A test that only checks the code agrees with itself
 * proves nothing.
 */

import { estimatedOneRepMax, dotsScore, weightClassFor } from "./scoring.ts";

let failures = 0;

function check(label: string, got: number | string, want: number | string, tol = 0.01) {
  const ok =
    typeof got === "number" && typeof want === "number"
      ? Math.abs(got - want) <= tol
      : got === want;
  if (!ok) failures++;
  const shown = typeof got === "number" ? got.toFixed(2) : got;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}: got ${shown}, want ${want}`);
}

console.log("--- DOTS vs published worked examples ---");
// A 90kg man totalling 600kg scores 387.96 DOTS.
check("600kg total @ 90kg male", dotsScore(600, 90, "male"), 387.96);
// A 60kg woman totalling 320kg scores 354.73 DOTS.
check("320kg total @ 60kg female", dotsScore(320, 60, "female"), 354.73);

console.log("\n--- DOTS behaviour ---");
check("zero lift scores zero", dotsScore(0, 80), 0);
check("zero bodyweight scores zero", dotsScore(100, 0), 0);
// Below 40kg the polynomial misbehaves, so bodyweight is clamped.
check(
  "very light lifter is clamped",
  dotsScore(100, 20),
  dotsScore(100, 40),
);

console.log("\n--- estimated 1RM (Epley) ---");
check("a single is the 1RM", estimatedOneRepMax(100, 1), 100);
check("100kg x 5", estimatedOneRepMax(100, 5), 116.67);
check("100kg x 10", estimatedOneRepMax(100, 10), 133.33);
check("reps capped at 12", estimatedOneRepMax(100, 30), estimatedOneRepMax(100, 12));
check("zero weight", estimatedOneRepMax(0, 5), 0);
check("zero reps", estimatedOneRepMax(100, 0), 0);

console.log("\n--- weight classes ---");
check("60kg", weightClassFor(60), "Up to 65kg");
check("65kg sits in the lower class", weightClassFor(65), "Up to 65kg");
check("65.5kg", weightClassFor(65.5), "65-75kg");
check("87kg", weightClassFor(87), "85kg+");

console.log(
  failures === 0 ? "\nAll checks passed." : `\n${failures} FAILURE(S)`,
);
process.exit(failures === 0 ? 0 : 1);
