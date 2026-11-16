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

  Hours are limited on purpose. Always-on would burn ~186 of the free
  plan's ~191 compute-hours a month; 18 hours a day is ~140 and leaves
  room for real traffic. Running out suspends the database outright.
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
