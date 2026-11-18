/**
 * Run:  node lib/avatars.test.ts
 */
import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import { AVATAR_SETS, avatarFrom, avatarLabel } from "./avatars.ts";

const ids = AVATAR_SETS.flatMap((set) => set.avatars.map((a) => a.id));
assert.equal(new Set(ids).size, ids.length, "avatar ids are unique");

// Ids already saved on lifters keep working (p11 is picked in production).
for (const id of ["p11", "bear", "lion", "tiger", "rhino", "shark", "lift5", "px12"]) {
  assert.equal(avatarFrom(id), id);
}
assert.equal(avatarFrom("ninja"), "ninja");
assert.equal(avatarFrom("aes18"), "aes18");

// Anything else is initials: empty, unknown, removed, a path, not a string.
assert.equal(avatarFrom(""), null);
assert.equal(avatarFrom("p33"), null);
assert.equal(avatarFrom("l1"), null);
assert.equal(avatarFrom("../secrets"), null);
assert.equal(avatarFrom(null), null);
assert.equal(avatarFrom(["bear"]), null);

assert.equal(avatarLabel("panda"), "Panda");
assert.equal(avatarLabel("b3"), "Robot 3");
assert.equal(avatarLabel("lift5"), "Lifter, dark skin tone");

// Every id has its file and every file has an id: nothing shows up broken,
// and nothing is shipped that can't be picked.
const files = readdirSync(new URL("../public/avatars", import.meta.url))
  .filter((f) => f.endsWith(".svg"))
  .map((f) => f.slice(0, -4));
assert.deepEqual([...files].sort(), [...ids].sort());

console.log(`avatars: ok (${ids.length} in ${AVATAR_SETS.length} sets)`);
