import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ThemeSwitch } from "./prefs";
import { connection } from "next/server";
import { auth } from "@/auth";
import { collegeOptions } from "@/lib/cached";
import { getLifterByEmail } from "@/lib/lifters";
import { Bone, Footer, button } from "./board";
import { CollegePicker } from "./college-picker";
import { SignInForm } from "./sign-in";
import { TabBar } from "./tab-bar";

/*
  The front door. Nobody competes here — they pick a college and compete
  there. So this page has one job: get the visitor onto the right board in
  one tap. Just the search, then; the global board has its own tab.

  Served at / (signed-in lifters go on to their board) and at /colleges
  (never redirects). Two paths, not /?all: the router caches by path, so
  a prefetched / redirect was replayed for /?all and took a second tap.
*/
export function Front({ redirectToBoard }: { redirectToBoard: boolean }) {
  return (
    <>
      <main className="mx-auto w-full max-w-md px-5 pb-16 pt-10">
        <header className="rise pb-6" style={{ "--i": 0 } as React.CSSProperties}>
          <div className="flex items-start justify-between gap-4">
            {/* min-w-0 so the hero can shrink instead of shoving the account
                button off a phone screen; the vw clamp keeps the title on one
                line, and the tagline wraps to two. */}
            <div className="min-w-0">
              <h1 className="text-[clamp(1.5rem,8.2vw,2.5rem)] font-extrabold leading-[0.88] tracking-[-0.045em]">
                Gym Rank
              </h1>
              <p className="tagline mt-1.5 text-[clamp(1.3rem,6.9vw,2.1rem)] font-extrabold leading-none tracking-[-0.045em]">
                Your strength coefficient
              </p>
              <p className="mt-2 text-[14px] leading-snug text-chalk-dim">
                College gym leaderboards, every score adjusted for bodyweight.
              </p>
              <div className="mt-3">
                <ThemeSwitch />
              </div>
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
              {[0, 1, 2].map((i) => (
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
          <Landing redirectToBoard={redirectToBoard} />
        </Suspense>

        <Footer />
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

async function Landing({ redirectToBoard }: { redirectToBoard: boolean }) {
  await connection();
  const [colleges, session] = await Promise.all([collegeOptions(), auth()]);
  const viewer = session?.user?.email
    ? await getLifterByEmail(session.user.email).catch(() => null)
    : null;

  /*
    Someone who already has a board typed the domain to get to it, not to
    the front door. In-app links go to /colleges, which is the way back to
    the real front page.
  */
  if (viewer?.college && redirectToBoard) {
    redirect(`/c/${viewer.college.slug}`);
  }

  const withBoards = colleges.filter((c) => c.lifters > 0).length;

  return (
    <div>
      {viewer?.college && (
        <Link
          href={`/c/${viewer.college.slug}`}
          className="rise mb-6 flex items-center justify-between rounded-sm border border-rule bg-iron-raised px-4 py-3 text-[14px] text-chalk-dim transition-colors hover:border-chalk-faint hover:text-chalk"
          style={{ "--i": 1 } as React.CSSProperties}
        >
          <span>
            Your board:{" "}
            <span className="font-bold text-chalk">{viewer.college.shortName}</span>
          </span>
          <svg aria-hidden width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg>
        </Link>
      )}

      <section className="rise" style={{ "--i": 1 } as React.CSSProperties}>
        <h2 className="flex items-center justify-between caption">
          Your college
          <span className="tnum text-[12px] font-normal text-chalk-faint">
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
