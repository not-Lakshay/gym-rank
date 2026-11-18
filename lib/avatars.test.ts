/**
 * Run:  node lib/avatars.test.ts
 */
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { ANIMALS, PEOPLE, avatarFrom, avatarLabel, avatarSrc } from "./avatars.ts";

assert.equal(avatarFrom("bear"), "bear");
assert.equal(avatarFrom("p7"), "p7");

// Anything else is initials: empty, unknown, a path, not a string.
assert.equal(avatarFrom(""), null);
assert.equal(avatarFrom("p13"), null);
assert.equal(avatarFrom("../secrets"), null);
assert.equal(avatarFrom(null), null);
assert.equal(avatarFrom(["bear"]), null);

assert.equal(avatarLabel("panda"), "Panda");
assert.equal(avatarLabel("p3"), "Cartoon person 3");

// Every id has its file, so no avatar can show up broken.
for (const id of [...PEOPLE, ...ANIMALS]) {
  assert.ok(existsSync(new URL(`../public${avatarSrc(id)}`, import.meta.url)), `missing ${id}`);
}

console.log("avatars: ok");
