import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { auth } from "@/auth";
import { getLeaderboard, type BoardRow } from "@/lib/leaderboard";
import { getLifterByEmail } from "@/lib/lifters";
import { plateFor } from "@/lib/plates";
import { WEIGHT_CLASSES } from "@/lib/scoring";
import { Calculator } from "./calculator";
import { CountUp } from "./score";
import { SignInForm } from "./sign-in";

// A class board with one or two people isn't a ranking, it's a repeat of
// the overall board. Classes appear once they have enough lifters to mean
// something.
const MIN_CLASS_SIZE = 3;

const MEDALS = ["var(--gold)", "var(--silver)", "var(--bronze)"];

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-md px-5 pb-16 pt-10">
      <header className="rise pb-5" style={{ "--i": 0 } as React.CSSProperties}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-[2.5rem] font-extrabold leading-[0.88] tracking-[-0.045em]">
              Gym Rank
            </h1>
            <p className="mt-2.5 text-[16px] font-bold leading-none tracking-[-0.02em]">
              Pound for pound.
            </p>
            <p className="mt-2 text-[13px] leading-snug text-chalk-dim">
              LNMIIT gym · every score adjusted for bodyweight
            </p>
          </div>
          <Suspense fallback={null}>
            <AccountLink />
          </Suspense>
        </div>

        {/*
          The weight classes, each in its plate colour. The same colour
          marks every lifter's row below, so this is the legend for the
          whole board rather than a rule.
        */}
        <ul className="mt-5 flex gap-1.5 text-[11px] font-medium text-chalk-dim">
          {WEIGHT_CLASSES.map((weightClass) => (
            <li
              key={weightClass.label}
              className="flex flex-1 flex-col gap-1.5"
            >
              <span
                aria-hidden
                className="h-1 rounded-full"
                style={{ background: plateFor(weightClass.label) }}
              />
              <span className="tnum whitespace-nowrap">
                {shortClass(weightClass.label)}
              </span>
            </li>
          ))}
        </ul>
      </header>

      <Suspense
        fallback={<p className="pt-8 text-sm text-chalk-faint">Loading board</p>}
      >
        <Boards />
      </Suspense>

      <footer
        className="rise mt-14 border-t border-rule pt-2"
        style={{ "--i": 6 } as React.CSSProperties}
      >
        <p className="-ml-2 flex flex-wrap gap-1 text-chalk-dim">
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
    </main>
  );
}

function shortClass(label: string) {
  if (label.startsWith("Up to")) return "≤65 kg";
  if (label.endsWith("+")) return "85 kg+";
  return label.replace("kg", " kg");
}

// auth() reads cookies, but touches crypto synchronously first; without an
// explicit dynamic access ahead of it the prerender trips on the random bytes.
async function AccountLink() {
  await connection();
  const session = await auth();

  if (session?.user) {
    return (
      <Link href="/me" className={button}>
        Your lifts
      </Link>
    );
  }

  return <SignInForm redirectTo="/me" label="Add yours" className={button} />;
}

async function Boards() {
  await connection();
  const [rows, session] = await Promise.all([getLeaderboard(), auth()]);

  // Which row is yours. On a board of forty names, finding yourself is the
  // thing people do first and it should not require reading.
  const viewer = session?.user?.email
    ? await getLifterByEmail(session.user.email).catch(() => null)
    : null;

  const calculator = session?.user ? null : (
    <Calculator
      boardDots={rows.map((r) => r.dots)}
      signInForm={
        <SignInForm redirectTo="/me" label="Save it" className={button} />
      }
    />
  );

  if (rows.length === 0) {
    return (
      <section className="rise pt-10" style={{ "--i": 1 } as React.CSSProperties}>
        <p className="text-[15px] font-medium">Nobody on the board yet.</p>
        <p className="mt-1.5 text-[13px] leading-relaxed text-chalk-dim">
          A score needs a squat, a bench and a deadlift. Enter all three and
          you are first by default.
        </p>
        {calculator}
      </section>
    );
  }

  const totalKg = rows.reduce((sum, r) => sum + r.totalKg, 0);
  const cosigned = rows.filter((r) => r.verifiedCount === 3).length;

  return (
    <div className="pt-6">
      {/* The board in three numbers. Gives the page a pulse before the list. */}
      <dl
        className="rise mb-6 grid grid-cols-3 gap-px overflow-hidden rounded-sm border border-rule bg-rule"
        style={{ "--i": 1 } as React.CSSProperties}
      >
        <Stat label="lifters" value={rows.length} />
        <Stat label="kg on the board" value={totalKg} />
        <Stat label="fully co-signed" value={cosigned} />
      </dl>

      <div className="rise" style={{ "--i": 2 } as React.CSSProperties}>
        <Board
          heading="Everyone"
          rows={rows}
          rankOf={(r) => r.overallRank}
          viewerId={viewer?.id ?? null}
          medals
        />
      </div>

      <div className="rise" style={{ "--i": 3 } as React.CSSProperties}>
        {calculator}
      </div>

      <div className="mt-10 flex flex-col gap-8">
        {WEIGHT_CLASSES.map((weightClass, i) => {
          const inClass = rows.filter(
            (r) => r.weightClass === weightClass.label,
          );
          if (inClass.length < MIN_CLASS_SIZE) return null;
          return (
            <div
              key={weightClass.label}
              className="rise"
              style={{ "--i": 4 + i } as React.CSSProperties}
            >
              <Board
                heading={weightClass.label}
                plate={plateFor(weightClass.label)}
                rows={inClass}
                rankOf={(r) => r.classRank}
                viewerId={viewer?.id ?? null}
              />
            </div>
          );
        })}
      </div>
    </div>
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

function Board({
  heading,
  plate,
  rows,
  rankOf,
  viewerId,
  medals = false,
}: {
  heading: string;
  plate?: string;
  rows: BoardRow[];
  rankOf: (row: BoardRow) => number;
  viewerId: string | null;
  medals?: boolean;
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
                    href={`/lifter/${row.id}`}
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
                {row.verifiedCount > 0 && (
                  <span className="flex items-center gap-1 text-[11px] text-chalk-dim">
                    <Check />
                    {row.verifiedCount === 3
                      ? "all lifts co-signed"
                      : `${row.verifiedCount} of 3 co-signed`}
                  </span>
                )}
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

function Check() {
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

const button =
  "press inline-flex min-h-11 shrink-0 items-center justify-center whitespace-nowrap rounded-sm bg-chalk px-5 text-[15px] font-bold text-iron hover:opacity-85";

const footerLink =
  "inline-flex min-h-11 items-center rounded-sm px-2 text-[14px] underline decoration-chalk-faint underline-offset-4 transition-colors hover:text-chalk";
