import { TOTAL_MOVEMENTS, type Movement } from "./movements.ts";

/*
  Lift titles: "#1 squat", "#1 bench", "#1 deadlift", one holder per lift
  per college. Pure (no database), so it's tested on its own.

  The input is every lift at every college, co-signed or not, each list
  sorted best first, ranked exactly like the lift tabs. The title belongs
  to a college's first row, and only once that lift is co-signed: a weak
  lift that happens to be co-signed must never outrank a stronger one that
  isn't yet. Until the real #1 is co-signed, nobody holds it.
*/

type Row = { id: string; collegeSlug: string; verified: boolean };

/** Lifter id → the lifts they hold the title for (in squat, bench, deadlift order). */
export function pickLiftTitles(
  boards: Partial<Record<Movement, Row[]>>,
): Record<string, Movement[]> {
  const titles: Record<string, Movement[]> = {};
  for (const movement of TOTAL_MOVEMENTS) {
    const seen = new Set<string>();
    for (const row of boards[movement] ?? []) {
      if (seen.has(row.collegeSlug)) continue;
      seen.add(row.collegeSlug);
      if (row.verified) (titles[row.id] ??= []).push(movement);
    }
  }
  return titles;
}

/**
 * The other side of pickLiftTitles: lifts at the top of their college's
 * tab that hold no title yet because nobody co-signed them. Same input.
 */
export function unclaimedTitles(
  boards: Partial<Record<Movement, Row[]>>,
): { id: string; movement: Movement }[] {
  const out: { id: string; movement: Movement }[] = [];
  for (const movement of TOTAL_MOVEMENTS) {
    const seen = new Set<string>();
    for (const row of boards[movement] ?? []) {
      if (seen.has(row.collegeSlug)) continue;
      seen.add(row.collegeSlug);
      if (!row.verified) out.push({ id: row.id, movement });
    }
  }
  return out;
}

export const LIFT_TITLE_LABEL: Record<Movement, string> = {
  squat: "#1 squat",
  bench: "#1 bench",
  deadlift: "#1 deadlift",
  overhead_press: "#1 overhead press",
  pullups: "#1 pull-ups",
};
