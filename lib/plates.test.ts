/**
 * Run:  node lib/plates.test.ts
 */
import assert from "node:assert/strict";
import { platesPerSide } from "./plates.ts";

assert.deepEqual(platesPerSide(100), [25, 15]);
assert.deepEqual(platesPerSide(75), [25, 2.5]);
assert.deepEqual(platesPerSide(65), [20, 2.5]);
assert.deepEqual(platesPerSide(60), [20]);
assert.deepEqual(platesPerSide(140), [25, 25, 10]);
assert.deepEqual(platesPerSide(102.5), [25, 15, 1.25]);
// Not loadable with real plates: rounded to the nearest 2.5 kg.
assert.deepEqual(platesPerSide(72), [25, 1.25]);
// The bar alone, or lighter than it: no plates.
assert.deepEqual(platesPerSide(20), []);
assert.deepEqual(platesPerSide(15), []);

console.log("plates: ok");
