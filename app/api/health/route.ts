import { connection } from "next/server";
import { sql } from "@/lib/db";

/*
  Keep-awake target.

  Neon's free plan suspends the database after five idle minutes, and the
  next visitor pays the wake-up — seconds, occasionally much worse. An
  external scheduler (cron-job.org) hits this every four minutes during
  waking hours so the first person into the gym doesn't eat that cost.

  The query is the point: a response that never reached Postgres would
  keep Vercel warm and Neon asleep. It is deliberately trivial, because
  this runs ~270 times a day.

  Hours are limited on purpose. The free plan has 100 compute-hours a
  month and running out suspends the database outright. At 0.25 CU,
  always-on is ~186 and 18 hours a day ~140, both over; about 10 hours
  a day (~78) leaves room for real traffic.
*/
export async function GET() {
  // Never prerendered: a cached "up" from build time would be worse than
  // no endpoint, and the ping has to reach Postgres every time.
  await connection();
  const started = Date.now();
  try {
    await sql`select 1`;
    return Response.json(
      { ok: true, db: "up", ms: Date.now() - started },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (err) {
    console.error("health: database unreachable", err);
    return Response.json(
      { ok: false, db: "down", ms: Date.now() - started },
      { status: 503, headers: { "cache-control": "no-store" } },
    );
  }
}
