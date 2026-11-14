import Link from "next/link";

export const metadata = {
  title: "Privacy — Gym Rank",
  description: "What Gym Rank stores, what it shows publicly, and how to delete it.",
};

export default function PrivacyPage() {
  return (
    <main className="mx-auto flex min-h-full w-full max-w-md flex-col gap-6 px-5 py-10">
      <Link
        href="/"
        className="text-sm text-black/50 hover:text-black dark:text-white/50 dark:hover:text-white"
      >
        &larr; Gym Rank
      </Link>

      <h1 className="text-2xl font-semibold tracking-tight">Privacy</h1>

      <p className={muted}>
        Gym Rank is a student project built by Lakshay, a B.Tech student at
        LNMIIT Jaipur. It is not run by, affiliated with, or endorsed by
        LNMIIT or its gym.
      </p>

      <Section title="What is stored">
        <ul className={list}>
          <li>Your email address and name, from Google sign-in</li>
          <li>The display name you choose</li>
          <li>Your bodyweight in kilograms</li>
          <li>
            The lifts you enter — the weight, the reps, and your bodyweight at
            the time you entered them
          </li>
          <li>
            Basic usage events, such as when an account is created or a lift is
            saved, so the project can report how many people used it
          </li>
        </ul>
      </Section>

      <Section title="What other people can see">
        <p className={muted}>
          Your display name, your weight class, your lifts and your score.
        </p>
        <p className={muted}>
          <strong className="font-medium">
            Your bodyweight and your email address are never shown publicly.
          </strong>{" "}
          Bodyweight is used only to calculate your score, and only the weight
          class band it falls into is displayed.
        </p>
        <p className={muted}>
          The leaderboard is public — anyone with the link can read it without
          signing in. Choose a display name you are comfortable with that.
        </p>
      </Section>

      <Section title="Who it is shared with">
        <p className={muted}>
          Nobody. The data is not sold, shared or used for advertising. It is
          stored in a Neon Postgres database and the site is hosted on Vercel;
          those providers hold the data on the project&rsquo;s behalf.
        </p>
      </Section>

      <Section title="Deleting your data">
        <p className={muted}>
          Email{" "}
          <a href="mailto:lakshay2718@gmail.com" className="underline">
            lakshay2718@gmail.com
          </a>{" "}
          and your account and all your lifts will be deleted.
        </p>
        <p className={muted}>
          This is a time-limited project. When it ends, the personal data is
          deleted and only anonymous totals — how many people signed up, how
          many lifts were entered — are kept.
        </p>
      </Section>

      <Section title="Contact">
        <p className={muted}>
          <a href="mailto:lakshay2718@gmail.com" className="underline">
            lakshay2718@gmail.com
          </a>
        </p>
      </Section>

      <p className="text-xs text-black/40 dark:text-white/40">
        Last updated 14 November 2026.
      </p>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-sm font-medium uppercase tracking-wide text-black/50 dark:text-white/50">
        {title}
      </h2>
      {children}
    </section>
  );
}

const muted = "text-sm leading-relaxed text-black/70 dark:text-white/70";
const list = "flex list-disc flex-col gap-1 pl-5 text-sm leading-relaxed text-black/70 dark:text-white/70";
