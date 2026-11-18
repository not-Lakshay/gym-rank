/*
  The cartoon avatars a lifter can pick instead of their initials, in the
  sets the picker shows (a set's first three are its preview). The files
  are in public/avatars (credits in LICENSE.txt there). An id is what's
  stored on the lifter, so ids never change once shipped: add new ones,
  and only remove ones nobody has picked.
*/

export type AvatarSet = {
  label: string;
  avatars: { id: string; label: string }[];
};

// Ids prefix+n in the order given, labelled "Robot 1", "Robot 2", …
const pick = (prefix: string, numbers: number[], label: string) =>
  numbers.map((n, i) => ({ id: `${prefix}${n}`, label: `${label} ${i + 1}` }));

const range = (from: number, to: number) =>
  Array.from({ length: to - from + 1 }, (_, i) => from + i);

// "Bear" from "bear".
const named = (...ids: string[]) =>
  ids.map((id) => ({ id, label: id[0].toUpperCase() + id.slice(1) }));

const TONES = ["", "light", "medium-light", "medium", "medium-dark", "dark"];

export const AVATAR_SETS: AvatarSet[] = [
  {
    label: "Gym",
    avatars: [
      ...TONES.map((tone, i) => ({
        id: `lift${i}`,
        label: tone ? `Lifter, ${tone} skin tone` : "Lifter",
      })),
      { id: "lift6", label: "Man lifting weights" },
      { id: "biceps", label: "Flexed biceps" },
      { id: "robotarm", label: "Mechanical arm" },
      { id: "fire", label: "Fire" },
      { id: "bolt", label: "Lightning" },
      { id: "trophy", label: "Trophy" },
      { id: "medal", label: "Gold medal" },
    ],
  },
  {
    label: "Cartoon faces",
    avatars: pick("a", [...range(13, 31), 1, 3, 6, 7, 9, 12], "Cartoon face"),
  },
  {
    label: "Cool",
    avatars: [
      { id: "shades", label: "Sunglasses face" },
      ...named("ninja", "superhero"),
      { id: "beard", label: "Bearded man" },
      ...named("cowboy", "skull", "alien"),
      { id: "invader", label: "Space invader" },
      ...named("robot", "mage", "vampire", "zombie", "prince", "ogre", "goblin", "ghost"),
    ],
  },
  {
    label: "Animals",
    avatars: [
      ...named("bear", "lion", "tiger", "panda", "wolf", "gorilla", "boar", "bison"),
      ...named("ox", "rhino", "eagle", "shark", "elephant", "mammoth", "crocodile", "hippo"),
      { id: "buffalo", label: "Water buffalo" },
      ...named("fox", "owl", "horse", "unicorn", "dragon", "koala"),
      { id: "polarbear", label: "Polar bear" },
    ],
  },
  { label: "Voxel", avatars: pick("v", range(1, 12), "Voxel head") },
  {
    label: "Line art",
    avatars: pick("p", [...range(19, 32), ...range(7, 15), 17], "Line art"),
  },
  { label: "Aesthetic", avatars: pick("aes", range(1, 18), "Aesthetic") },
  {
    label: "Robots",
    avatars: [...range(1, 12).map((n) => `b${n}`), ...range(1, 6).map((n) => `rb${n}`)].map(
      (id, i) => ({ id, label: `Robot ${i + 1}` }),
    ),
  },
  { label: "Doodles", avatars: pick("o", [1, 2, 5, 7, 9, 12], "Doodle") },
  { label: "Pixel", avatars: pick("px", [1, 2, 3, 6, 10, 11, 12], "Pixel face") },
  { label: "Critters", avatars: pick("c", range(1, 12), "Critter") },
];

const LABELS = new Map(
  AVATAR_SETS.flatMap((set) => set.avatars.map((a) => [a.id, a.label] as const)),
);

/** A picked avatar from a form, or null (initials) for anything not on the list. */
export function avatarFrom(raw: unknown): string | null {
  return typeof raw === "string" && LABELS.has(raw) ? raw : null;
}

export const avatarSrc = (id: string) => `/avatars/${id}.svg`;

/** For screen readers: "Bear", "Robot 3", "Lifter, dark skin tone". */
export const avatarLabel = (id: string) => LABELS.get(id) ?? id;
