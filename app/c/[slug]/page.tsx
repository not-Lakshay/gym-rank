import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { EncryptedText } from "@/components/ui/encrypted-text";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { auth } from "@/auth";
import { getCollegeBySlug, type College } from "@/lib/colleges";
import { getLeaderboard, getLiftBoards } from "@/lib/leaderboard";
import { getLifterByEmail } from "@/lib/lifters";
import { plateFor } from "@/lib/plates";
import { WEIGHT_CLASSES, weightClassFor } from "@/lib/scoring";
import { BATCH_COLLEGE, batchLabel } from "@/lib/batch";
import {
  BatchBoards,
  Board,
  BoardSkeleton,
  BoardTabs,
  Bone,
  ChevronLeft,
  ClassBoards,
  Footer,
  LiftTab,
  Stats,
  button,
  rankWithin,
  navButton,
  shortClass,
  tabFrom,
} from "@/app/board";
import { Calculator } from "@/app/calculator";
import { SignInForm } from "@/app/sign-in";

type Params = Promise<{ slug: string }>;
type SearchParams = Promise<{ tab?: string }>;

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { slug } = await params;
  const college = await getCollegeBySlug(slug).catch(() => null);
  if (!college) return { title: "Gym Rank" };
  const title = `${college.shortName} — Gym Rank`;
  const description = `The ${college.shortName} gym leaderboard, every score adjusted for bodyweight.`;
  return {
    title,
    description,
    openGraph: { title, description },
    twitter: { title, description },
  };
}

/*
  One college's board — the page the project started as. Everything on it
  is scoped to the college in the URL: the ranks, the class boards, the
  calculator's projected rank, and where "Add yours" sends you.
*/
// `params` is awaited inside the Suspense boundary, not here: with Cache
// Components, reading it in the page shell blocks prerendering of the shell.
export default function CollegePage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  return (
    <main className="mx-auto w-full max-w-md px-5 pb-16 pt-10">
      <Suspense
        fallback={
          <>
            <Bone className="h-11 w-36" />
            <Bone className="mt-6 h-9 w-40" />
            <Bone className="mt-3 h-4 w-32" />
            <BoardSkeleton />
          </>
        }
      >
        <CollegeBoard params={params} searchParams={searchParams} />
      </Suspense>
      <Footer />
    </main>
  );
}

async function CollegeBoard({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  await connection();
  const [{ slug }, { tab: rawTab }] = await Promise.all([params, searchParams]);
  const tab = tabFrom(rawTab);
  const college = await getCollegeBySlug(slug).catch(() => null);
  if (!college) notFound();

  // Both boards in parallel: the overall one feeds the stats strip and the
  // calculator's projected rank whichever tab is showing.
  const [rows, liftBoards, session] = await Promise.all([
    getLeaderboard({ collegeId: college.id }),
    getLiftBoards({ collegeId: college.id }),
    auth(),
  ]);

  // Which row is yours. On a board of forty names, finding yourself is the
  // thing people do first and it should not require reading.
  const viewer = session?.user?.email
    ? await getLifterByEmail(session.user.email).catch(() => null)
    : null;
  const viewerClass = viewer ? weightClassFor(viewer.bodyweightKg) : null;

  // Sign-in from this page lands on /me with this college preselected, so
  // a friend who was sent the IIT Delhi link ends up on IIT Delhi's board.
  const redirectTo = `/me?college=${college.slug}`;
  const accountLink = session?.user ? (
    <Link href="/me" className={button}>
      Your lifts
    </Link>
  ) : (
    <SignInForm redirectTo={redirectTo} label="Add yours" className={button} />
  );

  const calculator = session?.user ? null : (
    <Calculator
      boardDots={rows.map((r) => r.dots)}
      signInForm={
        <SignInForm redirectTo={redirectTo} label="Save it" className={button} />
      }
    />
  );

  return (
    <div>
      <Header college={college} accountLink={accountLink} />

      <div className="rise pt-1" style={{ "--i": 1 } as React.CSSProperties}>
        <BoardTabs base={`/c/${college.slug}`} active={tab} />
      </div>

      {tab !== "all" ? (
        <LiftTab
          movement={tab}
          rows={liftBoards[tab]}
          viewerId={viewer?.id ?? null}
          viewerClass={viewerClass}
          viewerBatch={college.slug === BATCH_COLLEGE ? viewer?.batchYear ?? null : null}
          emptyNote={`One entry puts you on it. Sign in, enter your ${
            tab === "pullups" ? "max reps" : "last working set"
          }, and you are first at ${college.shortName} by default.`}
        />
      ) : rows.length === 0 ? (
        <section className="rise pt-8" style={{ "--i": 1 } as React.CSSProperties}>
          <p className="text-[15px] font-medium">
            Nobody at {college.shortName} is on the board yet.
          </p>
          <p className="mt-1.5 text-[13px] leading-relaxed text-chalk-dim">
            A score needs a squat, a bench and a deadlift. Enter all three and
            you are first by default — then send the link to the gym group.
          </p>
          {calculator}
        </section>
      ) : (
        <div className="pt-6">
          <div className="rise mb-6" style={{ "--i": 1 } as React.CSSProperties}>
            <Stats rows={rows} />
          </div>

          <div className="rise" style={{ "--i": 2 } as React.CSSProperties}>
            <Board
              heading="Everyone"
              rows={rows}
              rankOf={(r) => r.overallRank}
              viewerId={viewer?.id ?? null}
              medals
              showBatch={college.slug === BATCH_COLLEGE}
            />
          </div>

          <div className="rise" style={{ "--i": 3 } as React.CSSProperties}>
            {calculator}
          </div>

          <ClassBoards
            rows={rows}
            viewerClass={viewerClass}
            firstIndex={4}
            render={(weightClass, inClass) => (
              <Board
                heading={weightClass}
                plate={plateFor(weightClass)}
                rows={inClass}
                rankOf={(r) => r.classRank}
                viewerId={viewer?.id ?? null}
              />
            )}
          />

          {college.slug === BATCH_COLLEGE && (
            <BatchBoards
              rows={rows}
              viewerBatch={viewer?.batchYear ?? null}
              firstIndex={5}
              render={(year, inBatch) => (
                <Board
                  heading={batchLabel(year)}
                  rows={inBatch}
                  rankOf={rankWithin(inBatch, (r) => r.dots)}
                  viewerId={viewer?.id ?? null}
                />
              )}
            />
          )}
        </div>
      )}
    </div>
  );
}

function Header({
  college,
  accountLink,
}: {
  college: College;
  accountLink: React.ReactNode;
}) {
  return (
    <header className="rise pb-5" style={{ "--i": 0 } as React.CSSProperties}>
      <Link href="/?all" className={navButton}>
        <ChevronLeft />
        All colleges
      </Link>
      <div className="mt-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[2.25rem] font-extrabold leading-[0.9] tracking-[-0.04em]">
            <EncryptedText text={college.shortName} charset="ABCDEFGHIJKLMNOPQRSTUVWXYZ" revealDelayMs={55} />
          </h1>
          <p className="mt-2.5 text-[16px] font-bold leading-none tracking-[-0.02em]">
            <EncryptedText
              text="Pound for pound."
              encryptedClassName="text-chalk-faint"
              revealedClassName="text-chalk"
              revealDelayMs={60}
            />
          </p>
          <p className="mt-2 text-[13px] leading-snug text-chalk-dim">
            {college.city} · every score adjusted for bodyweight
          </p>
        </div>
        {accountLink}
      </div>

      {/*
        The weight classes, each in its plate colour. The same colour
        marks every lifter's row below, so this is the legend for the
        whole board rather than a rule.
      */}
      <ul className="mt-5 flex gap-1.5 text-[11px] font-medium text-chalk-dim">
        {WEIGHT_CLASSES.map((weightClass) => (
          <li key={weightClass.label} className="flex flex-1 flex-col gap-1.5">
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
  );
}
