import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { auth } from "@/auth";
import { getLeaderboard } from "@/lib/leaderboard";
import { getLifterByEmail } from "@/lib/lifters";
import { plateFor } from "@/lib/plates";
import { WEIGHT_CLASSES } from "@/lib/scoring";
import {
  Board,
  ChevronLeft,
  Footer,
  MIN_CLASS_SIZE,
  Stats,
  navButton,
} from "@/app/board";

export const metadata = {
  title: "Global board — Gym Rank",
  description:
    "Every college together. Only lifters with all three lifts co-signed.",
};

/*
  The board across colleges. A campus board polices itself; this one can't,
  so it admits only lifters whose squat, bench and deadlift were each
  co-signed by someone at their college who watched the set. That is the
  reward for getting co-signed, and the reason to trust what's here.
*/
export default function GlobalPage() {
  return (
    <main className="mx-auto w-full max-w-md px-5 pb-16 pt-10">
      <Link href="/" className={navButton}>
        <ChevronLeft />
        All colleges
      </Link>

      <header className="rise pt-8" style={{ "--i": 0 } as React.CSSProperties}>
        <h1 className="text-[2.25rem] font-extrabold leading-[0.9] tracking-[-0.04em]">
          Global board
        </h1>
        <p className="mt-2 text-[13px] leading-relaxed text-chalk-dim">
          Every college together. Only lifters with all three lifts co-signed
          by someone who watched them — the one board where every number has
          a witness.
        </p>
      </header>

      <Suspense
        fallback={<p className="pt-8 text-sm text-chalk-faint">Loading board</p>}
      >
        <GlobalBoard />
      </Suspense>

      <Footer />
    </main>
  );
}

async function GlobalBoard() {
  await connection();
  const [rows, session] = await Promise.all([
    getLeaderboard({ global: true }),
    auth(),
  ]);
  const viewer = session?.user?.email
    ? await getLifterByEmail(session.user.email).catch(() => null)
    : null;

  if (rows.length === 0) {
    return (
      <p className="pt-8 text-[13px] leading-relaxed text-chalk-dim">
        Nobody is fully co-signed yet. The first lifter to get all three sets
        vouched for opens this board.
      </p>
    );
  }

  return (
    <div className="pt-6">
      <div className="rise mb-6" style={{ "--i": 1 } as React.CSSProperties}>
        <Stats rows={rows} />
      </div>

      <div className="rise" style={{ "--i": 2 } as React.CSSProperties}>
        <Board
          heading="Everyone, everywhere"
          rows={rows}
          rankOf={(r) => r.overallRank}
          viewerId={viewer?.id ?? null}
          medals
          showCollege
        />
      </div>

      <div className="mt-10 flex flex-col gap-8">
        {WEIGHT_CLASSES.map((weightClass, i) => {
          const inClass = rows.filter((r) => r.weightClass === weightClass.label);
          if (inClass.length < MIN_CLASS_SIZE) return null;
          return (
            <div
              key={weightClass.label}
              className="rise"
              style={{ "--i": 3 + i } as React.CSSProperties}
            >
              <Board
                heading={weightClass.label}
                plate={plateFor(weightClass.label)}
                rows={inClass}
                rankOf={(r) => r.classRank}
                viewerId={viewer?.id ?? null}
                showCollege
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
