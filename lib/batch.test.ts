/**
 * Run:  node lib/batch.test.ts
 */
import assert from "node:assert/strict";
import { batchLabel, batchOptions, batchText, batchesFor, newestBatch, yearOfStudy } from "./batch.ts";

const nov2026 = new Date(2026, 10, 17);
const jul2026 = new Date(2026, 6, 31);
const aug2026 = new Date(2026, 7, 1);

// The semester starts in August: July still belongs to the old year.
assert.equal(newestBatch(jul2026), 2025);
assert.equal(newestBatch(aug2026), 2026);

// The worked example: joined Aug 2024, third year in Nov 2026.
assert.equal(yearOfStudy(2024, nov2026), 3);
assert.equal(batchText(2024, nov2026), "Y24 · 3rd year");
assert.equal(yearOfStudy(2024, jul2026), 2);

assert.equal(batchLabel(2005), "Y05");
assert.deepEqual(batchOptions(nov2026), [2026, 2025, 2024, 2023]);
assert.deepEqual(batchesFor(2024), [2023, 2024, 2025]);
assert.deepEqual(batchesFor(null), []);
assert.equal(batchText(2022, nov2026), "Y22"); // graduated: no year shown

console.log("batch: all passed");
