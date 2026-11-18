/**
 * Run:  node lib/tryout.test.ts
 */
import assert from "node:assert/strict";
import { parseTryout } from "./tryout.ts";

const tried = {
  bodyweight: "72",
  squat: { kg: "100", reps: "5" },
  bench: { kg: "70", reps: "3" },
  deadlift: { kg: "140", reps: "1" },
};
assert.deepEqual(parseTryout(JSON.stringify(tried)), tried);

// Nothing saved, or not ours: no prefill.
assert.equal(parseTryout(null), null);
assert.equal(parseTryout("not json"), null);
assert.equal(parseTryout("null"), null);
assert.equal(parseTryout("42"), null);

// Wrong shapes become empty boxes, never "[object Object]" in an input.
assert.deepEqual(parseTryout(JSON.stringify({ bodyweight: 72, squat: "x", bench: null })), {
  bodyweight: "",
  squat: { kg: "", reps: "" },
  bench: { kg: "", reps: "" },
  deadlift: { kg: "", reps: "" },
});

// Long strings are cut short.
assert.equal(parseTryout(JSON.stringify({ bodyweight: "1".repeat(50) }))!.bodyweight, "11111111");

console.log("tryout: ok");
