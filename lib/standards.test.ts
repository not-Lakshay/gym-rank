/**
 * Run:  node lib/standards.test.ts
 */
import assert from "node:assert/strict";
import { noviceOneRepMax } from "./standards.ts";

assert.equal(noviceOneRepMax("squat", 70), 70);
assert.equal(noviceOneRepMax("bench", 70), 52.5);
assert.equal(noviceOneRepMax("deadlift", 70), 87.5);
// Rounds to a weight you can load on a bar: 0.75 x 73 = 54.75 -> 55.
assert.equal(noviceOneRepMax("bench", 73), 55);
// Optional lifts have no stand-in.
assert.equal(noviceOneRepMax("pullups", 70), null);
assert.equal(noviceOneRepMax("overhead_press", 70), null);

console.log("standards: all passed");
