"use client";

import { useState } from "react";
import Link from "next/link";
import { BATCH_COLLEGE, batchOptions, batchLabel } from "@/lib/batch";
import type { CollegeOption } from "@/lib/colleges";
import { field } from "./forms";

/*
  Two faces of one list. On the landing page a result is a link to that
  college's board; in the profile form it sets a hidden input. Both search
  the same way, so the matching lives here once.
*/

const SHOWN = 8;

function matches(colleges: CollegeOption[], query: string): CollegeOption[] {
  const q = query.trim().toLowerCase();
  if (q === "") return colleges.slice(0, SHOWN);
  const terms = q.split(/\s+/);
  return colleges
    .filter((c) => {
      const hay = `${c.name} ${c.shortName} ${c.city} ${c.state} ${c.slug}`.toLowerCase();
      return terms.every((t) => hay.includes(t));
    })
    .slice(0, SHOWN);
}

function lifterCount(n: number) {
  if (n === 0) return "no board yet";
  return n === 1 ? "1 lifter" : `${n} lifters`;
}

export function CollegePicker({ colleges }: { colleges: CollegeOption[] }) {
  const [query, setQuery] = useState("");
  // Before a search: LNMIIT first, since most visitors study there, then
  // other colleges with a board. A list of "no board yet" is the emptiest
  // thing a front page can show; the rest turn up when searched for.
  const featured = [
    ...colleges.filter((c) => c.slug === BATCH_COLLEGE),
    ...colleges.filter((c) => c.slug !== BATCH_COLLEGE && c.lifters > 0),
  ];
  const shown =
    query.trim() === "" && featured.length > 0
      ? featured.slice(0, SHOWN)
      : matches(colleges, query);

  return (
    <div>
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search your college"
        aria-label="Search your college"
        autoComplete="off"
        className={`${field} w-full text-left`}
      />
      <p className="mt-2 text-[11px] text-chalk-faint">
        {query.trim() === ""
          ? "Where people already are"
          : shown.length === 0
            ? "Nothing matches."
            : `${shown.length} match${shown.length === 1 ? "" : "es"}`}
      </p>
      <ul className="scroll-list mt-2 max-h-[17rem]">
        {shown.map((c, i) => (
          <li key={c.slug} className="rise" style={{ "--i": i } as React.CSSProperties}>
            <Link
              href={`/c/${c.slug}`}
              className="row flex min-h-12 items-center justify-between gap-3 border-b border-rule py-2 hover:bg-iron-raised"
            >
              <span className="min-w-0">
                <span className="block truncate text-[14px] font-medium">
                  {c.shortName}
                </span>
                <span className="block truncate text-[11px] text-chalk-faint">
                  {c.name === c.shortName ? c.city : `${c.name} · ${c.city}`}
                </span>
              </span>
              <span className="tnum shrink-0 text-[11px] text-chalk-dim">
                {lifterCount(c.lifters)}
              </span>
            </Link>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-[12px] leading-relaxed text-chalk-faint">
        College not listed?{" "}
        <a
          href="mailto:getgymrank@gmail.com?subject=Add%20my%20college%20to%20Gym%20Rank"
          className="text-chalk-dim underline underline-offset-4 hover:text-chalk"
        >
          Ask for it
        </a>{" "}
        — it takes a day.
      </p>
    </div>
  );
}

export function CollegeField({
  colleges,
  defaultSlug,
  locked,
  defaultBatch,
}: {
  colleges: CollegeOption[];
  defaultSlug: string | null;
  /** Set when the sign-in email decided the college. Not changeable. */
  locked: { slug: string; shortName: string; name: string } | null;
  defaultBatch: number | null;
}) {
  const [slug, setSlug] = useState(defaultSlug);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(defaultSlug === null);

  if (locked) {
    return (
      <div className="flex flex-col gap-1.5">
        <span className="text-[12px] text-chalk-dim">College</span>
        <p className="text-[15px] font-medium">
          {locked.shortName}
          <span className="block text-[12px] font-normal text-chalk-faint">
            {locked.name} · from your sign-in email
          </span>
        </p>
        {locked.slug === BATCH_COLLEGE && <BatchField defaultBatch={defaultBatch} />}
      </div>
    );
  }

  const chosen = colleges.find((c) => c.slug === slug) ?? null;
  const shown = matches(colleges, query);

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[12px] text-chalk-dim">College</span>
      <input type="hidden" name="collegeSlug" value={slug ?? ""} />

      {chosen && !open ? (
        <div className="flex items-center justify-between gap-3">
          <p className="min-w-0 text-[15px] font-medium">
            {chosen.shortName}
            <span className="block truncate text-[12px] font-normal text-chalk-faint">
              {chosen.name} · {chosen.city}
            </span>
          </p>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="press shrink-0 rounded-sm border border-rule px-3 py-1.5 text-[12px] text-chalk-dim hover:border-chalk-faint hover:text-chalk"
          >
            Change
          </button>
        </div>
      ) : (
        <div>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name or city"
            aria-label="Search your college"
            autoComplete="off"
            className={`${field} w-full text-left`}
          />
          <ul className="mt-1 max-h-64 overflow-y-auto rounded-sm border border-rule">
            {shown.length === 0 && (
              <li className="px-3 py-2 text-[12px] text-chalk-faint">
                Nothing matches.
              </li>
            )}
            {shown.map((c) => (
              <li key={c.slug}>
                <button
                  type="button"
                  onClick={() => {
                    setSlug(c.slug);
                    setOpen(false);
                  }}
                  className="flex min-h-11 w-full items-center justify-between gap-3 border-b border-rule px-3 py-2 text-left last:border-b-0 hover:bg-iron-raised"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-[14px] font-medium">
                      {c.shortName}
                    </span>
                    <span className="block truncate text-[11px] text-chalk-faint">
                      {c.city}, {c.state}
                    </span>
                  </span>
                  <span className="tnum shrink-0 text-[11px] text-chalk-dim">
                    {lifterCount(c.lifters)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      {slug === BATCH_COLLEGE && <BatchField defaultBatch={defaultBatch} />}
    </div>
  );
}

/* LNMIIT only: which batch you joined with. Optional — blank saves none. */
function BatchField({ defaultBatch }: { defaultBatch: number | null }) {
  return (
    <label className="mt-3 flex flex-col gap-1.5">
      <span className="text-[12px] text-chalk-dim">Batch</span>
      <select
        name="batchYear"
        defaultValue={defaultBatch ?? ""}
        className={`${field} w-full text-left`}
      >
        <option value="">Prefer not to say</option>
        {batchOptions().map((year) => (
          <option key={year} value={year}>
            {batchLabel(year)}
          </option>
        ))}
      </select>
    </label>
  );
}
