import Link from "next/link";
import { EncryptedText } from "@/components/ui/encrypted-text";

export const metadata = {
  title: "Privacy — Gym Rank",
  description: "What Gym Rank stores, what it shows publicly, and how to delete it.",
};

export default function PrivacyPage() {
  return (
    <main className="mx-auto flex min-h-full w-full max-w-md flex-col gap-6 px-5 pb-16 pt-10">
      <Link href="/" className={navButton}>
        <ChevronLeft />
        Gym Rank
      </Link>

      <h1 className="pt-2 text-[1.75rem] font-extrabold leading-none tracking-[-0.03em]">
        <EncryptedText text="Privacy" charset="ABCDEFGHIJKLMNOPQRSTUVWXYZ" revealDelayMs={55} />
      </h1>

      <p className={muted}>
        Gym Rank is an independent student project. It is not run by,
        affiliated with, or endorsed by any college or college gym.
      </p>

      <Section title="What is stored">
        <ul className={list}>
          <li>Your email address and name, from Google sign-in</li>
          <li>The display name you choose</li>
          <li>
            Your college — read from your email domain if it is an institute
            address, otherwise the one you pick
          </li>
          <li>Your bodyweight in kilograms</li>
          <li>
            The lifts you enter — the weight, the reps, and your bodyweight at
            the time you entered them
          </li>
          <li>
            Things that happened to you on the board — who co-signed a lift,
            who passed your score — so your own page can show them
          </li>
          <li>
            Basic usage events, such as when an account is created or a lift is
            saved, so the project can report how many people used it
          </li>
        </ul>
      </Section>

      <Section title="What other people can see">
        <p className={muted}>
          Your display name, your college, your weight class, your lifts and
          your score.
        </p>
        <p className={muted}>
          <strong className="font-medium text-chalk">
            Your bodyweight and your email address are never shown publicly.
          </strong>{" "}
          Bodyweight is used only to calculate your score, and only the weight
          class band it falls into is displayed.
        </p>
        <p className={muted}>
          Every board is public — anyone with the link can read it without
          signing in. Choose a display name you are comfortable with that.
          Your college board shows everyone at your college; the global board
          shows only lifters whose three lifts are all co-signed.
        </p>
      </Section>

      <Section title="Who it is shared with">
        <p className={muted}>
          Nobody. The data is not sold, shared or used for advertising. It is
          stored in a Neon Postgres database and the site is hosted on Vercel;
          those providers hold the data on the project&rsquo;s behalf.
        </p>
      </Section>

      <Section title="Email">
        <p className={muted}>
          One email, when you first create your profile, with your public link
          and how co-signing works. It is sent through Brevo, which sees your
          email address and name for that purpose. Nothing else is sent — no
          newsletters, no reminders.
        </p>
      </Section>

      <Section title="Deleting your data">
        <p className={muted}>
          Email{" "}
          <a href="mailto:lakshay2718@gmail.com" className={inlineLink}>
            lakshay2718@gmail.com
          </a>{" "}
          and your account and all your lifts will be deleted.
        </p>
        <p className={muted}>
          If the project is ever shut down, the personal data is deleted and
          only anonymous totals — how many people signed up, how many lifts
          were entered — are kept.
        </p>
      </Section>

      <Section title="Contact">
        <p className={muted}>
          <a href="mailto:lakshay2718@gmail.com" className={inlineLink}>
            lakshay2718@gmail.com
          </a>
        </p>
      </Section>

      <p className="text-xs text-chalk-faint">Last updated 15 November 2026.</p>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="border-b border-rule pb-2 text-[13px] font-medium text-chalk-dim">
        {title}
      </h2>
      {children}
    </section>
  );
}

const muted = "text-[14px] leading-relaxed text-chalk-dim";
const inlineLink = "text-chalk underline underline-offset-4 decoration-chalk-faint hover:decoration-chalk";
const list = "flex list-disc flex-col gap-1 pl-5 text-[14px] leading-relaxed text-chalk-dim";

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
