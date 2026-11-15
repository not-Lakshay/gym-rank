import Link from "next/link";
import type { BoardRow } from "@/lib/leaderboard";
import { plateFor } from "@/lib/plates";
import { CountUp } from "./score";

export const MEDALS = ["var(--gold)", "var(--silver)", "var(--bronze)"];

// A class board with one or two people isn't a ranking, it's a repeat of
// the overall board. Classes appear once they have enough lifters to mean
// something.
export const MIN_CLASS_SIZE = 3;

export function shortClass(label: string) {
  if (label.startsWith("Up to")) return "≤65 kg";
  if (label.endsWith("+")) return "85 kg+";
  return label.replace("kg", " kg");
}

/* The board in three numbers. Gives a page a pulse before the list. */
export function Stats({ rows }: { rows: BoardRow[] }) {
  const totalKg = rows.reduce((sum, r) => sum + r.totalKg, 0);
  const cosigned = rows.filter((r) => r.verifiedCount === 3).length;
  return (
    <dl className="grid grid-cols-3 gap-px overflow-hidden rounded-sm border border-rule bg-rule">
      <Stat label="lifters" value={rows.length} />
      <Stat label="kg on the board" value={totalKg} />
      <Stat label="fully co-signed" value={cosigned} />
    </dl>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-iron px-3 py-2.5">
      <dd className="tnum text-[20px] font-extrabold leading-none tracking-[-0.02em]">
        <CountUp value={value} decimals={0} durationMs={900} />
      </dd>
      <dt className="mt-1 text-[11px] text-chalk-dim">{label}</dt>
    </div>
  );
}

export function Board({
  heading,
  plate,
  rows,
  rankOf,
  viewerId,
  medals = false,
  showCollege = false,
}: {
  heading: string;
  plate?: string;
  rows: BoardRow[];
  rankOf: (row: BoardRow) => number;
  viewerId: string | null;
  medals?: boolean;
  /** On the global board the college is the subline, not the co-sign count. */
  showCollege?: boolean;
}) {
  // Rows arrive sorted by DOTS descending, so the first is the yardstick
  // every bar below is measured against.
  const topDots = rows[0]?.dots ?? 0;

  return (
    <section>
      <h2 className="mb-2 flex items-center justify-between gap-2 text-[13px] font-medium text-chalk-dim">
        <span className="flex items-center gap-2">
          {plate && (
            <span
              aria-hidden
              className="h-2.5 w-2.5 rounded-full"
              style={{ background: plate }}
            />
          )}
          {heading}
        </span>
        <span className="text-[11px] font-normal text-chalk-faint">
          bar = score vs #1
        </span>
      </h2>

      <ol>
        {rows.map((row, index) => {
          const rank = rankOf(row);
          const leading = rank === 1;
          const isViewer = row.id === viewerId;
          const medal = medals && rank <= 3 ? MEDALS[rank - 1] : null;

          // How this score reads against the leader's. A leaderboard is a
          // ranking of magnitudes, and a column of numbers hides that —
          // the bar is the only element here that shows the gaps.
          const share = topDots > 0 ? row.dots / topDots : 0;

          return (
            <li
              key={row.id}
              className={`row relative flex items-center gap-3 border-b border-rule py-3 last:border-b-0 hover:bg-iron-raised ${
                isViewer ? "-mx-2 rounded-sm px-2 ring-1 ring-chalk-faint/40" : ""
              }`}
            >
              <span
                aria-hidden
                className={`row-bar bar-grow pointer-events-none absolute inset-y-px left-0 overflow-hidden rounded-sm ${
                  leading ? "sheen" : ""
                }`}
                style={{
                  width: `${Math.max(share * 100, 6)}%`,
                  background: plateFor(row.weightClass),
                  opacity: leading ? 0.18 : 0.09,
                  animationDelay: `${Math.min(index, 8) * 45}ms`,
                }}
              />

              <span
                aria-hidden
                className="relative h-9 w-[3px] shrink-0 rounded-full"
                style={{
                  background: plateFor(row.weightClass),
                  opacity: leading ? 1 : 0.35,
                }}
              />

              {medal ? (
                <span
                  className="medal relative shrink-0"
                  style={{ "--medal": medal } as React.CSSProperties}
                >
                  {rank}
                </span>
              ) : (
                <span className="tnum relative w-6 shrink-0 text-center text-[13px] text-chalk-faint">
                  {rank}
                </span>
              )}

              <span className="row-name relative min-w-0 flex-1">
                <span className="flex items-center gap-1.5">
                  <Link
                    href={`/u/${row.username}`}
                    className={`truncate underline-offset-4 hover:underline ${
                      leading
                        ? "text-[15px] font-bold"
                        : "text-[14px] font-medium"
                    }`}
                  >
                    {row.displayName}
                  </Link>
                  {isViewer && (
                    <span className="shrink-0 rounded-sm bg-chalk px-1.5 text-[10px] font-bold uppercase text-iron">
                      you
                    </span>
                  )}
                </span>
                {/* The handle is what tells two Rohans apart. */}
                <span className="flex min-w-0 items-center gap-1 text-[11px] text-chalk-dim">
                  <span className="truncate text-chalk-faint">@{row.username}</span>
                  {showCollege ? (
                    <>
                      <span aria-hidden className="text-chalk-faint">·</span>
                      <Link
                        href={`/c/${row.collegeSlug}`}
                        className="truncate underline-offset-4 hover:underline"
                      >
                        {row.collegeShort}
                      </Link>
                    </>
                  ) : (
                    row.verifiedCount > 0 && (
                      <>
                        <span aria-hidden className="text-chalk-faint">·</span>
                        <Check />
                        <span className="truncate">
                          {row.verifiedCount === 3
                            ? "all co-signed"
                            : `${row.verifiedCount} of 3 co-signed`}
                        </span>
                      </>
                    )
                  )}
                </span>
              </span>

              <span className="relative shrink-0 text-right">
                <span
                  className={`tnum block leading-none ${
                    leading ? "text-[22px] font-extrabold" : "text-[17px] font-bold"
                  }`}
                >
                  <CountUp value={row.dots} durationMs={700 + index * 60} />
                </span>
                <span className="tnum mt-1 block text-[11px] text-chalk-faint">
                  {row.totalKg.toFixed(0)} kg
                </span>
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

export function Check() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 16 16"
      className="h-3 w-3 text-[var(--plate-10)]"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m3 8.5 3 3 7-7" />
    </svg>
  );
}

export function ChevronLeft() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 16 16"
      className="h-3.5 w-3.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M10 3 5 8l5 5" />
    </svg>
  );
}

export function ChevronRight() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 16 16"
      className="h-3.5 w-3.5 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m6 3 5 5-5 5" />
    </svg>
  );
}

export const button =
  "press inline-flex min-h-11 shrink-0 items-center justify-center whitespace-nowrap rounded-sm bg-chalk px-5 text-[15px] font-bold text-iron hover:opacity-85";

// Outlined: navigation and account controls. Visibly tappable, but clearly
// not the main action on the screen.
export const navButton =
  "press inline-flex min-h-11 w-fit items-center gap-1.5 rounded-sm border border-rule px-3.5 text-[15px] text-chalk-dim hover:border-chalk-faint hover:text-chalk";

// Footer navigation as real buttons: on a phone a row of underlined words
// reads as prose, and these are the only way off the page.
export const footerLink =
  "press inline-flex min-h-11 items-center rounded-sm border border-rule px-3.5 text-[14px] text-chalk-dim hover:border-chalk-faint hover:text-chalk";

/*
  What a page looks like while its data is on the way. The same wait reads
  as half as long when the page is visibly arriving rather than a word on
  a blank screen — and with the database a region away and asleep between
  visits, the wait is sometimes seconds.
*/
export function Bone({ className }: { className: string }) {
  return (
    <span
      aria-hidden
      className={`block animate-pulse rounded-sm bg-iron-raised ${className}`}
    />
  );
}

export function BoardSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div role="status" aria-label="Loading board" className="pt-6">
      <div className="grid grid-cols-3 gap-px overflow-hidden rounded-sm border border-rule bg-rule">
        {[0, 1, 2].map((i) => (
          <div key={i} className="bg-iron px-3 py-2.5">
            <Bone className="h-5 w-10" />
            <Bone className="mt-2 h-3 w-16" />
          </div>
        ))}
      </div>
      <Bone className="mt-6 h-3 w-20" />
      <ol className="mt-3">
        {Array.from({ length: rows }, (_, i) => (
          <li key={i} className="flex items-center gap-3 border-b border-rule py-3">
            <Bone className="h-9 w-[3px]" />
            <Bone className="h-4 w-6" />
            <span className="flex-1">
              <Bone className="h-4 w-32" />
              <Bone className="mt-1.5 h-3 w-20" />
            </span>
            <span className="text-right">
              <Bone className="ml-auto h-5 w-14" />
              <Bone className="ml-auto mt-1.5 h-3 w-10" />
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

export function ProfileSkeleton() {
  return (
    <div role="status" aria-label="Loading" className="pt-8">
      <Bone className="h-1 w-16" />
      <Bone className="mt-4 h-8 w-48" />
      <Bone className="mt-3 h-3 w-40" />
      <Bone className="mt-6 h-14 w-36" />
      <Bone className="mt-4 h-4 w-28" />
      <Bone className="mt-10 h-3 w-16" />
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={i} className="flex items-center gap-3 border-b border-rule py-3">
          <span className="flex-1">
            <Bone className="h-4 w-28" />
            <Bone className="mt-1.5 h-3 w-24" />
          </span>
          <Bone className="h-11 w-[4.5rem]" />
          <Bone className="h-11 w-[4.5rem]" />
        </div>
      ))}
    </div>
  );
}

export function Footer({ i = 6, home = true }: { i?: number; home?: boolean }) {
  return (
    <footer
      className="rise mt-14 border-t border-rule pt-5"
      style={{ "--i": i } as React.CSSProperties}
    >
      <p className="flex flex-wrap gap-2">
        {home && (
          <Link href="/" className={footerLink}>
            All colleges
          </Link>
        )}
        <Link href="/global" className={footerLink}>
          Global board
        </Link>
        <Link href="/scoring" className={footerLink}>
          How scoring works
        </Link>
        <Link href="/privacy" className={footerLink}>
          Privacy
        </Link>
        <Link href="/terms" className={footerLink}>
          Terms
        </Link>
      </p>
    </footer>
  );
}
