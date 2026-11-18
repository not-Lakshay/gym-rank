/**
 * Run:  node lib/format.test.ts
 */
import assert from "node:assert/strict";
import { initials } from "./format.ts";

assert.equal(initials("Lakshay Bhardwaj"), "LB");
assert.equal(initials("sarthak"), "S");
assert.equal(initials("  Paras   Gupta "), "PG");
// First and last word: middle names don't crowd the disc.
assert.equal(initials("Lakshay Kumar Bhardwaj"), "LB");
// Punctuation is skipped, accents kept.
assert.equal(initials("(ayush) raj"), "AR");
assert.equal(initials("Émile Zola"), "ÉZ");
// Never an empty disc.
assert.equal(initials(""), "?");
assert.equal(initials("!!"), "?");

console.log("format: ok");
