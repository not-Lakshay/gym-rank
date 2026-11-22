/**
 * Run:  node lib/titles.test.ts
 */
import assert from "node:assert/strict";
import { pickLiftTitles } from "./titles.ts";

const row = (id: string, collegeSlug: string, verified = true) => ({ id, collegeSlug, verified });

// The first row per college wins each lift; lists arrive best first.
assert.deepEqual(
  pickLiftTitles({
    squat: [row("a", "lnm"), row("b", "lnm"), row("c", "iitd")],
    bench: [row("b", "lnm"), row("a", "lnm")],
    deadlift: [],
  }),
  { a: ["squat"], c: ["squat"], b: ["bench"] },
);

// The real #1 isn't co-signed: nobody gets it, not the best co-signed lift
// below them (a 40 kg co-signed bench must not beat an 87 kg one).
assert.deepEqual(
  pickLiftTitles({
    bench: [row("strong", "lnm", false), row("weak", "lnm", true), row("x", "iitd", true)],
  }),
  { x: ["bench"] },
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
