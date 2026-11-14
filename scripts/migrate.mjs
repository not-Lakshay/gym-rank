import { readFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set. Run with:");
  console.error("  node --env-file=.env.local scripts/migrate.mjs");
  process.exit(1);
}

const sql = neon(process.env.DATABASE_URL);
const schema = readFileSync(new URL("../db/schema.sql", import.meta.url), "utf8");

/**
 * The Neon HTTP driver runs one statement per call, so the file has to be
 * split on semicolons.
 *
 * Comments are stripped FIRST. A semicolon inside a `--` comment is not a
 * statement terminator, and splitting before stripping cuts the file in the
 * wrong place — which produced a "syntax error at or near" on a fragment of
 * English prose rather than SQL.
 *
 * This assumes no `--` or `;` appears inside a string literal. True for this
 * schema; if that ever changes, use a real SQL parser rather than patching
 * this regex.
 */
const statements = schema
  .split("\n")
  .map((line) => {
    const commentStart = line.indexOf("--");
    return commentStart === -1 ? line : line.slice(0, commentStart);
  })
  .join("\n")
  .split(";")
  .map((s) => s.trim())
  .filter((s) => s.length > 0);

console.log(`Applying ${statements.length} statements...`);

for (const [i, statement] of statements.entries()) {
  const label = statement.split("\n")[0].trim().slice(0, 55);
  try {
    await sql.query(statement);
    console.log(`  ${i + 1}/${statements.length}  ok    ${label}`);
  } catch (err) {
    console.error(`  ${i + 1}/${statements.length}  FAIL  ${label}`);
    console.error(`        ${err.message}`);
    console.error(`\n  Statement was:\n${statement}\n`);
    process.exit(1);
  }
}

const tables = await sql`
  select table_name from information_schema.tables
  where table_schema = 'public' order by table_name
`;
console.log("\nTables in the database:", tables.map((t) => t.table_name).join(", "));
