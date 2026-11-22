import { TOTAL_MOVEMENTS, type Movement } from "./movements.ts";

/*
  Lift titles: "#1 squat", "#1 bench", "#1 deadlift", one holder per lift
  per college. Pure (no database), so it's tested on its own.

  The input is the global lift boards: only co-signed, non-disputed lifts,
  each list already sorted best first, ranked exactly like the lift tabs.
  So the holder at a college is simply that college's first row. Self-
  reported numbers nobody vouched for can't win a glowing title.
*/

type Row = { id: string; collegeSlug: string };

/** Lifter id → the lifts they hold the title for (in squat, bench, deadlift order). */
export function pickLiftTitles(
  boards: Partial<Record<Movement, Row[]>>,
): Record<string, Movement[]> {
  const titles: Record<string, Movement[]> = {};
  for (const movement of TOTAL_MOVEMENTS) {
    const taken = new Set<string>();
    for (const row of boards[movement] ?? []) {
      if (taken.has(row.collegeSlug)) continue;
      taken.add(row.collegeSlug);
      (titles[row.id] ??= []).push(movement);
    }
  }
  return titles;
}

export const LIFT_TITLE_LABEL: Record<Movement, string> = {
  squat: "#1 squat",
  bench: "#1 bench",
  deadlift: "#1 deadlift",
  overhead_press: "#1 overhead press",
  pullups: "#1 pull-ups",
};
