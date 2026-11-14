import { sql } from "./db";
import { dotsScore, estimatedOneRepMax } from "./scoring";

/**
 * The five ranked movements.
 *
 * maxKg is a plausibility cap, not a world record — it exists so a joke
 * entry can't poison the leaderboard. A board nobody believes is a board
 * nobody opens twice.
 */
export const MOVEMENTS = [
  { id: "squat", label: "Squat", maxKg: 400 },
  { id: "bench", label: "Bench press", maxKg: 300 },
  { id: "deadlift", label: "Deadlift", maxKg: 450 },
  { id: "overhead_press", label: "Overhead press", maxKg: 220 },
  { id: "pullups", label: "Pull-ups", maxKg: null },
] as const;

export type Movement = (typeof MOVEMENTS)[number]["id"];

// The squat/bench/deadlift total is what DOTS is actually defined on.
const TOTAL_MOVEMENTS: Movement[] = ["squat", "bench", "deadlift"];

export type Lifter = {
  id: string;
  email: string;
  displayName: string;
  bodyweightKg: number;
};

export type Lift = {
  movement: Movement;
  weightKg: number | null;
  reps: number;
  est1rmKg: number | null;
  bodyweightKg: number;
  verified: boolean;
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
    select id, email, display_name, bodyweight_kg
    from lifters
    where email = ${email}
    limit 1
  `;
  if (rows.length === 0) return null;
  const row = rows[0];
  return {
    id: row.id as string,
    email: row.email as string,
    displayName: row.display_name as string,
    bodyweightKg: num(row.bodyweight_kg),
  };
}

export async function upsertProfile(
  email: string,
  displayName: string,
  bodyweightKg: number,
): Promise<{ id: string; isNew: boolean }> {
  const rows = await sql`
    insert into lifters (email, display_name, bodyweight_kg)
    values (${email}, ${displayName}, ${bodyweightKg})
    on conflict (email) do update
      set display_name  = excluded.display_name,
          bodyweight_kg = excluded.bodyweight_kg,
          updated_at    = now()
    returning id, (xmax = 0) as is_new
  `;
  return { id: rows[0].id as string, isNew: Boolean(rows[0].is_new) };
}

export async function getLiftsFor(lifterId: string): Promise<Lift[]> {
  const rows = await sql`
    select movement, weight_kg, reps, est_1rm_kg, bodyweight_kg, verified_by
    from lifts
    where lifter_id = ${lifterId}
  `;
  return rows.map((row) => ({
    movement: row.movement as Movement,
    weightKg: row.weight_kg === null ? null : num(row.weight_kg),
    reps: num(row.reps),
    est1rmKg: row.est_1rm_kg === null ? null : num(row.est_1rm_kg),
    bodyweightKg: num(row.bodyweight_kg),
    verified: row.verified_by !== null,
  }));
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
}

export async function recordEvent(
  name: string,
  lifterId: string | null = null,
): Promise<void> {
  // Never let analytics break a user action.
  try {
    await sql`insert into events (name, lifter_id) values (${name}, ${lifterId})`;
  } catch {
    // swallowed deliberately
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
