/**
 * Run:  node lib/batch.test.ts
 */
import assert from "node:assert/strict";
import { batchLabel, batchOptions, batchesFor, newestBatch } from "./batch.ts";

const nov2026 = new Date(2026, 10, 17);
const jul2026 = new Date(2026, 6, 31);
const aug2026 = new Date(2026, 7, 1);

// The semester starts in August: July still belongs to the old year.
assert.equal(newestBatch(jul2026), 2025);
assert.equal(newestBatch(aug2026), 2026);

assert.equal(batchLabel(2024), "Y24");
assert.equal(batchLabel(2005), "Y05");
// Five batches: a fifth-year dual-degree student (Y22) can still pick theirs.
assert.deepEqual(batchOptions(nov2026), [2026, 2025, 2024, 2023, 2022]);
assert.deepEqual(batchesFor(2024), [2023, 2024, 2025]);
assert.deepEqual(batchesFor(null), []);

console.log("batch: all passed");
