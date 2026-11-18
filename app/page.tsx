import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { auth } from "@/auth";
import { getCollegeBySlug, getCollegeOptions, type CollegeOption } from "@/lib/colleges";
import { getLeaderboard } from "@/lib/leaderboard";
import { getLifterByEmail } from "@/lib/lifters";
import { Board, Bone, Footer, button, navButton } from "./board";
import { CollegePicker } from "./college-picker";
import { SignInForm } from "./sign-in";
import { TabBar } from "./tab-bar";

const PREVIEW = 5;

type SearchParams = Promise<{ all?: string }>;

/*
  The front door. Nobody competes here — they pick a college and compete
  there. It opens on a live podium, the trophy case, so the first screen
  shows what the app is; then the search that gets a visitor onto their
  own college's board in one tap.
*/
export default function Home({ searchParams }: { searchParams: SearchParams }) {
  return (
    <>
      <main className="mx-auto w-full max-w-md px-5 pb-16 pt-10">
        <header className="rise pb-6" style={{ "--i": 0 } as React.CSSProperties}>
          <div className="flex items-start justify-between gap-4">
            {/* min-w-0 so the hero can shrink instead of shoving the account
                button off a phone screen; the vw clamps keep it one line. */}
            <div className="min-w-0">
              <h1 className="text-[clamp(1.5rem,8.2vw,2.5rem)] font-extrabold leading-[0.88] tracking-[-0.045em]">
                Gym Rank
              </h1>
              <p className="mt-1.5 text-[clamp(1.3rem,6.9vw,2.1rem)] font-extrabold italic leading-none tracking-[-0.045em]">
                Pound for pound.
              </p>
              <p className="mt-2 text-[13px] leading-snug text-chalk-dim">
                College gym leaderboards, every score adjusted for bodyweight.
              </p>
            </div>
            <Suspense fallback={null}>
              <AccountLink />
            </Suspense>
          </div>
        </header>

        <Suspense
          fallback={
            <div role="status" aria-label="Loading">
              <Bone className="h-3 w-24" />
              <div className="mt-4 flex items-end gap-2">
                <Bone className="h-32 flex-1" />
                <Bone className="h-40 flex-1" />
                <Bone className="h-28 flex-1" />
              </div>
              <Bone className="mt-12 h-3 w-24" />
              <Bone className="mt-3 h-11 w-full" />
            </div>
          }
        >
          <Landing searchParams={searchParams} />
        </Suspense>

        <Footer home={false} />
      </main>
      <TabBar active="board" />
    </>
  );
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

  return <SignInForm redirectTo="/me" label="Add yours" className={button} compact />;
}

async function Landing({ searchParams }: { searchParams: SearchParams }) {
  await connection();
  const [colleges, global, session, { all }] = await Promise.all([
    getCollegeOptions(),
    getLeaderboard({ global: true }),
    auth(),
    searchParams,
  ]);
  const viewer = session?.user?.email
    ? await getLifterByEmail(session.user.email).catch(() => null)
    : null;

  /*
    Someone who already has a board typed the domain to get to it, not to
    the front door. Every in-app link here carries ?all, which is the way
    back to the real front page.
  */
  if (viewer?.college && all === undefined) {
    redirect(`/c/${viewer.college.slug}`);
  }

  const withBoards = colleges.filter((c) => c.lifters > 0).length;

  // The trophy case: the global board once it can fill a podium, and until
  // then the busiest college's — a podium is the point of the first screen.
  const trophy =
    global.length >= 3
      ? { heading: "Top of every college", rows: global, href: "/global", global: true }
      : await busiestBoard(colleges);

  return (
    <div>
      {viewer?.college && (
        <Link
          href={`/c/${viewer.college.slug}`}
          className="rise mb-6 flex items-center justify-between rounded-sm border border-rule bg-iron-raised px-4 py-3 text-[13px] text-chalk-dim transition-colors hover:border-chalk-faint hover:text-chalk"
          style={{ "--i": 1 } as React.CSSProperties}
        >
          <span>
            Your board:{" "}
            <span className="font-bold text-chalk">{viewer.college.shortName}</span>
          </span>
          <span aria-hidden>›</span>
        </Link>
      )}

      {trophy && (
        <section className="rise" style={{ "--i": 1 } as React.CSSProperties}>
          {trophy.global && (
            <p className="mb-3 text-[12px] leading-relaxed text-chalk-faint">
              Every college together. Only lifters with all three lifts
              co-signed by someone who watched them.
            </p>
          )}
          <Board
            heading={trophy.heading}
            rows={trophy.rows.slice(0, PREVIEW)}
            rankOf={(r) => r.overallRank}
            viewerId={viewer?.id ?? null}
            medals
            showCollege={trophy.global}
          />
          <Link href={trophy.href} className={`${navButton} mt-4`}>
            {`All ${trophy.rows.length} on the board ›`}
          </Link>
        </section>
      )}

      <section className="rise pt-12" style={{ "--i": 2 } as React.CSSProperties}>
        <h2 className="flex items-center justify-between caption">
          Your college
          <span className="tnum text-[11px] font-normal text-chalk-faint">
            {withBoards} with boards · {colleges.length} listed
          </span>
        </h2>
        <div className="pt-3">
          <CollegePicker colleges={colleges} />
        </div>
      </section>
    </div>
  );
}

/** The college with the most lifters, if it has enough for a podium. */
async function busiestBoard(colleges: CollegeOption[]) {
  const top = colleges.reduce<CollegeOption | null>(
    (best, c) => (c.lifters > (best?.lifters ?? 0) ? c : best),
    null,
  );
  if (!top || top.lifters < 3) return null;
  const college = await getCollegeBySlug(top.slug);
  if (!college) return null;
  return {
    heading: `Top of ${college.shortName}`,
    rows: await getLeaderboard({ collegeId: college.id }),
    href: `/c/${college.slug}`,
    global: false,
  };
}
