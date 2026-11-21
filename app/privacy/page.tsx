import { ChevronLeft, Footer, navButton } from "@/app/board";
import { BackButton } from "@/app/back-button";
import { TabBar } from "@/app/tab-bar";

export const metadata = {
  title: "Privacy — Gym Rank",
  description: "What Gym Rank stores, what it shows publicly, and how to delete it.",
};

export default function PrivacyPage() {
  return (
    <>
    <main className="mx-auto flex min-h-full w-full max-w-md flex-col gap-6 px-5 pb-16 pt-10">

      <BackButton className={`${navButton} w-fit`}>
        <ChevronLeft />
        Back
      </BackButton>

      <h1 className="pt-2 text-[1.75rem] font-extrabold leading-none tracking-[-0.03em]">
        Privacy
      </h1>

      <p className={muted}>
        Gym Rank is an independent student project. It is not run by,
        affiliated with, or endorsed by any college or college gym.
      </p>

      <Section title="What is stored">
        <ul className={list}>
          <li>Your email address and name, from Google sign-in</li>
          <li>
            The display name, username and avatar you choose, and your batch
            year where your college uses batches
          </li>
          <li>
            Your college — read from your email domain if it is an institute
            address, otherwise the one you pick
          </li>
          <li>Your bodyweight in kilograms</li>
          <li>
            The lifts you enter — the weight, the reps, and your bodyweight at
            the time — plus your earlier entries, so your page can show progress
          </li>
          <li>
            Co-signs and doubts: whose lifts you co-signed or doubted, and who
            co-signed or doubted yours
          </li>
          <li>Your friends, and the friend requests you send and receive</li>
          <li>
            Your notifications — co-signs, doubts, friend requests and people
            passing your score
          </li>
          <li>
            Basic usage events, such as when an account is created or a lift is
            saved, so the project can report how many people used it
          </li>
        </ul>
        <p className={muted}>
          Your theme, and any numbers you try in the calculator before signing
          up, stay in your own browser and are never sent to the server. The
          only cookies are the ones Google sign-in needs to keep you signed in.
          There are no ads and no third-party trackers.
        </p>
      </Section>

      <Section title="What other people can see">
        <p className={muted}>
          Your display name, username, avatar, college, batch, weight class,
          your lifts and score, and your trust badge.
        </p>
        <p className={muted}>
          <strong className="font-medium text-chalk">
            Your bodyweight and your email address are never shown publicly.
          </strong>{" "}
          Bodyweight is used only to calculate your score, and only the weight
          class band it falls into is displayed.
        </p>
        <p className={muted}>
          <strong className="font-medium text-chalk">Co-signs are counted publicly.</strong>{" "}
          A lift shows how many people co-signed it, not who. If you co-sign
          someone&rsquo;s lift, they see your name on their own You page and
          in their notifications.
        </p>
        <p className={muted}>
          <strong className="font-medium text-chalk">Doubts are counted, not named.</strong>{" "}
          A lift shows how many doubts it has, never who doubted it — not to
          visitors and not to the lifter. Only the site admin can see who
          doubted a lift, to deal with abuse.
        </p>
        <p className={muted}>
          <strong className="font-medium text-chalk">Friends are private.</strong>{" "}
          Nobody else can see your friends list or your Friends board. A
          friend request shows your name to the person you send it to.
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
          stored in a Neon Postgres database in Singapore and the site is
          hosted on Vercel; sign-in goes through Google. Those providers handle
          the data on the project&rsquo;s behalf.
        </p>
      </Section>

      <Section title="Email">
        <p className={muted}>
          One email, when you first create your profile, with your public link
          and how co-signing works. It is sent through Brevo, which sees your
          email address and name for that purpose. Nothing else is sent — no
          newsletters, no reminders.
        </p>
        <p className={muted}>
          &ldquo;Report a problem&rdquo; opens your own mail app with an email
          that includes the page you were on, your browser and device, and the
          time. You see all of it before sending, and nothing is sent unless
          you press send.
        </p>
      </Section>

      <Section title="Deleting your data">
        <p className={muted}>
          Delete your account yourself from the bottom of the You page, or
          email{" "}
          <a href="mailto:getgymrank@gmail.com" className={inlineLink}>
            getgymrank@gmail.com
          </a>
          . Deleting removes your profile, lifts and their history, the
          co-signs and doubts you gave, your friends and friend requests, and
          your notifications, straight away. Usage events stay, with your
          account removed from them, so the totals stay accurate.
        </p>
        <p className={muted}>
          If the project is ever shut down, the personal data is deleted and
          only anonymous totals — how many people signed up, how many lifts
          were entered — are kept.
        </p>
      </Section>

      <Section title="Contact">
        <p className={muted}>
          <a href="mailto:getgymrank@gmail.com" className={inlineLink}>
            getgymrank@gmail.com
          </a>
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
const list = "flex list-disc flex-col gap-1 pl-5 text-[14px] leading-relaxed text-chalk-dim";


