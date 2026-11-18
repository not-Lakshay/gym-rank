/*
  The cartoon avatars a lifter can pick instead of their initials. The
  files are in public/avatars (credits in LICENSE.txt there); the id is
  what's stored on the lifter, so ids never change once shipped.
*/

export const PEOPLE = ["p1", "p2", "p3", "p4", "p5", "p6", "p7", "p8", "p9", "p10", "p11", "p12"];

export const ANIMALS = [
  "bear",
  "lion",
  "tiger",
  "panda",
  "wolf",
  "gorilla",
  "boar",
  "bison",
  "ox",
  "rhino",
  "eagle",
  "shark",
];

const ALL = new Set([...PEOPLE, ...ANIMALS]);

/** A picked avatar from a form, or null (initials) for anything not on the list. */
export function avatarFrom(raw: unknown): string | null {
  return typeof raw === "string" && ALL.has(raw) ? raw : null;
}

export const avatarSrc = (id: string) => `/avatars/${id}.svg`;

/** For screen readers: "Bear", or "Cartoon person 3". */
export function avatarLabel(id: string) {
  return id.startsWith("p") && PEOPLE.includes(id)
    ? `Cartoon person ${id.slice(1)}`
    : id[0].toUpperCase() + id.slice(1);
}
