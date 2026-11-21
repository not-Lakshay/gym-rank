import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { auth } from "@/auth";
import { leaderboard, liftBoardsFor } from "@/lib/cached";
import { friendCount, incomingRequests } from "@/lib/friends";
import { getLifterByEmail } from "@/lib/lifters";
import { plateFor } from "@/lib/plates";
import { weightClassFor } from "@/lib/scoring";
import {
  Board,
  BoardSkeleton,
  BoardTabs,
  ChevronLeft,
  ChevronRight,
  ClassBoards,
  Footer,
  LiftTab,
  button,
  navButton,
  tabFrom,
} from "@/app/board";
import { SignInForm } from "@/app/sign-in";
import { TabBar } from "@/app/tab-bar";
import { TrustHelp } from "@/app/help";

export const metadata = { title: "Friends board — Gym Rank", robots: { index: false } };

/*
  You and your friends (lib/friends.ts), from any college. Like a
  college board, it ranks everyone with a full squat/bench/deadlift total;
  co-signs aren't required, since you know these people.
*/
type SearchParams = Promise<{ tab?: string }>;

export default function FriendsPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <>
      <main className="mx-auto w-full max-w-md px-5 pb-16 pt-10">
        <Link href="/me" className={navButton}>
          <ChevronLeft />
          You
        </Link>
        <header className="rise pt-8" style={{ "--i": 0 } as React.CSSProperties}>
          <h1 className="text-[2.25rem] font-extrabold leading-[0.9] tracking-[-0.04em]">
            Friends board
          </h1>
          <p className="mt-2 text-[14px] leading-relaxed text-chalk-dim">
            You and your friends, from any college.
          </p>
        </header>

        <Suspense fallback={<BoardSkeleton />}>
          <FriendsBoard searchParams={searchParams} />
        </Suspense>

        <Footer />
      </main>
      <TabBar active="you" />
    </>
  );
}

function Note({ text, children }: { text: string; children?: React.ReactNode }) {
  return (
    <div
      className="rise mt-6 flex flex-col items-start gap-4 rounded-sm border border-rule bg-iron-raised p-5"
      style={{ "--i": 1 } as React.CSSProperties}
    >
      <p className="text-[14px] leading-relaxed text-chalk-dim">{text}</p>
      {children}
    </div>
  );
}

const HOW_TO_ADD =
  "To add a friend, open their profile from any board and tap “+ Add friend”. They join once they accept.";

async function FriendsBoard({ searchParams }: { searchParams: SearchParams }) {
  await connection();
  const email = (await auth())?.user?.email;
  if (!email) {
    return (
      <Note text="Sign in to build a board of just you and your gym crew.">
        <SignInForm redirectTo="/friends" label="Sign in" className={button} />
      </Note>
    );
  }

  const viewer = await getLifterByEmail(email).catch(() => null);
  if (!viewer) {
    return (
      <Note text="Set up your profile first, then add friends from their profiles.">
        <Link href="/me" className={button}>
          Set up profile
        </Link>
      </Note>
    );
  }

  const scope = { friendsOf: viewer.id };
  const { tab: rawTab } = await searchParams;
  const tab = tabFrom(rawTab);
  const [rows, liftBoards, friends, requests] = await Promise.all([
    leaderboard(scope),
    liftBoardsFor(scope),
    friendCount(viewer.id).catch(() => 0),
    incomingRequests(viewer.id).catch(() => []),
  ]);

  // Requests waiting on you are answered on the notifications page.
  const waiting = requests.length > 0 && (
    <Link
      href="/notifications"
      className="rise mt-6 flex items-center justify-between rounded-sm border border-chalk-faint bg-iron-raised px-4 py-3 text-[14px] text-chalk"
      style={{ "--i": 1 } as React.CSSProperties}
    >
      <span>
        <span className="font-bold">
          {requests.length} friend {requests.length === 1 ? "request" : "requests"}
        </span>
        <span className="text-chalk-dim"> waiting for you</span>
      </span>
      <ChevronRight />
    </Link>
  );

  if (friends === 0) {
    return (
      <>
        {waiting}
        <Note text={`No friends yet. ${HOW_TO_ADD}`} />
      </>
    );
  }

  const viewerClass = weightClassFor(viewer.bodyweightKg);
  const tabs = (
    <>
      {waiting}
      <div className="rise pt-6" style={{ "--i": 1 } as React.CSSProperties}>
        <BoardTabs base="/friends" active={tab} />
      </div>
    </>
  );
  const hint = (
    <p className="pt-6 text-[12px] leading-relaxed text-chalk-faint">
      {friends} {friends === 1 ? "friend" : "friends"}. {HOW_TO_ADD}
    </p>
  );

  if (tab !== "all") {
    return (
      <>
        {tabs}
        <LiftTab
          movement={tab}
          rows={liftBoards[tab]}
          viewerId={viewer.id}
          viewerClass={viewerClass}
          showCollege
          emptyNote="Nobody here has entered this lift yet."
        />
        {hint}
      </>
    );
  }

  if (rows.length === 0) {
    return (
      <>
        {tabs}
        <Note text="Nobody here has a full squat, bench and deadlift total yet. The lift tabs above show what's been entered so far." />
        {hint}
      </>
    );
  }

  return (
    <div className="pt-6">
      {tabs}
      <div className="rise" style={{ "--i": 2 } as React.CSSProperties}>
        <Board
          heading="Overall"
          rows={rows}
          rankOf={(r) => r.overallRank}
          viewerId={viewer.id}
          medals
          showCollege
          badgeHelp
        />
        <TrustHelp />
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
            viewerId={viewer.id}
            showCollege
          />
        )}
      />
      {hint}
    </div>
  );
}
