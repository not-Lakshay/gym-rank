/**
 * Run:  node lib/validate.test.ts
 */
import assert from "node:assert/strict";
import { liftChanges } from "./validate.ts";

const form = (fields: Record<string, string>) => (name: string) => fields[name] ?? "";
const stored = [{ movement: "squat" as const, weightKg: 100, reps: 5 }];

// Only what changed: the unchanged squat is skipped so it keeps its co-signs.
assert.deepEqual(
  liftChanges(form({ "squat.kg": "100", "squat.reps": "5", "bench.kg": "60", "bench.reps": "8" }), stored, 75),
  { changes: [{ movement: "bench", weightKg: 60, reps: 8 }] },
);

// Blank optional rows are fine; pull-ups need only reps.
assert.deepEqual(liftChanges(form({ "pullups.reps": "10" }), [], 75), {
  changes: [{ movement: "pullups", weightKg: null, reps: 10 }],
});

// A half-filled row fails the whole form and names the lift.
assert.deepEqual(liftChanges(form({ "deadlift.kg": "120" }), [], 75), {
  error: "Deadlift: enter both the weight and the reps.",
});

// An invalid row fails too, before anything is saved.
const bad = liftChanges(form({ "bench.kg": "60", "bench.reps": "8", "squat.kg": "100", "squat.reps": "40" }), [], 75);
assert.ok("error" in bad && bad.error.startsWith("Squat:"));

console.log("validate: all passed");
