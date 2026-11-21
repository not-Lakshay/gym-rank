import { cache } from "react";
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
  /** The handle: unique, lowercase, what /u/… and @mentions key on. */
  username: string;
  displayName: string;
  bodyweightKg: number;
  /** Null until they pick one; a lifter with no college is on no board. */
  college: College | null;
  /** LNMIIT only: the year they joined (2024 = Y24). Null otherwise. */
  batchYear: number | null;
  /** A cartoon avatar id (lib/avatars.ts); null shows their initials. */
  avatar: string | null;
};

// A constant column list, not user input — the one case sql.unsafe is for.
const lifterColumns = sql.unsafe(`
  lf.id, lf.email, lf.username, lf.display_name, lf.bodyweight_kg, lf.batch_year, lf.avatar,
  c.id as college_id, c.slug as college_slug, c.name as college_name,
  c.short_name as college_short, c.city as college_city, c.state as college_state
`);

function lifterFromRow(row: Record<string, unknown>): Lifter {
  return {
    id: row.id as string,
    email: row.email as string,
    username: row.username as string,
    displayName: row.display_name as string,
    bodyweightKg: num(row.bodyweight_kg),
    batchYear: row.batch_year === null ? null : Number(row.batch_year),
    avatar: (row.avatar as string | null) ?? null,
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
  /** At least one co-sign. */
  verified: boolean;
  /** Everyone who co-signed it, first co-sign first. */
  cosigners: { id: string; name: string }[];
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

// Cached per request: a page's metadata and body both look this up.
export const getLifterByUsername = cache(getLifterByUsernameUncached);

async function getLifterByUsernameUncached(
  username: string,
): Promise<Lifter | null> {
  const rows = await sql`
    select ${lifterColumns}
    from lifters lf
    left join colleges c on c.id = lf.college_id
    where lower(lf.username) = ${username.toLowerCase()}
    limit 1
  `;
  return rows.length === 0 ? null : lifterFromRow(rows[0]);
}

/** Is this handle used by anyone other than `exceptEmail`'s own account? */
export async function isUsernameTaken(
  username: string,
  exceptEmail: string | null = null,
): Promise<boolean> {
  const rows = await sql`
    select 1 from lifters
    where lower(username) = ${username.toLowerCase()}
      and (${exceptEmail}::text is null or email <> ${exceptEmail}::text)
    limit 1
  `;
  return rows.length > 0;
}

/**
 * Throws UsernameTakenError when the unique index rejects the handle — the
 * action checks first, but two people can pass the check at once and only
 * the index is the truth.
 */
export class UsernameTakenError extends Error {}

export async function upsertProfile(params: {
  email: string;
  username: string;
  displayName: string;
  bodyweightKg: number;
  collegeId: number;
  batchYear: number | null;
  avatar: string | null;
}): Promise<{ id: string; isNew: boolean }> {
  const { email, username, displayName, bodyweightKg, collegeId, batchYear, avatar } = params;
  try {
    const rows = await sql`
      insert into lifters (email, username, display_name, bodyweight_kg, college_id, batch_year, avatar)
      values (${email}, ${username}, ${displayName}, ${bodyweightKg}, ${collegeId}, ${batchYear}, ${avatar})
      on conflict (email) do update
        set username      = excluded.username,
            display_name  = excluded.display_name,
            bodyweight_kg = excluded.bodyweight_kg,
            college_id    = excluded.college_id,
            batch_year    = excluded.batch_year,
            avatar        = excluded.avatar,
            updated_at    = now()
      returning id, (xmax = 0) as is_new
    `;
    return { id: rows[0].id as string, isNew: Boolean(rows[0].is_new) };
  } catch (err) {
    const code = (err as { code?: string }).code;
    const constraint = (err as { constraint?: string }).constraint ?? "";
    if (code === "23505" && constraint.includes("username")) {
      throw new UsernameTakenError();
    }
    throw err;
  }
}

/**
 * Voids every co-sign on this lifter's lifts. A co-sign means "someone at
 * your college watched", so it can't follow a lifter to another college.
 */
export async function clearCosignsFor(lifterId: string): Promise<void> {
  await sql`
    delete from lift_cosigns
    where lift_id in (select id from lifts where lifter_id = ${lifterId})
  `;
  // Doubts are "I'm at your gym and don't buy it": void elsewhere too.
  await sql`
    delete from lift_doubts
    where lift_id in (select id from lifts where lifter_id = ${lifterId})
  `;
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
      coalesce((
        select json_agg(json_build_object('id', w.id, 'name', w.display_name)
                        order by c.created_at)
        from lift_cosigns c
        join lifters w on w.id = c.witness_id
        where c.lift_id = l.id
      ), '[]'::json) as cosigners,
      prev.est_1rm_kg as prev_est_1rm_kg,
      prev.reps       as prev_reps
    from lifts l
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
    const cosigners = row.cosigners as { id: string; name: string }[];
    return {
      id: row.id as string,
      movement,
      weightKg: row.weight_kg === null ? null : num(row.weight_kg),
      reps: num(row.reps),
      est1rmKg: row.est_1rm_kg === null ? null : num(row.est_1rm_kg),
      bodyweightKg: num(row.bodyweight_kg),
      verified: cosigners.length > 0,
      cosigners,
      previousValue: prevRaw === null || prevRaw === undefined ? null : num(prevRaw),
    };
  });
}

/**
 * Each lift's best-ever entry from history: est. 1RM, or reps for
 * pull-ups. What a new entry has to beat to be a PR.
 */
export async function bestsFor(lifterId: string): Promise<Partial<Record<Movement, number>>> {
  const rows = await sql`
    select movement, max(est_1rm_kg) as best_kg, max(reps) as best_reps
    from lift_history
    where lifter_id = ${lifterId}
    group by movement
  `;
  return Object.fromEntries(
    rows.map((row) => [
      row.movement as Movement,
      num(row.movement === "pullups" ? row.best_reps : row.best_kg),
    ]),
  );
}

/**
 * Add a co-sign to a lift. Any number of witnesses can co-sign one lift,
 * but the same witness only once, and never the lift's owner —
 * self-attestation is exactly what a co-sign is meant to rule out.
 * Returns false if nothing was added: the lift is gone, the witness owns
 * it, or they have already co-signed it.
 */
export async function cosignLift(
  liftId: string,
  witnessId: string,
): Promise<boolean> {
  const rows = await sql`
    insert into lift_cosigns (lift_id, witness_id)
    select id, ${witnessId}::uuid from lifts
    where id = ${liftId} and lifter_id <> ${witnessId}::uuid
    on conflict do nothing
    returning lift_id
  `;
  // Someone who watched it outweighs anyone who doubts it.
  if (rows.length > 0) await sql`delete from lift_doubts where lift_id = ${liftId}`;
  return rows.length > 0;
}

/**
 * Doubt a lift. Same rules as a co-sign (not your own, once each), plus:
 * not one you co-signed, and not one an admin has already reviewed.
 * Returns the lift's doubt count after adding, or null if nothing was added.
 */
export async function doubtLift(liftId: string, doubterId: string): Promise<number | null> {
  const rows = await sql`
    insert into lift_doubts (lift_id, doubter_id)
    select id, ${doubterId}::uuid from lifts
    where id = ${liftId} and lifter_id <> ${doubterId}::uuid
      and doubts_dismissed_at is null
      and not exists (
        select 1 from lift_cosigns c
        where c.lift_id = ${liftId} and c.witness_id = ${doubterId}::uuid
      )
    on conflict do nothing
    returning lift_id
  `;
  if (rows.length === 0) return null;
  const [r] = await sql`select count(*) as n from lift_doubts where lift_id = ${liftId}`;
  return Number(r.n);
}

/** Take a doubt back. Returns false if there was none. */
export async function undoubtLift(liftId: string, doubterId: string): Promise<boolean> {
  const rows = await sql`
    delete from lift_doubts where lift_id = ${liftId} and doubter_id = ${doubterId}
    returning lift_id
  `;
  return rows.length > 0;
}

/** Which of this lifter's lifts the viewer doubts. Only ever the viewer's own. */
export async function doubtedBy(viewerId: string, lifterId: string): Promise<Set<string>> {
  const rows = await sql`
    select d.lift_id from lift_doubts d
    join lifts l on l.id = d.lift_id
    where d.doubter_id = ${viewerId} and l.lifter_id = ${lifterId}
  `;
  return new Set(rows.map((r) => r.lift_id as string));
}

/**
 * A lifter removing one of their own lifts. Its co-signs go with it (the
 * foreign key cascades); lift_history keeps the old entry, so a later
 * re-entry still shows its change. Returns false if there was nothing.
 */
export async function removeLift(lifterId: string, movement: Movement): Promise<boolean> {
  const rows = await sql`
    delete from lifts where lifter_id = ${lifterId} and movement = ${movement}
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

  // A changed lift is a new claim, so every previous co-sign is void.
  // Cleared BEFORE the new number is written: no transaction here, and a
  // crash in between should lose co-signs on the old number, never leave
  // them standing on a new one nobody witnessed.
  await sql`
    delete from lift_cosigns
    where lift_id = (
      select id from lifts where lifter_id = ${lifterId} and movement = ${movement}
    )
  `;
  // A new number is a new claim to doubt, too.
  await sql`
    delete from lift_doubts
    where lift_id = (
      select id from lifts where lifter_id = ${lifterId} and movement = ${movement}
    )
  `;

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
          recorded_at   = now(),
          doubts_dismissed_at = null
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

/* ------------------------------------------------------------------------
   Admin reads and writes. Authorisation happens in the action, not here.
   ------------------------------------------------------------------------ */

export type AdminLifter = {
  id: string;
  username: string;
  displayName: string;
  email: string;
  bodyweightKg: number;
  collegeShort: string | null;
  liftCount: number;
  verifiedCount: number;
  createdAt: Date;
};

export async function adminListLifters(): Promise<AdminLifter[]> {
  const rows = await sql`
    select
      lf.id, lf.username, lf.display_name, lf.email, lf.bodyweight_kg,
      lf.created_at, c.short_name as college_short,
      (select count(*) from lifts l where l.lifter_id = lf.id) as lift_count,
      (select count(*) from lifts l where l.lifter_id = lf.id
         and exists (select 1 from lift_cosigns c where c.lift_id = l.id)) as verified_count
    from lifters lf
    left join colleges c on c.id = lf.college_id
    order by lf.created_at desc
  `;
  return rows.map((r) => ({
    id: r.id as string,
    username: r.username as string,
    displayName: r.display_name as string,
    email: r.email as string,
    bodyweightKg: num(r.bodyweight_kg),
    collegeShort: (r.college_short as string | null) ?? null,
    liftCount: Number(r.lift_count),
    verifiedCount: Number(r.verified_count),
    createdAt: new Date(r.created_at as string),
  }));
}

/** Everything about one lifter: the privacy page promises this exists.
 *  Used by the owner (self-service) and by admin. */
export async function deleteLifter(lifterId: string): Promise<boolean> {
  // Cascades cover lifts, history, notifications; events keep the row
  // with lifter_id nulled so the usage numbers stay honest.
  const rows = await sql`delete from lifters where id = ${lifterId} returning id`;
  return rows.length > 0;
}

export async function adminDeleteLift(liftId: string): Promise<boolean> {
  const rows = await sql`delete from lifts where id = ${liftId} returning id`;
  return rows.length > 0;
}

/** Clears every co-sign on the lift. */
export async function adminClearCosign(liftId: string): Promise<boolean> {
  const rows = await sql`
    delete from lift_cosigns where lift_id = ${liftId} returning lift_id
  `;
  return rows.length > 0;
}

export type DoubtedLift = {
  id: string;
  movement: Movement;
  weightKg: number | null;
  reps: number;
  est1rmKg: number | null;
  bodyweightKg: number;
  lifterId: string;
  username: string;
  displayName: string;
  doubters: string[];
  cosigners: string[];
};

/** Lifts with open doubts, most doubted first. */
export async function adminDoubtedLifts(): Promise<DoubtedLift[]> {
  const rows = await sql`
    select l.id, l.movement, l.weight_kg, l.reps, l.est_1rm_kg, l.bodyweight_kg,
           lf.id as lifter_id, lf.username, lf.display_name,
           array(select w.display_name from lift_doubts d join lifters w on w.id = d.doubter_id
                 where d.lift_id = l.id order by d.created_at) as doubters,
           array(select w.display_name from lift_cosigns c join lifters w on w.id = c.witness_id
                 where c.lift_id = l.id order by c.created_at) as cosigners
    from lifts l
    join lifters lf on lf.id = l.lifter_id
    where exists (select 1 from lift_doubts d where d.lift_id = l.id)
    order by (select count(*) from lift_doubts d where d.lift_id = l.id) desc
  `;
  return rows.map((r) => ({
    id: r.id as string,
    movement: r.movement as Movement,
    weightKg: r.weight_kg === null ? null : num(r.weight_kg),
    reps: num(r.reps),
    est1rmKg: r.est_1rm_kg === null ? null : num(r.est_1rm_kg),
    bodyweightKg: num(r.bodyweight_kg),
    lifterId: r.lifter_id as string,
    username: r.username as string,
    displayName: r.display_name as string,
    doubters: r.doubters as string[],
    cosigners: r.cosigners as string[],
  }));
}

/** Reviewed and kept: clear the doubts and block new ones until a re-save. */
export async function adminDismissDoubts(liftId: string): Promise<boolean> {
  const rows = await sql`
    update lifts set doubts_dismissed_at = now() where id = ${liftId} returning id
  `;
  await sql`delete from lift_doubts where lift_id = ${liftId}`;
  return rows.length > 0;
}

export type AdminStats = {
  lifters: number;
  withTotal: number;
  colleges: number;
  cosigns: number;
  signupsLast7: number;
  liftsSavedLast7: number;
};

export async function adminStats(): Promise<AdminStats> {
  const [r] = await sql`
    select
      (select count(*) from lifters) as lifters,
      (select count(*) from (
        select lifter_id from lifts
        where movement in ('squat','bench','deadlift')
        group by lifter_id having count(*) = 3
      ) t) as with_total,
      (select count(distinct college_id) from lifters where college_id is not null) as colleges,
      (select count(*) from lift_cosigns) as cosigns,
      (select count(*) from events where name = 'profile_created'
         and created_at > now() - interval '7 days') as signups_7,
      (select count(*) from events where name like 'lift_saved:%'
         and created_at > now() - interval '7 days') as lifts_7
  `;
  return {
    lifters: Number(r.lifters),
    withTotal: Number(r.with_total),
    colleges: Number(r.colleges),
    cosigns: Number(r.cosigns),
    signupsLast7: Number(r.signups_7),
    liftsSavedLast7: Number(r.lifts_7),
  };
}
