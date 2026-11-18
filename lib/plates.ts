/**
 * Weight class to its colour: indigo to ice, brighter for each heavier class
 * (--class-1 … --class-4 in globals.css), so the order reads at a glance,
 * colour-blind or not. These used to be the plate colours, whose order
 * only lifters who know the plate code could see. Plates keep theirs for
 * drawing a bar (PLATES below).
 *
 * Two forms of each colour. The CSS variable is what the app uses, so a
 * palette change in globals.css reaches every screen. The literal hex is
 * for the OG image: satori renders outside the browser and cannot resolve
 * a custom property, so the card would silently lose its colour.
 */
const PLATE_BY_CLASS: Record<string, { cssVar: string; hex: string }> = {
  // The hex is the default (Iron) theme's: a share card can't know which
  // theme its viewer picked.
  "Up to 65kg": { cssVar: "var(--class-1)", hex: "#8160eb" },
  "65-75kg": { cssVar: "var(--class-2)", hex: "#62a4f7" },
  "75-85kg": { cssVar: "var(--class-3)", hex: "#19e0f7" },
  "85kg+": { cssVar: "var(--class-4)", hex: "#daf2e6" },
};

export function plateFor(weightClass: string): string {
  return PLATE_BY_CLASS[weightClass]?.cssVar ?? "var(--chalk-faint)";
}

export function plateHexFor(weightClass: string): string {
  return PLATE_BY_CLASS[weightClass]?.hex ?? "#6b6459";
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
