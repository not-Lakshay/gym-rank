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
      <Link href="/?all" className={navButton}>
        <ChevronLeft />
        Gym Rank
      </Link>

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
          actually done, pick the college you actually attend, and co-sign
          only sets you watched. Entries that are obviously false may be
          removed, along with the account that submitted them.
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
          You can delete your account and data at any time by emailing{" "}
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

      <p className="text-xs text-chalk-faint">Last updated 15 November 2026.</p>
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

const navButton =
  "press inline-flex min-h-11 w-fit items-center gap-1.5 rounded-sm border border-rule px-3.5 text-[15px] text-chalk-dim hover:border-chalk-faint hover:text-chalk";

function ChevronLeft() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 16 16"
      className="h-3.5 w-3.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M10 3 5 8l5 5" />
    </svg>
  );
}
