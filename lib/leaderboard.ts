import { sql } from "./db";

export type BoardRow = {
  id: string;
  displayName: string;
  weightClass: string;
  totalKg: number;
  dots: number;
  verifiedCount: number;
  overallRank: number;
  classRank: number;
};

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
export async function getLeaderboard(): Promise<BoardRow[]> {
  const rows = await sql`
    with sbd as (
      select
        lf.id,
        lf.display_name,
        lf.bodyweight_kg,
        sum(l.est_1rm_kg) as total_kg,
        count(*) filter (where l.verified_by is not null) as verified_count
      from lifters lf
      join lifts l on l.lifter_id = lf.id
      where l.movement in ('squat', 'bench', 'deadlift')
      group by lf.id, lf.display_name, lf.bodyweight_kg
      having count(*) = 3
    ),
    scored as (
      select
        id,
        display_name,
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
      display_name,
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
    displayName: row.display_name as string,
    weightClass: row.weight_class as string,
    totalKg: Number(row.total_kg),
    dots: Number(row.dots),
    verifiedCount: Number(row.verified_count),
    overallRank: Number(row.overall_rank),
    classRank: Number(row.class_rank),
  }));
}

export type RankCard = {
  displayName: string;
  weightClass: string;
  dots: number;
  totalKg: number;
  overallRank: number;
  totalLifters: number;
  classRank: number;
  classSize: number;
};

/**
 * One lifter's standing, for the share card and their own dashboard.
 *
 * This deliberately reads the whole board rather than ranking one lifter in
 * SQL. A second query with its own window function would be a second place
 * for the ranking rules to live, and the one thing a share card must never
 * do is claim a rank the leaderboard disagrees with. The board is at most a
 * few hundred rows; correctness is worth more than the saved bytes.
 *
 * Returns null for a lifter who has no squat/bench/deadlift total yet —
 * they aren't on the board, so they have no rank to share.
 */
export async function getRankFor(lifterId: string): Promise<RankCard | null> {
  const board = await getLeaderboard();
  const row = board.find((r) => r.id === lifterId);
  if (!row) return null;

  return {
    displayName: row.displayName,
    weightClass: row.weightClass,
    dots: row.dots,
    totalKg: row.totalKg,
    overallRank: row.overallRank,
    totalLifters: board.length,
    classRank: row.classRank,
    classSize: board.filter((r) => r.weightClass === row.weightClass).length,
  };
}
