import { Suspense } from "react";
import Link from "next/link";
import { auth, signIn } from "@/auth";
import { getLeaderboard, type BoardRow } from "@/lib/leaderboard";
import { WEIGHT_CLASSES } from "@/lib/scoring";

/**
 * Public leaderboard. Deliberately readable without signing in — a login
 * wall is where visitors leave, and anyone evaluating this (a recruiter,
 * someone at the gym deciding whether to bother) should see a populated
 * board first and sign in second.
 */
export default function Home() {
  return (
    <main className="mx-auto flex min-h-full w-full max-w-md flex-col gap-8 px-5 py-10">
      <header className="flex flex-col gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Gym Rank</h1>
          <p className="text-sm text-black/55 dark:text-white/55">
            Bodyweight-adjusted lifting leaderboard for the LNMIIT gym.
          </p>
        </div>
        <Suspense fallback={null}>
          <AccountLink />
        </Suspense>
      </header>

      <Suspense fallback={<p className="text-sm text-black/45">Loading board…</p>}>
        <Boards />
      </Suspense>

      <footer className="text-xs leading-relaxed text-black/40 dark:text-white/40">
        Scores use DOTS, which adjusts a squat+bench+deadlift total for
        bodyweight so lifters of different sizes compare fairly. Bodyweight
        itself is never shown — only the weight class.
      </footer>
    </main>
  );
}

async function AccountLink() {
  const session = await auth();

  if (session?.user) {
    return (
      <Link href="/me" className={primaryButton}>
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
      <button type="submit" className={primaryButton}>
        Add your lifts
      </button>
    </form>
  );
}

async function Boards() {
  const rows = await getLeaderboard();

  if (rows.length === 0) {
    return (
      <section className="rounded-2xl border border-dashed border-black/15 p-6 text-center dark:border-white/20">
        <p className="text-sm font-medium">No scores yet.</p>
        <p className="mt-1 text-sm text-black/55 dark:text-white/55">
          A score needs a squat, bench and deadlift entered. Be the first.
        </p>
      </section>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <Board title="Overall" rows={rows} rankOf={(r) => r.overallRank} />

      {WEIGHT_CLASSES.map((weightClass) => {
        const inClass = rows.filter((r) => r.weightClass === weightClass.label);
        if (inClass.length === 0) return null;
        return (
          <Board
            key={weightClass.label}
            title={weightClass.label}
            rows={inClass}
            rankOf={(r) => r.classRank}
          />
        );
      })}
    </div>
  );
}

function Board({
  title,
  rows,
  rankOf,
}: {
  title: string;
  rows: BoardRow[];
  rankOf: (row: BoardRow) => number;
}) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-xs font-medium uppercase tracking-wide text-black/50 dark:text-white/50">
        {title}
      </h2>

      <ol className="flex flex-col gap-1">
        {rows.map((row) => (
          <li
            key={row.id}
            className="flex items-center gap-3 rounded-xl border border-black/10 px-4 py-3 dark:border-white/15"
          >
            <span className="w-6 shrink-0 text-sm tabular-nums text-black/45 dark:text-white/45">
              {rankOf(row)}
            </span>

            <span className="flex-1 truncate text-sm font-medium">
              {row.displayName}
              {row.verifiedCount === 3 && (
                <span
                  className="ml-1.5 text-xs text-black/40 dark:text-white/40"
                  title="All three lifts co-signed"
                >
                  verified
                </span>
              )}
            </span>

            <span className="shrink-0 text-right">
              <span className="block text-sm font-semibold tabular-nums">
                {row.dots.toFixed(1)}
              </span>
              <span className="block text-[11px] tabular-nums text-black/40 dark:text-white/40">
                {row.totalKg.toFixed(0)}kg
              </span>
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}

const primaryButton =
  "inline-block w-fit rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-opacity hover:opacity-85";
