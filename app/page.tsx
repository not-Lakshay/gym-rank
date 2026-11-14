import { Suspense } from "react";
import Link from "next/link";
import { auth, signIn } from "@/auth";
import { getLeaderboard, type BoardRow } from "@/lib/leaderboard";
import { plateFor } from "@/lib/plates";
import { WEIGHT_CLASSES } from "@/lib/scoring";

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-md px-5 pb-16 pt-10">
      <header className="flex items-end justify-between gap-4 border-b border-rule pb-5">
        <div>
          <h1 className="text-[2rem] font-extrabold leading-none tracking-[-0.03em]">
            Gym Rank
          </h1>
          <p className="mt-1.5 text-[13px] leading-snug text-chalk-dim">
            LNMIIT gym, scored pound for pound
          </p>
        </div>
        <Suspense fallback={null}>
          <AccountLink />
        </Suspense>
      </header>

      <Suspense
        fallback={<p className="pt-8 text-sm text-chalk-faint">Loading board</p>}
      >
        <Boards />
      </Suspense>

      <footer className="mt-14 border-t border-rule pt-5 text-[12px] leading-relaxed text-chalk-faint">
        <p>
          A score is your squat, bench and deadlift total adjusted for
          bodyweight using DOTS, so a 60kg lifter and a 90kg lifter can be
          compared directly. Your bodyweight is never shown — only the class.
        </p>
        <p className="-ml-2 mt-1 flex gap-1">
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
  const rows = await getLeaderboard();

  if (rows.length === 0) {
    return (
      <section className="pt-10">
        <p className="text-[15px] font-medium">Nobody on the board yet.</p>
        <p className="mt-1.5 text-[13px] leading-relaxed text-chalk-dim">
          A score needs a squat, a bench and a deadlift. Enter all three and
          you are first by default.
        </p>
      </section>
    );
  }

  return (
    <div className="pt-8">
      <Board heading="Everyone" rows={rows} rankOf={(r) => r.overallRank} />

      <div className="mt-10 flex flex-col gap-8">
        {WEIGHT_CLASSES.map((weightClass) => {
          const inClass = rows.filter(
            (r) => r.weightClass === weightClass.label,
          );
          if (inClass.length === 0) return null;
          return (
            <Board
              key={weightClass.label}
              heading={weightClass.label}
              plate={plateFor(weightClass.label)}
              rows={inClass}
              rankOf={(r) => r.classRank}
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
}: {
  heading: string;
  plate?: string;
  rows: BoardRow[];
  rankOf: (row: BoardRow) => number;
}) {
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
        {rows.map((row) => {
          const rank = rankOf(row);
          const leading = rank === 1;

          return (
            <li
              key={row.id}
              className="flex items-center gap-3 border-b border-rule py-3 last:border-b-0"
            >
              <span
                aria-hidden
                className="h-9 w-[3px] shrink-0 rounded-full"
                style={{
                  background: plateFor(row.weightClass),
                  opacity: leading ? 1 : 0.35,
                }}
              />

              <span
                className={`tnum w-5 shrink-0 text-right ${
                  leading
                    ? "text-[15px] font-bold text-chalk"
                    : "text-[13px] font-normal text-chalk-faint"
                }`}
              >
                {rank}
              </span>

              <span className="min-w-0 flex-1">
                <span
                  className={`block truncate ${
                    leading ? "text-[15px] font-bold" : "text-[14px] font-medium"
                  }`}
                >
                  {row.displayName}
                </span>
                {row.verifiedCount === 3 && (
                  <span className="text-[11px] text-chalk-faint">
                    co-signed
                  </span>
                )}
              </span>

              <span className="shrink-0 text-right">
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
