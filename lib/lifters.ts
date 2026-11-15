import { sql } from "./db";
import type { College } from "./colleges";
import { dotsScore, estimatedOneRepMax } from "./scoring";

export {
  MOVEMENTS,
  TOTAL_MOVEMENTS,
  type Movement,
} from "./movements";
import { TOTAL_MOVEMENTS, type Movement } from "./movements";

export type Lifter = {
  id: string;
  email: string;
  displayName: string;
  bodyweightKg: number;
  /** Null until they pick one; a lifter with no college is on no board. */
  college: College | null;
};

// A constant column list, not user input — the one case sql.unsafe is for.
const lifterColumns = sql.unsafe(`
  lf.id, lf.email, lf.display_name, lf.bodyweight_kg,
  c.id as college_id, c.slug as college_slug, c.name as college_name,
  c.short_name as college_short, c.city as college_city, c.state as college_state
`);

function lifterFromRow(row: Record<string, unknown>): Lifter {
  return {
    id: row.id as string,
    email: row.email as string,
    displayName: row.display_name as string,
    bodyweightKg: num(row.bodyweight_kg),
    college:
      row.college_id === null
        ? null
        : {
            id: Number(row.college_id),
            slug: row.college_slug as string,
            name: row.college_name as string,
            shortName: row.college_short as string,
            city: row.college_city as string,
            state: row.college_state as string,
          },
  };
}

export type Lift = {
  id: string;
  movement: Movement;
  weightKg: number | null;
  reps: number;
  est1rmKg: number | null;
  bodyweightKg: number;
  verified: boolean;
  /** Display name of whoever co-signed it, if anyone. */
  verifiedByName: string | null;
  /**
   * The est. 1RM (or reps, for pull-ups) of the entry this one replaced,
   * from lift_history. Null for a first entry.
   */
  previousValue: number | null;
};

/**
 * Postgres returns numeric columns as strings to avoid float precision
 * loss. Forgetting this gives you "110" + "90" = "11090" rather than 200,
 * so every numeric read goes through here.
 */
function num(value: unknown): number {
  return typeof value === "number" ? value : Number(value);
}

export async function getLifterByEmail(email: string): Promise<Lifter | null> {
  const rows = await sql`
    select ${lifterColumns}
    from lifters lf
    left join colleges c on c.id = lf.college_id
    where lf.email = ${email}
    limit 1
  `;
  return rows.length === 0 ? null : lifterFromRow(rows[0]);
}

export async function upsertProfile(
  email: string,
  displayName: string,
  bodyweightKg: number,
  collegeId: number,
): Promise<{ id: string; isNew: boolean }> {
  const rows = await sql`
    insert into lifters (email, display_name, bodyweight_kg, college_id)
    values (${email}, ${displayName}, ${bodyweightKg}, ${collegeId})
    on conflict (email) do update
      set display_name  = excluded.display_name,
          bodyweight_kg = excluded.bodyweight_kg,
          college_id    = excluded.college_id,
          updated_at    = now()
    returning id, (xmax = 0) as is_new
  `;
  return { id: rows[0].id as string, isNew: Boolean(rows[0].is_new) };
}

export async function getLiftById(liftId: string): Promise<{
  id: string;
  lifterId: string;
  movement: Movement;
  collegeId: number | null;
} | null> {
  const rows = await sql`
    select l.id, l.lifter_id, l.movement, lf.college_id
    from lifts l
    join lifters lf on lf.id = l.lifter_id
    where l.id = ${liftId}
    limit 1
  `;
  if (rows.length === 0) return null;
  return {
    id: rows[0].id as string,
    lifterId: rows[0].lifter_id as string,
    movement: rows[0].movement as Movement,
    collegeId: rows[0].college_id === null ? null : Number(rows[0].college_id),
  };
}

export async function getLifterById(id: string): Promise<Lifter | null> {
  const rows = await sql`
    select ${lifterColumns}
    from lifters lf
    left join colleges c on c.id = lf.college_id
    where lf.id = ${id}
    limit 1
  `;
  return rows.length === 0 ? null : lifterFromRow(rows[0]);
}

export async function getLiftsFor(lifterId: string): Promise<Lift[]> {
  // The lateral join pulls the entry this one replaced: the second-newest
  // history row for the same movement (the newest is the current lift
  // itself, since every save writes history too).
  const rows = await sql`
    select
      l.id, l.movement, l.weight_kg, l.reps, l.est_1rm_kg, l.bodyweight_kg,
      l.verified_by,
      v.display_name as verified_by_name,
      prev.est_1rm_kg as prev_est_1rm_kg,
      prev.reps       as prev_reps
    from lifts l
    left join lifters v on v.id = l.verified_by
    left join lateral (
      select est_1rm_kg, reps
      from lift_history h
      where h.lifter_id = l.lifter_id and h.movement = l.movement
      order by h.recorded_at desc, h.id desc
      offset 1 limit 1
    ) prev on true
    where l.lifter_id = ${lifterId}
  `;
  return rows.map((row) => {
    const movement = row.movement as Movement;
    const prevRaw =
      movement === "pullups" ? row.prev_reps : row.prev_est_1rm_kg;
    return {
      id: row.id as string,
      movement,
      weightKg: row.weight_kg === null ? null : num(row.weight_kg),
      reps: num(row.reps),
      est1rmKg: row.est_1rm_kg === null ? null : num(row.est_1rm_kg),
      bodyweightKg: num(row.bodyweight_kg),
      verified: row.verified_by !== null,
      verifiedByName: (row.verified_by_name as string | null) ?? null,
      previousValue: prevRaw === null || prevRaw === undefined ? null : num(prevRaw),
    };
  });
}

/**
 * Co-sign a lift. The witness must be a different lifter — self-attestation
 * is exactly the thing a verified column is meant to rule out. Returns
 * false if the lift doesn't exist or the witness is its owner.
 */
export async function cosignLift(
  liftId: string,
  witnessId: string,
): Promise<boolean> {
  const rows = await sql`
    update lifts
    set verified_by = ${witnessId}
    where id = ${liftId} and lifter_id <> ${witnessId}
    returning id
  `;
  return rows.length > 0;
}

export async function saveLift(params: {
  lifterId: string;
  movement: Movement;
  weightKg: number | null;
  reps: number;
  bodyweightKg: number;
}): Promise<void> {
  const { lifterId, movement, weightKg, reps, bodyweightKg } = params;

  const est1rm =
    movement === "pullups" || weightKg === null
      ? null
      : estimatedOneRepMax(weightKg, reps);

  await sql`
    insert into lifts
      (lifter_id, movement, weight_kg, reps, est_1rm_kg, bodyweight_kg)
    values
      (${lifterId}, ${movement}, ${weightKg}, ${reps}, ${est1rm}, ${bodyweightKg})
    on conflict (lifter_id, movement) do update
      set weight_kg     = excluded.weight_kg,
          reps          = excluded.reps,
          est_1rm_kg    = excluded.est_1rm_kg,
          bodyweight_kg = excluded.bodyweight_kg,
          -- a changed lift is a new claim, so any previous co-sign is void
          verified_by   = null,
          recorded_at   = now()
  `;

  // Append-only. The Neon HTTP driver has no multi-statement transaction
  // here, so a crash between the two writes loses a history row, not the
  // lift — the acceptable direction to fail in.
  await sql`
    insert into lift_history
      (lifter_id, movement, weight_kg, reps, est_1rm_kg, bodyweight_kg)
    values
      (${lifterId}, ${movement}, ${weightKg}, ${reps}, ${est1rm}, ${bodyweightKg})
  `;
}

export async function recordEvent(
  name: string,
  lifterId: string | null = null,
): Promise<void> {
  // Never let analytics break a user action.
  try {
    await sql`insert into events (name, lifter_id) values (${name}, ${lifterId})`;
  } catch (err) {
    // Swallowed so a Neon hiccup can't fail a user's save — but logged,
    // because these events are the funnel numbers this project reports on
    // and a silent gap in them is worse than a noisy one.
    console.error("recordEvent failed", name, err);
  }
}

export type Summary = {
  totalKg: number | null;
  dots: number | null;
  missingForTotal: Movement[];
};

/**
 * DOTS is defined on the squat+bench+deadlift total, so the overall score
 * only exists once all three are entered. Partial entries still show their
 * own per-lift numbers.
 */
export function summarise(lifts: Lift[], bodyweightKg: number): Summary {
  const byMovement = new Map(lifts.map((l) => [l.movement, l]));
  const missingForTotal = TOTAL_MOVEMENTS.filter((m) => !byMovement.has(m));

  if (missingForTotal.length > 0) {
    return { totalKg: null, dots: null, missingForTotal };
  }

  const totalKg = TOTAL_MOVEMENTS.reduce(
    (sum, m) => sum + (byMovement.get(m)?.est1rmKg ?? 0),
    0,
  );

  return {
    totalKg,
    dots: dotsScore(totalKg, bodyweightKg),
    missingForTotal: [],
  };
}
