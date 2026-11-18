/**
 * Run:  node lib/plates.test.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { plateHexFor, platesPerSide } from "./plates.ts";

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

// The share card's hex copies must match the default theme's --class-N
// (the first definition in globals.css), or shared links drift.
const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
["Up to 65kg", "65-75kg", "75-85kg", "85kg+"].forEach((weightClass, i) => {
  const hex = css.match(new RegExp(`--class-${i + 1}:\\s*(#[0-9a-f]{6})`, "i"))?.[1];
  assert.equal(plateHexFor(weightClass), hex?.toLowerCase(), weightClass);
});

console.log("plates: ok");
