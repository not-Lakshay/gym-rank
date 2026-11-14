/**
 * The DOTS polynomial exists twice: in lib/scoring.ts (used for display)
 * and inline in lib/leaderboard.ts (used for ranking). Two copies of a
 * formula drift. This asserts they agree.
 *
 * Run after changing either:
 *   node --env-file=.env.local scripts/check-scoring-parity.mjs
 */
import { neon } from "@neondatabase/serverless";
import { dotsScore } from "../lib/scoring.ts";

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}

const sql = neon(process.env.DATABASE_URL);

const cases = [
  { total: 600, bw: 90 },
  { total: 320, bw: 60 },
  { total: 350, bw: 87 },
  { total: 300, bw: 55 },
  { total: 400, bw: 120 },
  { total: 250, bw: 35 },  // below the clamp floor
  { total: 500, bw: 250 }, // above the clamp ceiling
];

let failures = 0;

for (const { total, bw } of cases) {
  const [row] = await sql`
    with scored as (
      select
        ${total}::double precision as total_kg,
        least(greatest(${bw}::numeric, 40), 201.9)::double precision as bw
    )
    select (total_kg * 500) / (
        -307.75076
      +   24.0900756    * bw
      +   -0.1918759221 * power(bw, 2)
      +    0.0007391293 * power(bw, 3)
      +   -0.000001093  * power(bw, 4)
    ) as dots
    from scored
  `;

  const fromSql = Number(row.dots);
  const fromJs = dotsScore(total, bw);
  const delta = Math.abs(fromSql - fromJs);
  const ok = delta < 1e-9;

  if (!ok) failures++;
  console.log(
    `${ok ? "PASS" : "FAIL"}  ${total}kg @ ${bw}kg -> sql ${fromSql.toFixed(6)}, js ${fromJs.toFixed(6)}`,
  );
}

console.log(
  failures === 0
    ? "\nSQL and TypeScript agree."
    : `\n${failures} MISMATCH(ES) — the two copies of the formula have drifted.`,
);
process.exit(failures === 0 ? 0 : 1);
