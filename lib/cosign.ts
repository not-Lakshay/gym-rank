/*
  How a lifter's total reads once every lift in it is co-signed.

  "Fully" co-signed: one person witnessed all three lifts — someone can
  vouch for the whole total. "Partially": every lift has a witness, but no
  single person saw them all. Both put you on the global board; the label
  says how strong the vouching is.
*/

export type CosignStatus =
  | { kind: "full"; names: string[] }
  | { kind: "partial"; names: string[] }
  | null;

type Witness = { id: string; name: string };

/**
 * `perLift` is the witnesses of each lift in the total (squat, bench,
 * deadlift). Null unless every one has at least one.
 */
export function cosignStatus(perLift: Witness[][]): CosignStatus {
  if (perLift.length === 0 || perLift.some((w) => w.length === 0)) return null;

  const all = new Map<string, string>();
  for (const witnesses of perLift) for (const w of witnesses) all.set(w.id, w.name);

  const full = [...all.keys()].filter((id) =>
    perLift.every((witnesses) => witnesses.some((w) => w.id === id)),
  );
  return full.length > 0
    ? { kind: "full", names: full.map((id) => all.get(id)!) }
    : { kind: "partial", names: [...all.values()] };
}

/*
  Gym-mates settle a doubted lift by count, no admin needed: at least two
  doubts from the last 30 days, and more of them than co-signs. A disputed
  lift stops counting as co-signed (so the lifter leaves the global board)
  but keeps its college-board score. More co-signs or a re-save clear it.
  Mirrored in SQL in lib/leaderboard.ts and lib/lifters.ts.
*/
export function isDisputed(cosigns: number, doubts: number): boolean {
  return doubts >= 2 && doubts > cosigns;
}

export function cosignText(status: NonNullable<CosignStatus>): string {
  return `${status.kind === "full" ? "Fully" : "Partially"} co-signed by ${status.names.join(", ")}`;
}
