/*
  The cartoon avatars a lifter can pick instead of their initials, in the
  sets the picker shows. The files are in public/avatars (credits in
  LICENSE.txt there). An id is what's stored on the lifter, so ids never
  change once shipped: add new ones, don't rename old ones.
*/

export type AvatarSet = {
  label: string;
  avatars: { id: string; label: string }[];
};

// "Robot 1" … "Robot 12", with ids b1 … b12.
const numbered = (prefix: string, count: number, label: string) =>
  Array.from({ length: count }, (_, i) => ({ id: `${prefix}${i + 1}`, label: `${label} ${i + 1}` }));

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
      { id: "biceps", label: "Flexed biceps" },
      { id: "robotarm", label: "Mechanical arm" },
      { id: "fire", label: "Fire" },
      { id: "bolt", label: "Lightning" },
      { id: "trophy", label: "Trophy" },
      { id: "medal", label: "Gold medal" },
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
  { label: "Line art", avatars: numbered("p", 18, "Line art") },
  { label: "Cartoon faces", avatars: numbered("a", 12, "Cartoon face") },
  { label: "Portraits", avatars: numbered("l", 12, "Portrait") },
  { label: "Doodles", avatars: numbered("o", 12, "Doodle") },
  { label: "Critters", avatars: numbered("c", 12, "Critter") },
  { label: "Pixel", avatars: numbered("px", 12, "Pixel face") },
  { label: "Robots", avatars: numbered("b", 12, "Robot") },
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
