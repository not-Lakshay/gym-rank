import {
  type CosignStatus,
  MOST_TRUSTED_MIN,
  type TrustTier,
  cosignStatus,
  trustTier,
} from "./cosign";
import { sql } from "./db";
import type { Movement } from "./movements";

export type MostTrusted = { lifterId: string; collegeId: number; witnesses: number };

/**
 * "Most trusted" at each college: the lifter whose squat, bench and
 * deadlift were co-signed by the most different people (disputed lifts
 * left out, as in isDisputed), at least MOST_TRUSTED_MIN of them. A tie
 * goes to whoever reached that count first, so the title can't flicker.
 */
export async function getMostTrusted(): Promise<MostTrusted[]> {
  const rows = await sql`
    with w as (
      select lf.id as lifter_id, lf.college_id, x.witness_id,
             min(x.created_at) as first_at
      from lifters lf
      join lifts l on l.lifter_id = lf.id
      join lift_cosigns x on x.lift_id = l.id
      cross join lateral (
        select
          (select count(*) from lift_cosigns c where c.lift_id = l.id) as cosigns,
          (select count(*) from lift_doubts d
           where d.lift_id = l.id and d.created_at > now() - interval '30 days') as doubts
      ) n
      where lf.college_id is not null
        and l.movement in ('squat', 'bench', 'deadlift')
        and not (n.doubts >= 2 and n.doubts > n.cosigns)
      group by lf.id, lf.college_id, x.witness_id
    ),
    per as (
      select lifter_id, college_id, count(*) as witnesses, max(first_at) as reached_at
      from w
      group by lifter_id, college_id
    )
    select distinct on (college_id) lifter_id, college_id, witnesses
    from per
    where witnesses >= ${MOST_TRUSTED_MIN}
    order by college_id, witnesses desc, reached_at asc
  `;
  return rows.map((r) => ({
    lifterId: r.lifter_id as string,
    collegeId: Number(r.college_id),
    witnesses: Number(r.witnesses),
  }));
}

export type BoardRow = {
  id: string;
  username: string;
  displayName: string;
  weightClass: string;
  totalKg: number;
  dots: number;
  verifiedCount: number;
  overallRank: number;
  classRank: number;
  collegeSlug: string;
  collegeShort: string;
  /** LNMIIT only; see lib/batch.ts. */
  batchYear: number | null;
  /** Fully or partially co-signed, once all three lifts are; see lib/cosign.ts. */
  cosign: CosignStatus;
  /** A cartoon avatar id (lib/avatars.ts); null shows their initials. */
  avatar: string | null;
  /** The badge beside their name; see trustTier in lib/cosign.ts. */
  trust: TrustTier;
  /** Holds "Most trusted" at their college (getMostTrusted). */
  mostTrusted: boolean;
};

/**
 * Which board. A college board is everyone at that college with a full
 * total. The global board is every college together, but only lifters whose
 * three lifts are all co-signed: a campus board polices itself because
 * everyone knows who actually squats 200, and a board of strangers'
 * self-reported numbers does not. Co-signing is the price of entry.
 */
export type BoardScope =
  | { collegeId: number }
  | { global: true }
  // A lifter and everyone they added (lib/friends.ts), from any college.
  | { friendsOf: string };

/**
 * The DOTS polynomial, as a SQL fragment.
 *
 * This duplicates lib/scoring.ts. That is deliberate — ranking belongs in
 * the database, and shipping every lifter to Node to sort them would be
 * silly. But two copies of a formula drift, so scripts/check-scoring-parity.mjs
 * asserts the two agree. If you change one, run that script.
 *
 * bw is cast to double precision so the arithmetic matches JavaScript's
 * floats exactly rather than Postgres's arbitrary-precision numerics.
 */
export async function getLeaderboard(scope: BoardScope): Promise<BoardRow[]> {
  const collegeId = "collegeId" in scope ? scope.collegeId : null;
  const verifiedOnly = "global" in scope;
  // In parallel with the board itself; a failure only costs the title.
  const holders = getMostTrusted().catch(() => [] as MostTrusted[]);
  const friendsOf = "friendsOf" in scope ? scope.friendsOf : null;

  const rows = await sql`
    with sbd as (
      select
        lf.id,
        lf.username,
        lf.display_name,
        lf.bodyweight_kg,
        lf.batch_year,
        lf.avatar,
        c.slug       as college_slug,
        c.short_name as college_short,
        sum(l.est_1rm_kg) as total_kg,
        count(*) filter (where cs.cosigned) as verified_count,
        json_agg(cs.witnesses) as witnesses
      from lifters lf
      join colleges c on c.id = lf.college_id
      join lifts l on l.lifter_id = lf.id
      -- One yes/no per lift, never one row per co-signer: a plain join
      -- would multiply the lift (and the total) by its number of witnesses.
      cross join lateral (
        select
          (select count(*) from lift_cosigns x where x.lift_id = l.id) as cosigns,
          (select count(*) from lift_doubts d
           where d.lift_id = l.id and d.created_at > now() - interval '30 days') as doubts
      ) n
      -- isDisputed in lib/cosign.ts: a disputed lift counts as not co-signed.
      cross join lateral (
        select n.doubts >= 2 and n.doubts > n.cosigns as disputed
      ) dp
      cross join lateral (
        select
          n.cosigns > 0 and not dp.disputed as cosigned,
          coalesce((
            select json_agg(json_build_object('id', w.id, 'name', w.display_name))
            from lift_cosigns x join lifters w on w.id = x.witness_id
            where x.lift_id = l.id and not dp.disputed
          ), '[]'::json) as witnesses
      ) cs
      where l.movement in ('squat', 'bench', 'deadlift')
        and (${collegeId}::int is null or lf.college_id = ${collegeId}::int)
        and (${friendsOf}::uuid is null or lf.id = ${friendsOf}::uuid
             or lf.id in (select friend_id from friends where lifter_id = ${friendsOf}::uuid))
      group by lf.id, lf.username, lf.display_name, lf.bodyweight_kg, lf.batch_year, lf.avatar, c.slug, c.short_name
      having count(*) = 3
        and (
          not ${verifiedOnly}::boolean
          or count(*) filter (where cs.cosigned) = 3
        )
    ),
    scored as (
      select
        id,
        username,
        display_name,
        batch_year,
        avatar,
        college_slug,
        college_short,
        verified_count,
        witnesses,
        total_kg::double precision as total_kg,
        least(greatest(bodyweight_kg, 40), 201.9)::double precision as bw,
        case
          when bodyweight_kg <= 65 then 'Up to 65kg'
          when bodyweight_kg <= 75 then '65-75kg'
          when bodyweight_kg <= 85 then '75-85kg'
          else '85kg+'
        end as weight_class
      from sbd
    ),
    dotted as (
      select
        *,
        (total_kg * 500) / (
            -307.75076
          +   24.0900756    * bw
          +   -0.1918759221 * power(bw, 2)
          +    0.0007391293 * power(bw, 3)
          +   -0.000001093  * power(bw, 4)
        ) as dots
      from scored
    )
    select
      id,
      username,
      display_name,
      batch_year,
      avatar,
      college_slug,
      college_short,
      weight_class,
      total_kg,
      dots,
      verified_count,
      witnesses,
      rank() over (order by dots desc) as overall_rank,
      rank() over (partition by weight_class order by dots desc) as class_rank
    from dotted
    order by dots desc
  `;

  const holderIds = new Set((await holders).map((h) => h.lifterId));

  return rows.map((row) => {
    // One array per scored lift; disputed lifts already come back empty.
    const witnesses = row.witnesses as { id: string; name: string }[][];
    return {
      id: row.id as string,
      username: row.username as string,
      displayName: row.display_name as string,
      weightClass: row.weight_class as string,
      totalKg: Number(row.total_kg),
      dots: Number(row.dots),
      verifiedCount: Number(row.verified_count),
      overallRank: Number(row.overall_rank),
      classRank: Number(row.class_rank),
      collegeSlug: row.college_slug as string,
      collegeShort: row.college_short as string,
      batchYear: row.batch_year === null ? null : Number(row.batch_year),
      cosign: cosignStatus(witnesses),
      avatar: (row.avatar as string | null) ?? null,
      trust: trustTier(witnesses),
      mostTrusted: holderIds.has(row.id as string),
    };
  });
}

export type RankCard = {
  username: string;
  displayName: string;
  weightClass: string;
  dots: number;
  totalKg: number;
  verifiedCount: number;
  overallRank: number;
  totalLifters: number;
  classRank: number;
  classSize: number;
  collegeSlug: string;
  collegeShort: string;
  /** The lifter directly above you, and the gap to them. Null at rank 1. */
  nextUp: { displayName: string; dotsAhead: number } | null;
};

/**
 * One lifter's standing on their college board, for the share card and
 * their own dashboard.
 *
 * This deliberately reads the whole board rather than ranking one lifter in
 * SQL. A second query with its own window function would be a second place
 * for the ranking rules to live, and the one thing a share card must never
 * do is claim a rank the leaderboard disagrees with. A board is at most a
 * few hundred rows; correctness is worth more than the saved bytes.
 *
 * Returns null for a lifter who has no squat/bench/deadlift total yet, or
 * no college — they aren't on a board, so they have no rank to share.
 */
export async function getRankFor(
  lifterId: string,
  // Pass it when the caller already has the lifter loaded: saves the
  // round trip that looks it up, which on a page that makes six is real.
  knownCollegeId?: number,
): Promise<RankCard | null> {
  let collegeId = knownCollegeId;
  if (collegeId === undefined) {
    const rows = await sql`
      select college_id from lifters where id = ${lifterId} limit 1
    `;
    const found = rows[0]?.college_id;
    if (found === null || found === undefined) return null;
    collegeId = Number(found);
  }

  const board = await getLeaderboard({ collegeId });
  return cardFrom(board, lifterId);
}

/** The same lifter's standing across every college. Null unless fully co-signed. */
export async function getGlobalRankFor(
  lifterId: string,
): Promise<RankCard | null> {
  const board = await getLeaderboard({ global: true });
  return cardFrom(board, lifterId);
}

function cardFrom(board: BoardRow[], lifterId: string): RankCard | null {
  const row = board.find((r) => r.id === lifterId);
  if (!row) return null;

  return {
    username: row.username,
    displayName: row.displayName,
    weightClass: row.weightClass,
    dots: row.dots,
    totalKg: row.totalKg,
    verifiedCount: row.verifiedCount,
    overallRank: row.overallRank,
    totalLifters: board.length,
    classRank: row.classRank,
    classSize: board.filter((r) => r.weightClass === row.weightClass).length,
    collegeSlug: row.collegeSlug,
    collegeShort: row.collegeShort,
    nextUp: nextUpFrom(board, row),
  };
}

/**
 * The nearest lifter above you on the overall board.
 *
 * "You are 12.3 off Sarthak" is a reason to come back; "you are third" is
 * a fact. The board is sorted by DOTS descending, so this is the last row
 * strictly ahead of you — not simply the previous index, which would be a
 * tied lifter when two scores match.
 */
function nextUpFrom(
  board: BoardRow[],
  row: BoardRow,
): { displayName: string; dotsAhead: number } | null {
  const ahead = board.filter((r) => r.dots > row.dots);
  if (ahead.length === 0) return null;
  const nearest = ahead[ahead.length - 1];
  return {
    displayName: nearest.displayName,
    dotsAhead: nearest.dots - row.dots,
  };
}

/* ------------------------------------------------------------------------
   Per-lift boards.

   The overall board needs a full squat/bench/deadlift total, which makes
   someone who only benches invisible until they've entered all three. A
   lift board ranks a single movement, so one entry puts you on one.

   Ranked by bodyweight-adjusted score, not raw kilos: raw kilos per lift
   brings back exactly the problem DOTS exists to fix. DOTS is a ratio
   against a bodyweight curve, so it applies to a single lift's est. 1RM
   as cleanly as to a total — only the scale changes. Pull-ups are already
   bodyweight-relative, so they rank by reps.

   One query ranks every movement at once (window functions partitioned by
   movement), so a page with five tabs pays one round trip, not five.
   ------------------------------------------------------------------------ */

export type LiftRow = {
  id: string;
  username: string;
  displayName: string;
  weightClass: string;
  movement: Movement;
  /** est. 1RM in kg; null for pull-ups. */
  kg: number | null;
  reps: number;
  /** What the rank is on: lift DOTS, or reps for pull-ups. */
  score: number;
  verified: boolean;
  rank: number;
  classRank: number;
  collegeSlug: string;
  collegeShort: string;
  batchYear: number | null;
  avatar: string | null;
};

export type LiftBoards = Record<Movement, LiftRow[]>;

export async function getLiftBoards(scope: BoardScope): Promise<LiftBoards> {
  const collegeId = "collegeId" in scope ? scope.collegeId : null;
  const verifiedOnly = "global" in scope;
  const friendsOf = "friendsOf" in scope ? scope.friendsOf : null;

  const rows = await sql`
    with base as (
      select
        lf.id,
        lf.username,
        lf.display_name,
        lf.bodyweight_kg,
        lf.batch_year,
        lf.avatar,
        c.slug       as college_slug,
        c.short_name as college_short,
        l.movement,
        l.est_1rm_kg,
        l.reps,
        v.verified
      from lifts l
      join lifters lf on lf.id = l.lifter_id
      join colleges c on c.id = lf.college_id
      cross join lateral (
        select
          (select count(*) from lift_cosigns x where x.lift_id = l.id) as cosigns,
          (select count(*) from lift_doubts d
           where d.lift_id = l.id and d.created_at > now() - interval '30 days') as doubts
      ) n
      -- Co-signed and not disputed (isDisputed in lib/cosign.ts).
      cross join lateral (
        select n.cosigns > 0 and not (n.doubts >= 2 and n.doubts > n.cosigns) as verified
      ) v
      where (${collegeId}::int is null or lf.college_id = ${collegeId}::int)
        and (${friendsOf}::uuid is null or lf.id = ${friendsOf}::uuid
             or lf.id in (select friend_id from friends where lifter_id = ${friendsOf}::uuid))
        and (not ${verifiedOnly}::boolean or v.verified)
    ),
    scored as (
      select
        *,
        least(greatest(bodyweight_kg, 40), 201.9)::double precision as bw,
        case
          when bodyweight_kg <= 65 then 'Up to 65kg'
          when bodyweight_kg <= 75 then '65-75kg'
          when bodyweight_kg <= 85 then '75-85kg'
          else '85kg+'
        end as weight_class
      from base
    ),
    dotted as (
      select
        *,
        case
          when movement = 'pullups' then reps::double precision
          else (est_1rm_kg::double precision * 500) / (
              -307.75076
            +   24.0900756    * bw
            +   -0.1918759221 * power(bw, 2)
            +    0.0007391293 * power(bw, 3)
            +   -0.000001093  * power(bw, 4)
          )
        end as score
      from scored
    )
    select
      id, username, display_name, weight_class, movement,
      est_1rm_kg, reps, score, verified, college_slug, college_short, batch_year, avatar,
      rank() over (partition by movement order by score desc) as rank,
      rank() over (partition by movement, weight_class order by score desc) as class_rank
    from dotted
    order by movement, score desc
  `;

  const boards: LiftBoards = {
    squat: [],
    bench: [],
    deadlift: [],
    overhead_press: [],
    pullups: [],
  };
  for (const row of rows) {
    const movement = row.movement as Movement;
    boards[movement].push({
      id: row.id as string,
      username: row.username as string,
      displayName: row.display_name as string,
      weightClass: row.weight_class as string,
      movement,
      kg: row.est_1rm_kg === null ? null : Number(row.est_1rm_kg),
      reps: Number(row.reps),
      score: Number(row.score),
      verified: Boolean(row.verified),
      rank: Number(row.rank),
      classRank: Number(row.class_rank),
      collegeSlug: row.college_slug as string,
      collegeShort: row.college_short as string,
      batchYear: row.batch_year === null ? null : Number(row.batch_year),
      avatar: (row.avatar as string | null) ?? null,
    });
  }
  return boards;
}

/** Where one lifter stands on each lift board: rank and board size. */
export function standingsFor(
  boards: LiftBoards,
  lifterId: string,
): Partial<Record<Movement, { rank: number; of: number }>> {
  const out: Partial<Record<Movement, { rank: number; of: number }>> = {};
  for (const movement of Object.keys(boards) as Movement[]) {
    const rows = boards[movement];
    const me = rows.find((r) => r.id === lifterId);
    if (me) out[movement] = { rank: me.rank, of: rows.length };
  }
  return out;
}
