import { Suspense } from "react";
import Link from "next/link";
import { EncryptedText } from "@/components/ui/encrypted-text";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { auth } from "@/auth";
import { getCollegeOptions } from "@/lib/colleges";
import { getLeaderboard } from "@/lib/leaderboard";
import { getLifterByEmail } from "@/lib/lifters";
import { Board, Bone, Footer, button, navButton } from "./board";
import { CollegePicker } from "./college-picker";
import { SignInForm } from "./sign-in";

const PREVIEW = 5;

type SearchParams = Promise<{ all?: string }>;

/*
  The front door. Nobody competes here — they pick a college and compete
  there. So this page has one job above the fold: get the visitor onto the
  right board in one tap. The global preview underneath is the trophy case.
*/
export default function Home({ searchParams }: { searchParams: SearchParams }) {
  return (
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
              <EncryptedText
                text="Pound for pound."
                encryptedClassName="text-chalk-faint"
                revealedClassName="text-chalk"
                revealDelayMs={60}
              />
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
            <Bone className="mt-3 h-11 w-full" />
            <Bone className="mt-3 h-3 w-36" />
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-center justify-between border-b border-rule py-3">
                <span>
                  <Bone className="h-4 w-28" />
                  <Bone className="mt-1.5 h-3 w-44" />
                </span>
                <Bone className="h-3 w-14" />
              </div>
            ))}
          </div>
        }
      >
        <Landing searchParams={searchParams} />
      </Suspense>

      <Footer home={false} />
    </main>
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

  return <SignInForm redirectTo="/me" label="Add yours" className={button} />;
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

      <section className="rise" style={{ "--i": 1 } as React.CSSProperties}>
        <h2 className="flex items-center justify-between text-[13px] font-medium text-chalk-dim">
          Your college
          <span className="tnum text-[11px] font-normal text-chalk-faint">
            {withBoards} with boards · {colleges.length} listed
          </span>
        </h2>
        <div className="pt-3">
          <CollegePicker colleges={colleges} />
        </div>
      </section>

      <section className="rise pt-12" style={{ "--i": 2 } as React.CSSProperties}>
        <h2 className="text-[13px] font-medium text-chalk-dim">Global board</h2>
        <p className="mt-1 text-[12px] leading-relaxed text-chalk-faint">
          Every college together. Only lifters with all three lifts co-signed
          by someone who watched them.
        </p>
        <div className="pt-4">
          {global.length === 0 ? (
            <p className="text-[13px] text-chalk-dim">
              Nobody is fully co-signed yet. The first lifter to get all three
              sets vouched for opens this board.
            </p>
          ) : (
            <>
              <Board
                heading="Top of every college"
                rows={global.slice(0, PREVIEW)}
                rankOf={(r) => r.overallRank}
                viewerId={viewer?.id ?? null}
                medals
                showCollege
              />
              {global.length > PREVIEW && (
                <Link href="/global" className={`${navButton} mt-4`}>
                  {`All ${global.length} on the global board ›`}
                </Link>
              )}
            </>
          )}
        </div>
      </section>
    </div>
  );
}
