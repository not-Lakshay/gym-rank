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

/*
  Colleges are data, not schema, but they ship with the code: the list is
  the product's idea of "which colleges exist", and a board for a college
  nobody can select is unreachable. Upserting on slug means editing a name
  or adding a domain in the JSON and re-running this is the whole process.
*/
const colleges = JSON.parse(
  readFileSync(new URL("../db/colleges.json", import.meta.url), "utf8"),
);
for (const c of colleges) {
  await sql`
    insert into colleges (slug, name, short_name, city, state, domains)
    values (${c.slug}, ${c.name}, ${c.short}, ${c.city}, ${c.state}, ${c.domains})
    on conflict (slug) do update
      set name       = excluded.name,
          short_name = excluded.short_name,
          city       = excluded.city,
          state      = excluded.state,
          domains    = excluded.domains
  `;
}
console.log(`\nSeeded ${colleges.length} colleges.`);

// Every lifter who signed up before colleges existed was at the LNMIIT gym,
// where the project started. A null college after this point means a new
// sign-up who hasn't picked one yet.
const moved = await sql`
  update lifters
  set college_id = (select id from colleges where slug = 'lnmiit')
  where college_id is null
  returning id
`;
if (moved.length > 0) {
  console.log(`Moved ${moved.length} lifter(s) without a college onto LNMIIT.`);
}

// Lifters from before usernames existed get one derived from their display
// name, the same way the sign-up form suggests it. The rules live in
// lib/username.ts, which this script can't import (TypeScript), so this is
// a deliberate, minimal copy: keep the two in step.
const withoutUsername = await sql`
  select id, display_name from lifters where username is null order by created_at
`;
for (const lifter of withoutUsername) {
  const words = lifter.display_name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
  let base = words.slice(0, 2).join(".");
  if (base.length < 3) base = (base + ".lifter").slice(0, 20);
  if (base.length > 20) base = base.slice(0, 20).replace(/\.$/, "");

  for (let n = 1; n < 100; n++) {
    const suffix = n === 1 ? "" : String(n);
    const candidate = base.slice(0, 20 - suffix.length).replace(/\.$/, "") + suffix;
    const taken = await sql`
      select 1 from lifters where lower(username) = ${candidate} limit 1
    `;
    if (taken.length === 0) {
      await sql`update lifters set username = ${candidate} where id = ${lifter.id}`;
      console.log(`  ${lifter.display_name} → @${candidate}`);
      break;
    }
  }
}
if (withoutUsername.length > 0) {
  console.log(`Gave ${withoutUsername.length} lifter(s) a username.`);
}
await sql`alter table lifters alter column username set not null`;

const tables = await sql`
  select table_name from information_schema.tables
  where table_schema = 'public' order by table_name
`;
console.log("\nTables in the database:", tables.map((t) => t.table_name).join(", "));
