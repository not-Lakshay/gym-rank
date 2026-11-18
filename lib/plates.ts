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
  "Up to 65kg": { cssVar: "var(--plate-10)", hex: "#29f08a" },
  "65-75kg": { cssVar: "var(--plate-15)", hex: "#ffe03a" },
  "75-85kg": { cssVar: "var(--plate-20)", hex: "#3d9cff" },
  "85kg+": { cssVar: "var(--plate-25)", hex: "#ff3d5e" },
};

export function plateFor(weightClass: string): string {
  return PLATE_BY_CLASS[weightClass]?.cssVar ?? "var(--chalk-faint)";
}

export function plateHexFor(weightClass: string): string {
  return PLATE_BY_CLASS[weightClass]?.hex ?? "#7f7f88";
}

/*
  The plates themselves, for drawing a loaded bar (app/barbell.tsx).
  Heaviest first, which is also the order they go on. The four big ones
  are full height; change plates are smaller, as they are in a gym.
*/
export const PLATES = [
  { kg: 25, color: "var(--plate-25)", width: 7, height: 1 },
  { kg: 20, color: "var(--plate-20)", width: 6, height: 1 },
  { kg: 15, color: "var(--plate-15)", width: 5, height: 1 },
  { kg: 10, color: "var(--plate-10)", width: 4, height: 1 },
  { kg: 5, color: "var(--chalk)", width: 4, height: 0.66 },
  { kg: 2.5, color: "var(--chalk-dim)", width: 3, height: 0.5 },
  { kg: 1.25, color: "var(--chalk-dim)", width: 2, height: 0.4 },
] as const;

export const BAR_KG = 20;

/**
 * The plates on one side of a 20 kg bar loaded to this weight, heaviest
 * first. Rounded to the nearest 2.5 kg (1.25 a side, the smallest plate),
 * so 72 kg is drawn as 72.5; nothing under the empty bar.
 */
export function platesPerSide(kg: number): number[] {
  let left = Math.round(Math.max(0, kg - BAR_KG) / 2 / 1.25) * 1.25;
  const out: number[] = [];
  for (const plate of PLATES) {
    while (left >= plate.kg) {
      out.push(plate.kg);
      left -= plate.kg;
    }
  }
  return out;
}
