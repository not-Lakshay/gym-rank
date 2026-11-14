import { Suspense } from "react";
import Link from "next/link";
import { auth, signIn } from "@/auth";
import { getLeaderboard, type BoardRow } from "@/lib/leaderboard";
import { getLifterByEmail } from "@/lib/lifters";
import { plateFor } from "@/lib/plates";
import { WEIGHT_CLASSES } from "@/lib/scoring";
import { Calculator } from "./calculator";

// A class board with one or two people isn't a ranking, it's a repeat of
// the overall board. Classes appear once they have enough lifters to mean
// something.
const MIN_CLASS_SIZE = 3;

const PLATE_VARS = [
  "--plate-10",
  "--plate-15",
  "--plate-20",
  "--plate-25",
] as const;

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-md px-5 pb-16 pt-10">
      <header className="pb-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-[2.5rem] font-extrabold leading-[0.88] tracking-[-0.045em]">
              Gym Rank
            </h1>
            <p className="mt-2.5 text-[16px] font-bold leading-none tracking-[-0.02em]">
              Strength, not size.
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
          The four competition plate colours in weight order, standing in
          for a rule. The same colours mark each lifter's class below, so
          the divider is a legend rather than a decoration.
        */}
        <div aria-hidden className="mt-5 flex h-1 gap-1">
          {PLATE_VARS.map((plate) => (
            <span
              key={plate}
              className="flex-1 rounded-full"
              style={{ background: `var(${plate})` }}
            />
          ))}
        </div>
      </header>

      <Suspense
        fallback={<p className="pt-8 text-sm text-chalk-faint">Loading board</p>}
      >
        <Boards />
      </Suspense>

      {/* The explanation used to live here as a paragraph. It is a page of
          its own now, and a link people can choose to follow beats four
          sentences everyone scrolls past. */}
      <footer className="mt-14 border-t border-rule pt-2">
        <p className="-ml-2 flex flex-wrap gap-1 text-chalk-faint">
          <Link
            href="/scoring"
            className="inline-flex min-h-11 items-center rounded-sm px-2 text-[14px] underline underline-offset-4"
          >
            How scoring works
          </Link>
          <Link
            href="/privacy"
            className="inline-flex min-h-11 items-center rounded-sm px-2 text-[14px] underline underline-offset-4"
          >
            Privacy
          </Link>
          <Link
            href="/terms"
            className="inline-flex min-h-11 items-center rounded-sm px-2 text-[14px] underline underline-offset-4"
          >
            Terms
          </Link>
        </p>
      </footer>
    </main>
  );
}

async function AccountLink() {
  const session = await auth();

  if (session?.user) {
    return (
      <Link href="/me" className={button}>
        Your lifts
      </Link>
    );
  }

  return (
    <form
      action={async () => {
        "use server";
        await signIn("google", { redirectTo: "/me" });
      }}
    >
      <button type="submit" className={button}>
        Add yours
      </button>
    </form>
  );
}

async function Boards() {
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
        <form
          action={async () => {
            "use server";
            await signIn("google", { redirectTo: "/me" });
          }}
        >
          <button type="submit" className={button}>
            Save it
          </button>
        </form>
      }
    />
  );

  if (rows.length === 0) {
    return (
      <section className="pt-10">
        <p className="text-[15px] font-medium">Nobody on the board yet.</p>
        <p className="mt-1.5 text-[13px] leading-relaxed text-chalk-dim">
          A score needs a squat, a bench and a deadlift. Enter all three and
          you are first by default.
        </p>
        {calculator}
      </section>
    );
  }

  return (
    <div className="pt-8">
      <Board
        heading="Everyone"
        rows={rows}
        rankOf={(r) => r.overallRank}
        viewerId={viewer?.id ?? null}
      />

      {calculator}

      <div className="mt-10 flex flex-col gap-8">
        {WEIGHT_CLASSES.map((weightClass) => {
          const inClass = rows.filter(
            (r) => r.weightClass === weightClass.label,
          );
          if (inClass.length < MIN_CLASS_SIZE) return null;
          return (
            <Board
              key={weightClass.label}
              heading={weightClass.label}
              plate={plateFor(weightClass.label)}
              rows={inClass}
              rankOf={(r) => r.classRank}
              viewerId={viewer?.id ?? null}
            />
          );
        })}
      </div>
    </div>
  );
}

function Board({
  heading,
  plate,
  rows,
  rankOf,
  viewerId,
}: {
  heading: string;
  plate?: string;
  rows: BoardRow[];
  rankOf: (row: BoardRow) => number;
  viewerId: string | null;
}) {
  // Rows arrive sorted by DOTS descending, so the first is the yardstick
  // every bar below is measured against.
  const topDots = rows[0]?.dots ?? 0;

  return (
    <section>
      <h2 className="mb-2 flex items-center gap-2 text-[13px] font-medium text-chalk-dim">
        {plate && (
          <span
            aria-hidden
            className="h-2.5 w-2.5 rounded-full"
            style={{ background: plate }}
          />
        )}
        {heading}
      </h2>

      <ol>
        {rows.map((row, index) => {
          const rank = rankOf(row);
          const leading = rank === 1;
          const isViewer = row.id === viewerId;

          // How this score reads against the leader's. A leaderboard is a
          // ranking of magnitudes, and a column of numbers hides that —
          // the bar is the only element here that shows the gaps.
          const share = topDots > 0 ? row.dots / topDots : 0;

          return (
            <li
              key={row.id}
              className="relative flex items-center gap-3 border-b border-rule py-3 transition-colors last:border-b-0 hover:bg-iron-raised"
            >
              <span
                aria-hidden
                className="bar-grow pointer-events-none absolute inset-y-px left-0 rounded-sm"
                style={{
                  width: `${Math.max(share * 100, 6)}%`,
                  background: plateFor(row.weightClass),
                  opacity: leading ? 0.17 : 0.08,
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

              <span
                className={`tnum relative w-5 shrink-0 text-right ${
                  leading
                    ? "text-[15px] font-bold text-chalk"
                    : "text-[13px] font-normal text-chalk-faint"
                }`}
              >
                {rank}
              </span>

              <span className="relative min-w-0 flex-1">
                <span className="flex items-center gap-1.5">
                  <Link
                    href={`/lifter/${row.id}`}
                    className={`truncate hover:underline underline-offset-4 ${
                      leading
                        ? "text-[15px] font-bold"
                        : "text-[14px] font-medium"
                    }`}
                  >
                    {row.displayName}
                  </Link>
                  {isViewer && (
                    <span className="shrink-0 rounded-sm border border-chalk-faint px-1.5 text-[10px] font-medium uppercase text-chalk-dim">
                      you
                    </span>
                  )}
                </span>
                {row.verifiedCount > 0 && (
                  <span className="text-[11px] text-chalk-faint">
                    {row.verifiedCount === 3
                      ? "co-signed"
                      : `${row.verifiedCount}/3 co-signed`}
                  </span>
                )}
              </span>

              <span className="relative shrink-0 text-right">
                <span
                  className={`tnum block leading-none ${
                    leading ? "text-[22px] font-extrabold" : "text-[17px] font-bold"
                  }`}
                >
                  {row.dots.toFixed(1)}
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

const button =
  "inline-flex min-h-11 shrink-0 items-center justify-center rounded-sm bg-chalk px-5 text-[15px] font-bold text-iron transition-opacity hover:opacity-85";
