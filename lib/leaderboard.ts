import { sql } from "./db";

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
};

/**
 * Which board. A college board is everyone at that college with a full
 * total. The global board is every college together, but only lifters whose
 * three lifts are all co-signed: a campus board polices itself because
 * everyone knows who actually squats 200, and a board of strangers'
 * self-reported numbers does not. Co-signing is the price of entry.
 */
export type BoardScope = { collegeId: number } | { global: true };

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

  const rows = await sql`
    with sbd as (
      select
        lf.id,
        lf.username,
        lf.display_name,
        lf.bodyweight_kg,
        c.slug       as college_slug,
        c.short_name as college_short,
        sum(l.est_1rm_kg) as total_kg,
        count(*) filter (where l.verified_by is not null) as verified_count
      from lifters lf
      join colleges c on c.id = lf.college_id
      join lifts l on l.lifter_id = lf.id
      where l.movement in ('squat', 'bench', 'deadlift')
        and (${collegeId}::int is null or lf.college_id = ${collegeId}::int)
      group by lf.id, lf.username, lf.display_name, lf.bodyweight_kg, c.slug, c.short_name
      having count(*) = 3
        and (
          not ${verifiedOnly}::boolean
          or count(*) filter (where l.verified_by is not null) = 3
        )
    ),
    scored as (
      select
        id,
        username,
        display_name,
        college_slug,
        college_short,
        verified_count,
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
      college_slug,
      college_short,
      weight_class,
      total_kg,
      dots,
      verified_count,
      rank() over (order by dots desc) as overall_rank,
      rank() over (partition by weight_class order by dots desc) as class_rank
    from dotted
    order by dots desc
  `;

  return rows.map((row) => ({
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
  }));
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
export async function getRankFor(lifterId: string): Promise<RankCard | null> {
  const rows = await sql`
    select college_id from lifters where id = ${lifterId} limit 1
  `;
  const collegeId = rows[0]?.college_id;
  if (collegeId === null || collegeId === undefined) return null;

  const board = await getLeaderboard({ collegeId: Number(collegeId) });
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
