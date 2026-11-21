/**
 * Run:  node lib/cosign.test.ts
 */
import assert from "node:assert/strict";
import { cosignStatus, cosignText, isDisputed } from "./cosign.ts";

const a = { id: "a", name: "Sarthak" };
const b = { id: "b", name: "Ekagrah" };
const c = { id: "c", name: "Ayush" };

// One person saw all three: fully co-signed by them.
assert.deepEqual(cosignStatus([[a], [a], [a]]), { kind: "full", names: ["Sarthak"] });

// Two lifts by one person, the third by someone else: partially, both named.
const partial = cosignStatus([[a], [a], [b]]);
assert.deepEqual(partial, { kind: "partial", names: ["Sarthak", "Ekagrah"] });
assert.equal(cosignText(partial!), "Partially co-signed by Sarthak, Ekagrah");

// Someone who saw all three makes it full, even with extra witnesses around.
assert.deepEqual(cosignStatus([[a, b], [a], [a, c]]), { kind: "full", names: ["Sarthak"] });

// Any lift without a witness: no status at all.
assert.equal(cosignStatus([[a], [], [a]]), null);
assert.equal(cosignStatus([]), null);

// One doubter alone never disputes a lift.
assert.equal(isDisputed(0, 1), false);
// Two doubts, nobody vouching: disputed.
assert.equal(isDisputed(0, 2), true);
// Doubts must outnumber co-signs; a tie stays co-signed.
assert.equal(isDisputed(2, 2), false);
assert.equal(isDisputed(2, 3), true);
assert.equal(isDisputed(4, 3), false);

console.log("cosign: all passed");
