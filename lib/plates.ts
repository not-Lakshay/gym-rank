/**
 * Weight class to plate colour.
 *
 * Olympic plates are colour-coded by weight internationally: 10kg green,
 * 15kg yellow, 20kg blue, 25kg red. Mapping the classes onto them in
 * ascending order means the colour carries meaning rather than decorating —
 * a heavier class reads as a heavier plate.
 */
const PLATE_BY_CLASS: Record<string, string> = {
  "Up to 65kg": "var(--plate-10)",
  "65-75kg": "var(--plate-15)",
  "75-85kg": "var(--plate-20)",
  "85kg+": "var(--plate-25)",
};

export function plateFor(weightClass: string): string {
  return PLATE_BY_CLASS[weightClass] ?? "var(--chalk-faint)";
}
