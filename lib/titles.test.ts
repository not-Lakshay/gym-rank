/**
 * Run:  node lib/titles.test.ts
 */
import assert from "node:assert/strict";
import { pickLiftTitles } from "./titles.ts";

const row = (id: string, collegeSlug: string) => ({ id, collegeSlug });

// The first row per college wins each lift; lists arrive best first.
assert.deepEqual(
  pickLiftTitles({
    squat: [row("a", "lnm"), row("b", "lnm"), row("c", "iitd")],
    bench: [row("b", "lnm"), row("a", "lnm")],
    deadlift: [],
  }),
  { a: ["squat"], c: ["squat"], b: ["bench"] },
);

// One lifter can hold several, listed squat, bench, deadlift.
assert.deepEqual(
  pickLiftTitles({
    deadlift: [row("a", "lnm")],
    squat: [row("a", "lnm")],
    bench: [row("a", "lnm")],
  }),
  { a: ["squat", "bench", "deadlift"] },
);

// Lifts outside the total never give a title; missing lists are fine.
assert.deepEqual(
  pickLiftTitles({ pullups: [row("a", "lnm")], overhead_press: [row("a", "lnm")] }),
  {},
);

console.log("titles: all passed");
