import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { auth } from "@/auth";
import { getLeaderboard, getLiftBoards } from "@/lib/leaderboard";
import { getLifterByEmail } from "@/lib/lifters";
import { plateFor } from "@/lib/plates";
import { weightClassFor } from "@/lib/scoring";
import {
  Board,
  BoardSkeleton,
  BoardTabs,
  ChevronLeft,
  ClassBoards,
  Footer,
  LiftTab,
  Stats,
  navButton,
  tabFrom,
} from "@/app/board";
import { TabBar } from "@/app/tab-bar";

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
type SearchParams = Promise<{ tab?: string }>;

export default function GlobalPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <>
    <main className="mx-auto w-full max-w-md px-5 pb-16 pt-10">
      <Link href="/?all" className={navButton}>
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

      <Suspense fallback={<BoardSkeleton />}>
        <GlobalBoard searchParams={searchParams} />
      </Suspense>

      <Footer />
    </main>
    <TabBar active="global" />
    </>
  );
}

async function GlobalBoard({ searchParams }: { searchParams: SearchParams }) {
  await connection();
  const { tab: rawTab } = await searchParams;
  const tab = tabFrom(rawTab);
  const [rows, liftBoards, session] = await Promise.all([
    getLeaderboard({ global: true }),
    getLiftBoards({ global: true }),
    auth(),
  ]);
  const viewer = session?.user?.email
    ? await getLifterByEmail(session.user.email).catch(() => null)
    : null;
  const viewerClass = viewer ? weightClassFor(viewer.bodyweightKg) : null;

  const tabs = (
    <div className="rise pt-6" style={{ "--i": 1 } as React.CSSProperties}>
      <BoardTabs base="/global" active={tab} />
    </div>
  );

  // A lift tab on the global board admits a co-signed lift, not a fully
  // co-signed lifter: the rule is per number shown, and here each row is
  // one number.
  if (tab !== "all") {
    return (
      <>
        {tabs}
        <LiftTab
          movement={tab}
          rows={liftBoards[tab]}
          viewerId={viewer?.id ?? null}
          viewerClass={viewerClass}
          showCollege
          emptyNote="Only co-signed lifts appear here. Get someone at your college who watched the set to vouch for it."
        />
      </>
    );
  }

  if (rows.length === 0) {
    return (
      <>
        {tabs}
        <p className="pt-8 text-[13px] leading-relaxed text-chalk-dim">
          Nobody is fully co-signed yet. The first lifter to get all three sets
          vouched for opens this board.
        </p>
      </>
    );
  }

  return (
    <div className="pt-6">
      {tabs}
      <div className="rise mb-6" style={{ "--i": 1 } as React.CSSProperties}>
        <Stats rows={rows} />
      </div>

      <div className="rise" style={{ "--i": 2 } as React.CSSProperties}>
        <Board
          heading="Overall"
          rows={rows}
          rankOf={(r) => r.overallRank}
          viewerId={viewer?.id ?? null}
          medals
          showCollege
        />
      </div>

      <ClassBoards
        rows={rows}
        viewerClass={viewerClass}
        firstIndex={3}
        render={(weightClass, inClass) => (
          <Board
            heading={weightClass}
            plate={plateFor(weightClass)}
            rows={inClass}
            rankOf={(r) => r.classRank}
            viewerId={viewer?.id ?? null}
            showCollege
          />
        )}
      />
    </div>
  );
}
