import Link from "next/link";
import type { BoardRow, LiftRow } from "@/lib/leaderboard";
import { MOVEMENTS, type Movement } from "@/lib/movements";
import { batchLabel, batchesFor } from "@/lib/batch";
import { plateFor } from "@/lib/plates";
import { WEIGHT_CLASSES } from "@/lib/scoring";
import { Avatar } from "./avatar";
import { Departure, Morph } from "./morph";
import { Roll } from "./roll";

/** Rank within a sub-board: one plus everyone strictly ahead (ties share). */
export function rankWithin<T>(rows: T[], score: (r: T) => number) {
  return (row: T) => 1 + rows.filter((o) => score(o) > score(row)).length;
}

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
  // One witness for the whole total; partial co-signs don't count here.
  const cosigned = rows.filter((r) => r.cosign?.kind === "full").length;
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
      <dd className="tnum display text-[22px] leading-none tracking-[-0.02em]">
        <Roll value={value} decimals={0} />
      </dd>
      <dt className="caption mt-1 tracking-[0.04em]">{label}</dt>
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
  showBatch = false,
}: {
  heading: string;
  plate?: string;
  rows: BoardRow[];
  rankOf: (row: BoardRow) => number;
  viewerId: string | null;
  medals?: boolean;
  /** On the global board the college is the subline, not the co-sign count. */
  showCollege?: boolean;
  /** LNMIIT's Everyone board: a "Y24" tag beside each name. */
  showBatch?: boolean;
}) {
  // Rows arrive sorted by DOTS descending, so the first is the yardstick
  // every bar is measured against.
  const topDots = rows[0]?.dots ?? 0;

  return (
    <section style={plate ? ({ "--accent": plate } as React.CSSProperties) : undefined}>
      <Heading text={heading} plate={plate} note="bar = score vs #1" />
      <Ranked
        viewerId={viewerId}
        medals={medals}
        entries={rows.map((row) => ({
          id: row.id,
          username: row.username,
          displayName: row.displayName,
          weightClass: row.weightClass,
          rank: rankOf(row),
          share: topDots > 0 ? row.dots / topDots : 0,
          value: row.dots,
          decimals: 1,
          unit: null,
          dots: row.dots,
          detail: `${row.totalKg.toFixed(0)} kg`,
          where: showCollege ? row.collegeShort : null,
          tag:
            showBatch && row.batchYear !== null ? (
              <span className="tnum shrink-0 rounded-sm border border-rule px-1 text-[10px] font-bold leading-[1.4] text-chalk-dim">
                {batchLabel(row.batchYear)}
              </span>
            ) : null,
          sub: <BoardSub row={row} showCollege={showCollege} />,
        }))}
      />
    </section>
  );
}

/* The line under a name on the overall board: the handle, then how the
   lifts are vouched for (and the college, on the global board). */
function BoardSub({ row, showCollege }: { row: BoardRow; showCollege: boolean }) {
  return (
    <>
      {/* The handle is what tells two Rohans apart. */}
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
          {/* Everyone here is co-signed; say how, without names so the
              line stays short. */}
          {row.cosign && (
            <>
              <span aria-hidden className="text-chalk-faint">·</span>
              <span className={row.cosign.kind === "full" ? "" : "opacity-50"}>
                <Check />
              </span>
              <span className="truncate">
                {row.cosign.kind === "full" ? "fully" : "partially"} co-signed
              </span>
            </>
          )}
        </>
      ) : (
        row.verifiedCount > 0 && (
          <>
            <span aria-hidden className="text-chalk-faint">·</span>
            {/* A dimmed tick for partial: every lift is vouched for, but
                by different people. */}
            <span className={row.cosign?.kind === "full" ? "" : "opacity-50"}>
              <Check />
            </span>
            <span className="truncate">
              {row.cosign
                ? `${row.cosign.kind === "full" ? "fully" : "partially"} co-signed by ${row.cosign.names.join(", ")}`
                : `${row.verifiedCount} of 3 co-signed`}
            </span>
          </>
        )
      )}
    </>
  );
}

function Heading({ text, plate, note }: { text: string; plate?: string; note: string }) {
  return (
    <h2 className="caption mb-2 flex items-center justify-between gap-2">
      {plate ? (
        // A weight-class board wears its plate: the label is filled with it.
        <span className="rounded-sm px-2 py-0.5 text-iron" style={{ background: plate }}>
          {text}
        </span>
      ) : (
        text
      )}
      <span className="text-[11px] font-normal normal-case tracking-normal text-chalk-faint">
        {note}
      </span>
    </h2>
  );
}

/* One line of any board, whatever it ranks. Board and LiftBoard map their
   rows into this, so the podium and the list are drawn in one place. */
type Entry = {
  id: string;
  username: string;
  displayName: string;
  weightClass: string;
  rank: number;
  /** The score as a share of #1's, for the bar under the name. */
  share: number;
  /** The big number, and its unit if it isn't DOTS. */
  value: number;
  decimals: number;
  unit: string | null;
  /** Set on the overall board: the score that flies into a profile. */
  dots: number | null;
  /** Small print under the number. */
  detail: string;
  /** The college, on cross-college boards. */
  where: string | null;
  /** Beside the name, e.g. the batch. */
  tag: React.ReactNode;
  /** The line under the name. */
  sub: React.ReactNode;
};

/*
  A board with medals and at least three people opens with a podium —
  #2, #1, #3 — and the list carries on from #4. Every row has an avatar
  ringed in its weight-class colour, and a thin bar under the name for
  the gap to #1: a column of numbers hides how far apart they are.
*/
function Ranked({
  entries,
  viewerId,
  medals,
}: {
  entries: Entry[];
  viewerId: string | null;
  medals: boolean;
}) {
  const podium = medals && entries.length >= 3;
  const list = podium ? entries.slice(3) : entries;

  return (
    <>
      {podium && <Podium entries={entries.slice(0, 3)} viewerId={viewerId} />}
      {list.length > 0 && (
        <ol className="card px-3">
          {list.map((e, index) => {
            const isViewer = e.id === viewerId;
            const medal = medals && e.rank <= 3 ? MEDALS[e.rank - 1] : null;
            const ring = plateFor(e.weightClass);
            const delay = Math.min(index, 8) * 45;
            return (
              <li
                key={e.id}
                className={`row flex items-center gap-3 border-b border-rule py-3 last:border-b-0 ${
                  isViewer || medal ? "-mx-2 rounded-sm px-2" : ""
                } ${medal ? "medal-row" : isViewer ? "ring-1 ring-accent/60" : ""}`}
                style={medal ? ({ "--medal": medal } as React.CSSProperties) : undefined}
              >
                <Departure arrival={arrivalFor(e)}>
                  {medal ? (
                    <span className="medal shrink-0" style={{ "--medal": medal } as React.CSSProperties}>
                      {e.rank}
                    </span>
                  ) : (
                    <span className="tnum w-6 shrink-0 text-center text-[13px] text-chalk-faint">
                      {e.rank}
                    </span>
                  )}
                  {/* A second way into the profile; the name link is the one
                      a screen reader gets. */}
                  <Link href={`/u/${e.username}`} tabIndex={-1} aria-hidden className="shrink-0">
                    <Morph id={e.id} part="avatar">
                      <Avatar name={e.displayName} ring={ring} />
                    </Morph>
                  </Link>
                  <span className="row-name min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      <Link
                        href={`/u/${e.username}`}
                        className="truncate text-[14px] font-medium underline-offset-4 hover:underline"
                      >
                        {e.displayName}
                      </Link>
                      {e.tag}
                      {isViewer && <YouTag />}
                    </span>
                    <span className="flex min-w-0 items-center gap-1 text-[11px] text-chalk-dim">
                      {e.sub}
                    </span>
                    <span aria-hidden className="mt-1.5 block h-[3px] rounded-full bg-rule">
                      <span
                        className="bar-grow block h-full rounded-full"
                        style={{
                          width: `${Math.max(e.share * 100, 4)}%`,
                          background: ring,
                          animationDelay: `${delay}ms`,
                        }}
                      />
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="tnum block text-[17px] font-bold leading-none">
                      <Score entry={e} delayMs={delay} />
                    </span>
                    <span className="tnum mt-1 block text-[11px] text-chalk-faint">{e.detail}</span>
                  </span>
                </Departure>
              </li>
            );
          })}
        </ol>
      )}
    </>
  );
}

// #2, #1, #3 from left to right, as on a real podium; #1's block tallest.
const PODIUM_ORDER = [1, 0, 2];
const BLOCK_HEIGHT = [84, 60, 44];
// The blocks rise from the floor, #3 first; then the lifters land on them
// and the crown drops onto #1 last.
const BLOCK_DELAY = [200, 100, 0];
const AVATAR_DELAY = [650, 500, 400];

function Podium({ entries, viewerId }: { entries: Entry[]; viewerId: string | null }) {
  return (
    <ol aria-label="Top three" className="mb-3 flex items-end gap-2">
      {PODIUM_ORDER.map((place) => {
        const e = entries[place];
        const medal = MEDALS[e.rank - 1];
        const first = place === 0;
        return (
          <li
            key={e.id}
            className="flex min-w-0 flex-1 flex-col items-center text-center"
            style={{ "--medal": medal } as React.CSSProperties}
          >
            <Departure arrival={arrivalFor(e)}>
              {first && <Crown />}
              <Link
                href={`/u/${e.username}`}
                tabIndex={-1}
                aria-hidden
                className="podium-pop"
                style={{ animationDelay: `${AVATAR_DELAY[place]}ms` }}
              >
                <Morph id={e.id} part="avatar">
                  <Avatar name={e.displayName} ring={medal} size={first ? 64 : 48} />
                </Morph>
              </Link>
              <Link
                href={`/u/${e.username}`}
                aria-label={e.displayName}
                className="mt-2 max-w-full truncate text-[13px] font-bold underline-offset-4 hover:underline"
              >
                {e.displayName.split(/\s+/)[0]}
              </Link>
              {(e.where || e.id === viewerId) && (
                <span className="flex max-w-full items-center gap-1 truncate text-[11px] text-chalk-faint">
                  {e.where}
                  {e.id === viewerId && <YouTag />}
                </span>
              )}
              <span
                className={`display tnum mt-1 leading-none ${first ? "text-[26px]" : "text-[20px]"}`}
                style={{ color: medal }}
              >
                <Score entry={e} delayMs={AVATAR_DELAY[place]} />
              </span>
              <span
                className="podium-block mt-2"
                style={{ height: BLOCK_HEIGHT[place], animationDelay: `${BLOCK_DELAY[place]}ms` }}
              >
                <span className="display tnum text-[28px] leading-none" style={{ color: medal }}>
                  {e.rank}
                </span>
              </span>
            </Departure>
          </li>
        );
      })}
    </ol>
  );
}

function Score({ entry: e, delayMs }: { entry: Entry; delayMs: number }) {
  const number = <Roll value={e.value} decimals={e.decimals} delayMs={delayMs} />;
  return (
    <>
      {e.dots !== null ? (
        <Morph id={e.id} part="score">
          {number}
        </Morph>
      ) : (
        number
      )}
      {e.unit && <span className="text-[12px] font-medium text-chalk-dim"> {e.unit}</span>}
    </>
  );
}

function arrivalFor(e: Entry) {
  return {
    id: e.id,
    username: e.username,
    displayName: e.displayName,
    ring: plateFor(e.weightClass),
    score: e.dots === null ? null : e.dots.toFixed(1),
  };
}

function YouTag() {
  return (
    <span className="shrink-0 rounded-sm bg-accent px-1.5 text-[10px] font-bold uppercase text-iron">
      you
    </span>
  );
}

function Crown() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 16"
      className="crown mb-1 h-4 w-6 text-gold"
      fill="currentColor"
    >
      <path d="M2 4l5 4 5-7 5 7 5-4-2 11H4L2 4z" />
    </svg>
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
  "press inline-flex min-h-11 shrink-0 items-center justify-center whitespace-nowrap rounded-sm bg-gold px-5 text-[15px] font-bold text-iron hover:opacity-85";

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
            <Bone className="h-4 w-6" />
            <span aria-hidden className="block h-9 w-9 shrink-0 animate-pulse rounded-full bg-iron-raised" />
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
          <Link href="/?all" className={footerLink}>
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

/* ------------------------------------------------------------------------
   Per-lift boards: the tab strip and the board itself.
   ------------------------------------------------------------------------ */

export const BOARD_TABS = [
  { id: "all", label: "Everyone" },
  ...MOVEMENTS.map((m) => ({ id: m.id, label: m.label })),
] as const;

export type BoardTab = (typeof BOARD_TABS)[number]["id"];

export function tabFrom(raw: string | undefined): BoardTab {
  return BOARD_TABS.some((t) => t.id === raw) ? (raw as BoardTab) : "all";
}

/* Links, not client state: each tab is a URL, so a bench board can be
   sent to the gym group as easily as the overall one. */
export function BoardTabs({ base, active }: { base: string; active: BoardTab }) {
  return (
    <nav
      aria-label="Boards"
      className="-mx-5 flex gap-1.5 overflow-x-auto px-5 pb-1 [scrollbar-width:none]"
    >
      {BOARD_TABS.map((tab) => {
        const current = tab.id === active;
        return (
          <Link
            key={tab.id}
            href={tab.id === "all" ? base : `${base}?tab=${tab.id}`}
            aria-current={current ? "page" : undefined}
            className={`press inline-flex min-h-9 shrink-0 items-center whitespace-nowrap rounded-full border px-3.5 text-[13px] font-medium transition-colors ${
              current
                ? "border-accent bg-accent text-iron"
                : "border-rule text-chalk-dim hover:border-chalk-faint hover:text-chalk"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function LiftBoard({
  heading,
  movement,
  plate,
  rows,
  rankOf,
  viewerId,
  medals = false,
  showCollege = false,
}: {
  heading: string;
  movement: Movement;
  plate?: string;
  rows: LiftRow[];
  rankOf: (row: LiftRow) => number;
  viewerId: string | null;
  medals?: boolean;
  showCollege?: boolean;
}) {
  const isPullups = movement === "pullups";
  const topScore = rows[0]?.score ?? 0;

  return (
    <section style={plate ? ({ "--accent": plate } as React.CSSProperties) : undefined}>
      <Heading
        text={heading}
        plate={plate}
        note={isPullups ? "ranked by reps" : "ranked by kg, adjusted for bodyweight"}
      />
      <Ranked
        viewerId={viewerId}
        medals={medals}
        entries={rows.map((row) => ({
          id: row.id,
          username: row.username,
          displayName: row.displayName,
          weightClass: row.weightClass,
          rank: rankOf(row),
          share: topScore > 0 ? row.score / topScore : 0,
          // The raw number is what people came to see; the adjusted score,
          // which the rank is actually on, sits under it.
          value: isPullups ? row.reps : (row.kg ?? 0),
          decimals: isPullups ? 0 : 1,
          unit: isPullups ? "reps" : "kg",
          dots: null,
          detail: isPullups ? row.weightClass : `${row.score.toFixed(1)} adj`,
          where: showCollege ? row.collegeShort : null,
          tag: null,
          sub: (
            <>
              <span className="truncate text-chalk-faint">@{row.username}</span>
              {showCollege && (
                <>
                  <span aria-hidden className="text-chalk-faint">·</span>
                  <Link
                    href={`/c/${row.collegeSlug}`}
                    className="truncate underline-offset-4 hover:underline"
                  >
                    {row.collegeShort}
                  </Link>
                </>
              )}
              {row.verified && (
                <>
                  <span aria-hidden className="text-chalk-faint">·</span>
                  <Check />
                  <span>co-signed</span>
                </>
              )}
            </>
          ),
        }))}
      />
    </section>
  );
}

/* One lift tab's whole content: the board, then class boards once a class
   has enough people, or the empty state. Shared by the college and global
   pages so they can't drift. */
export function LiftTab({
  movement,
  rows,
  viewerId,
  viewerClass = null,
  viewerBatch = null,
  showCollege = false,
  emptyNote,
}: {
  movement: Movement;
  rows: LiftRow[];
  viewerId: string | null;
  viewerClass?: string | null;
  /** LNMIIT only: set to show the viewer's batch boards. */
  viewerBatch?: number | null;
  showCollege?: boolean;
  emptyNote: string;
}) {
  const label = MOVEMENTS.find((m) => m.id === movement)?.label ?? movement;

  if (rows.length === 0) {
    return (
      <section className="rise pt-8" style={{ "--i": 1 } as React.CSSProperties}>
        <p className="text-[15px] font-medium">No {label.toLowerCase()} on this board yet.</p>
        <p className="mt-1.5 text-[13px] leading-relaxed text-chalk-dim">{emptyNote}</p>
      </section>
    );
  }

  return (
    <div className="pt-6">
      <div className="rise" style={{ "--i": 1 } as React.CSSProperties}>
        <LiftBoard
          heading={label}
          movement={movement}
          rows={rows}
          rankOf={(r) => r.rank}
          viewerId={viewerId}
          medals
          showCollege={showCollege}
        />
      </div>
      <ClassBoards
        rows={rows}
        viewerClass={viewerClass}
        firstIndex={2}
        render={(weightClass, inClass) => (
          <LiftBoard
            heading={`${label} · ${weightClass}`}
            movement={movement}
            plate={plateFor(weightClass)}
            rows={inClass}
            rankOf={(r) => r.classRank}
            viewerId={viewerId}
            showCollege={showCollege}
          />
        )}
      />
      <BatchBoards
        rows={rows}
        viewerBatch={viewerBatch}
        firstIndex={3}
        render={(year, inBatch) => (
          <LiftBoard
            heading={`${label} · ${batchLabel(year)}`}
            movement={movement}
            rows={inBatch}
            rankOf={rankWithin(inBatch, (r) => r.score)}
            viewerId={viewerId}
            showCollege={showCollege}
          />
        )}
      />
    </div>
  );
}

/*
  The weight-class section, shared by every board page.

  A class gets its own board once it has MIN_CLASS_SIZE lifters; below
  that it would be a repeat of the overall board. The signed-in viewer's
  class comes first so they find themselves without scrolling past a
  class they aren't in — and if their class is still too small, the
  section says so instead of silently leaving it out, which otherwise
  reads as "why am I being shown someone else's class?".
*/
export function ClassBoards<T extends { weightClass: string }>({
  rows,
  viewerClass,
  firstIndex,
  render,
}: {
  rows: T[];
  /** The viewer's weight class, if signed in and on a board. */
  viewerClass: string | null;
  /** The rise animation index to start from. */
  firstIndex: number;
  render: (weightClass: string, inClass: T[]) => React.ReactNode;
}) {
  const ordered = [...WEIGHT_CLASSES].sort((a, b) =>
    a.label === viewerClass ? -1 : b.label === viewerClass ? 1 : 0,
  );
  const sized = ordered.map((wc) => ({
    label: wc.label,
    inClass: rows.filter((r) => r.weightClass === wc.label),
  }));
  const shown = sized.filter((c) => c.inClass.length >= MIN_CLASS_SIZE);
  const mine = sized.find((c) => c.label === viewerClass);
  const mineTooSmall = mine !== undefined && mine.inClass.length < MIN_CLASS_SIZE;

  if (shown.length === 0 && !mineTooSmall) return null;

  return (
    // Closed by default: the overall board is the page, and a dozen class
    // boards underneath turned it into a scroll.
    <details
      className="rise drawer group mt-10"
      style={{ "--i": firstIndex } as React.CSSProperties}
    >
      <summary className={drawerSummary}>
        Weight classes
        <span className="flex items-center gap-2 text-[11px] text-chalk-faint">
          {/* A plate chip per open board, so the colours are visible before opening. */}
          <span aria-hidden className="flex gap-1">
            {shown.map((c) => (
              <span
                key={c.label}
                className="h-2.5 w-2.5 rounded-full"
                style={{ background: plateFor(c.label) }}
              />
            ))}
          </span>
          {shown.length} with {MIN_CLASS_SIZE}+ lifters
          <Chevron />
        </span>
      </summary>
      {mineTooSmall && (
        <p className="mt-3 text-[13px] leading-relaxed text-chalk-dim">
          Your class, {viewerClass}, has {mine.inClass.length} lifter
          {mine.inClass.length === 1 ? "" : "s"} — {MIN_CLASS_SIZE - mine.inClass.length} more and it gets its own board.
        </p>
      )}
      <div className="mt-6 flex flex-col gap-8">
        {shown.map((c, i) => (
          <div
            key={c.label}
            className="rise"
            style={{ "--i": firstIndex + 1 + i } as React.CSSProperties}
          >
            {render(c.label, c.inClass)}
          </div>
        ))}
      </div>
    </details>
  );
}

const drawerSummary =
  "press flex min-h-11 w-full cursor-pointer list-none items-center justify-between gap-2 rounded-sm border border-rule px-3.5 text-[15px] text-chalk-dim hover:border-chalk-faint hover:text-chalk group-open:border-chalk-faint group-open:text-chalk [&::-webkit-details-marker]:hidden";

/*
  LNMIIT only: a board per batch, in the same kind of drawer as the weight
  classes. A signed-in lifter with a batch sees theirs and the one either
  side (Y24 sees Y23–Y25); anyone without one sees no drawer. Empty
  batches are left out. `render` draws one batch's board, like ClassBoards.
*/
export function BatchBoards<T extends { batchYear: number | null }>({
  rows,
  viewerBatch,
  firstIndex,
  render,
}: {
  rows: T[];
  viewerBatch: number | null;
  firstIndex: number;
  render: (year: number, inBatch: T[]) => React.ReactNode;
}) {
  const groups = batchesFor(viewerBatch)
    .map((year) => ({ year, inBatch: rows.filter((r) => r.batchYear === year) }))
    .filter((g) => g.inBatch.length > 0);
  if (groups.length === 0) return null;

  return (
    <details
      className="rise drawer group mt-3"
      style={{ "--i": firstIndex } as React.CSSProperties}
    >
      <summary className={drawerSummary}>
        Batches
        <span className="flex items-center gap-2 text-[11px] text-chalk-faint">
          {groups.map((g) => batchLabel(g.year)).join(" · ")}
          <Chevron />
        </span>
      </summary>
      <div className="mt-6 flex flex-col gap-8">
        {groups.map((g, i) => (
          <div
            key={g.year}
            className="rise"
            style={{ "--i": firstIndex + 1 + i } as React.CSSProperties}
          >
            {render(g.year, g.inBatch)}
          </div>
        ))}
      </div>
    </details>
  );
}

function Chevron() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 16 16"
      className="h-3.5 w-3.5 transition-transform group-open:rotate-180"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m3 6 5 5 5-5" />
    </svg>
  );
}
