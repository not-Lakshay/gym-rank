import { sql } from "./db";

export type College = {
  id: number;
  slug: string;
  name: string;
  shortName: string;
  city: string;
  state: string;
};

/** A college as the picker sees it: no id, plus how many are on its board. */
export type CollegeOption = Omit<College, "id"> & { lifters: number };

function fromRow(row: Record<string, unknown>): College {
  return {
    id: Number(row.id),
    slug: row.slug as string,
    name: row.name as string,
    shortName: row.short_name as string,
    city: row.city as string,
    state: row.state as string,
  };
}

export async function getCollegeBySlug(slug: string): Promise<College | null> {
  const rows = await sql`
    select id, slug, name, short_name, city, state
    from colleges where slug = ${slug} limit 1
  `;
  return rows.length === 0 ? null : fromRow(rows[0]);
}

/**
 * Every college, with how many lifters have a full total on its board.
 * The count is what lets the landing page show "where people already are"
 * ahead of a 150-row alphabetical list, and lets the picker say whether a
 * college has a board yet or you would be starting one.
 */
export async function getCollegeOptions(): Promise<CollegeOption[]> {
  const rows = await sql`
    select
      c.slug, c.name, c.short_name, c.city, c.state,
      (
        select count(*)
        from lifters lf
        where lf.college_id = c.id
          and (
            select count(*) from lifts l
            where l.lifter_id = lf.id
              and l.movement in ('squat', 'bench', 'deadlift')
          ) = 3
      ) as lifters
    from colleges c
    order by lifters desc, c.short_name asc
  `;
  return rows.map((row) => ({
    slug: row.slug as string,
    name: row.name as string,
    shortName: row.short_name as string,
    city: row.city as string,
    state: row.state as string,
    lifters: Number(row.lifters),
  }));
}

/**
 * The college that issued an email address, if any.
 *
 * Matched on domain suffix, so `student.iitd.ac.in` finds IIT Delhi's
 * `iitd.ac.in`. A match is both a convenience (no picker) and the only
 * verification the app has that someone is at the college they claim — so
 * when it matches, the profile form locks the college to it.
 */
export async function collegeForEmail(email: string): Promise<College | null> {
  const at = email.lastIndexOf("@");
  if (at === -1) return null;
  const domain = email.slice(at + 1).toLowerCase();

  // `d` is each domain in the array; the email domain either is it or ends
  // with "." + it. The join is unnested so a college with several domains
  // matches on any of them.
  const rows = await sql`
    select c.id, c.slug, c.name, c.short_name, c.city, c.state
    from colleges c, unnest(c.domains) as d
    where ${domain} = d or ${domain} like '%.' || d
    order by length(d) desc
    limit 1
  `;
  return rows.length === 0 ? null : fromRow(rows[0]);
}

/** Admin: add a college without a deploy. Slug must be unique. */
export async function addCollege(c: {
  slug: string;
  name: string;
  shortName: string;
  city: string;
  state: string;
  domains: string[];
}): Promise<College> {
  const rows = await sql`
    insert into colleges (slug, name, short_name, city, state, domains)
    values (${c.slug}, ${c.name}, ${c.shortName}, ${c.city}, ${c.state}, ${c.domains})
    returning id, slug, name, short_name, city, state
  `;
  return fromRow(rows[0]);
}
