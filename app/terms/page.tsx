import { ChevronLeft, Footer, navButton } from "@/app/board";
import { BackButton } from "@/app/back-button";
import Link from "next/link";
import { TabBar } from "@/app/tab-bar";

export const metadata = {
  title: "Terms — Gym Rank",
  description: "The terms for using Gym Rank.",
};

export default function TermsPage() {
  return (
    <>
    <main className="mx-auto flex min-h-full w-full max-w-md flex-col gap-6 px-5 pb-16 pt-10">

      <BackButton className={`${navButton} w-fit`}>
        <ChevronLeft />
        Back
      </BackButton>

      <h1 className="pt-2 text-[1.75rem] font-extrabold leading-none tracking-[-0.03em]">
        Terms of use
      </h1>

      <p className={muted}>
        Gym Rank is a free, independent student project. It is not run by,
        affiliated with, or endorsed by any college or college gym.
      </p>

      <Section title="Use it honestly">
        <p className={muted}>
          Every number on a board is self-reported. Enter lifts you have
          actually done, pick the college you actually attend, co-sign only
          sets you watched, and doubt only sets you genuinely believe
          aren&rsquo;t real. Entries that are obviously false may be removed,
          along with the account that submitted them.
        </p>
      </Section>

      <Section title="Be decent">
        <p className={muted}>
          Don&rsquo;t pretend to be someone else, pick an offensive name or
          avatar, or use doubts and friend requests to harass anyone. Doubting
          a lift just because you dislike the lifter, or getting friends to
          pile doubts onto someone, counts as harassment. Accounts that do
          these things may be removed.
        </p>
      </Section>

      <Section title="Lift at your own risk">
        <p className={muted}>
          Nothing here is coaching, training advice or medical advice. A
          leaderboard is a bad reason to attempt a lift you are not ready for.
          You are responsible for your own training and your own safety.
        </p>
      </Section>

      <Section title="No guarantees">
        <p className={muted}>
          The service is provided as-is, with no promise that it will be
          available, accurate, or preserved. It may go offline or be shut down
          at any time. Keep your own record of anything you care about.
        </p>
      </Section>

      <Section title="Your account">
        <p className={muted}>
          You can delete your account and data at any time, yourself from the
          bottom of the You page, or by emailing{" "}
          <a href="mailto:getgymrank@gmail.com" className={inlineLink}>
            getgymrank@gmail.com
          </a>
          . See the{" "}
          <Link href="/privacy" className={inlineLink}>
            privacy page
          </Link>{" "}
          for what is stored and what is shown publicly.
        </p>
      </Section>

      <p className="text-xs text-chalk-faint">Last updated 22 November 2026.</p>
      <Footer />
    </main>
    <TabBar />
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="border-b border-rule pb-2 caption">
        {title}
      </h2>
      {children}
    </section>
  );
}

const muted = "text-[14px] leading-relaxed text-chalk-dim";
const inlineLink = "text-chalk underline underline-offset-4 decoration-chalk-faint hover:decoration-chalk";


