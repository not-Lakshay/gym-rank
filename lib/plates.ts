/**
 * Weight class to plate colour.
 *
 * Olympic plates are colour-coded by weight internationally: 10kg green,
 * 15kg yellow, 20kg blue, 25kg red. Mapping the classes onto them in
 * ascending order means the colour carries meaning rather than decorating —
 * a heavier class reads as a heavier plate.
 *
 * Two forms of each colour. The CSS variable is what the app uses, so a
 * palette change in globals.css reaches every screen. The literal hex is
 * for the OG image: satori renders outside the browser and cannot resolve
 * a custom property, so the card would silently lose its colour.
 */
const PLATE_BY_CLASS: Record<string, { cssVar: string; hex: string }> = {
  "Up to 65kg": { cssVar: "var(--plate-10)", hex: "#2e8b53" },
  "65-75kg": { cssVar: "var(--plate-15)", hex: "#e3b53b" },
  "75-85kg": { cssVar: "var(--plate-20)", hex: "#3f7cc9" },
  "85kg+": { cssVar: "var(--plate-25)", hex: "#d1434d" },
};

export function plateFor(weightClass: string): string {
  return PLATE_BY_CLASS[weightClass]?.cssVar ?? "var(--chalk-faint)";
}

export function plateHexFor(weightClass: string): string {
  return PLATE_BY_CLASS[weightClass]?.hex ?? "#6b6459";
}
