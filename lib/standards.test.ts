/**
 * Run:  node lib/standards.test.ts
 */
import assert from "node:assert/strict";
import { estimatedLift, noviceOneRepMax } from "./standards.ts";

assert.equal(noviceOneRepMax("squat", 70), 70);
assert.equal(noviceOneRepMax("bench", 70), 52.5);
assert.equal(noviceOneRepMax("deadlift", 70), 87.5);
// Rounds to a weight you can load on a bar: 0.75 x 73 = 54.75 -> 55.
assert.equal(noviceOneRepMax("bench", 73), 55);
// Optional lifts have no stand-in.
assert.equal(noviceOneRepMax("pullups", 70), null);
assert.equal(noviceOneRepMax("overhead_press", 70), null);

// Nothing else known: the bodyweight figure.
assert.deepEqual(estimatedLift("deadlift", 70, {}), { kg: 87.5, from: [] });
// Scaled from a known squat: 116.7 x 1.25 = 145.9 -> 145.
assert.deepEqual(estimatedLift("deadlift", 72, { squat: 116.7 }), { kg: 145, from: ["squat"] });
// Averaged over two: squat 100 -> 75, deadlift 160 -> 96; mean 85.5 -> 85.
assert.deepEqual(estimatedLift("bench", 80, { squat: 100, deadlift: 160 }), {
  kg: 85,
  from: ["squat", "deadlift"],
});
// Its own value and optional lifts don't count; zeros are ignored.
assert.deepEqual(estimatedLift("squat", 70, { squat: 200, overhead_press: 60, bench: 0 }), {
  kg: 70,
  from: [],
});
// Capped at the movement's plausibility limit (deadlift 450).
assert.equal(estimatedLift("deadlift", 70, { squat: 1000 })!.kg, 450);
assert.equal(estimatedLift("pullups", 70, { squat: 100 }), null);

console.log("standards: all passed");
