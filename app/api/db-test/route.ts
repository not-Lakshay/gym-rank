import { neon } from "@neondatabase/serverless";

// Temporary endpoint: proves the app can reach Postgres.
// Delete once the real schema and queries are in place.
export async function GET(request: Request) {
  try {
    const sql = neon(process.env.DATABASE_URL!);
    const rows = await sql`
      select now() as now, current_database() as db, version() as version
    `;

    return Response.json({
      ok: true,
      now: rows[0].now,
      database: rows[0].db,
      version: rows[0].version,
      servedFrom: new URL(request.url).host,
    });
  } catch (err) {
    return Response.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      },
      { status: 500 },
    );
  }
}
