/**
 * Run:  node lib/cosign.test.ts
 */
import assert from "node:assert/strict";
import { cosignStatus, cosignText } from "./cosign.ts";

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

console.log("cosign: all passed");
