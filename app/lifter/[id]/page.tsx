import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { CosignButton } from "@/app/forms";
import { SignInForm } from "@/app/sign-in";
import {
  MOVEMENTS,
  getLifterByEmail,
  getLifterById,
  getLiftsFor,
  summarise,
} from "@/lib/lifters";
import { getRankFor } from "@/lib/leaderboard";
import { plateFor } from "@/lib/plates";
import { weightClassFor } from "@/lib/scoring";
import { CountUp } from "@/app/score";

/*
  What a pasted link looks like before anyone clicks it.

  This is the whole share mechanism: the image below is fetched and
  rendered by WhatsApp, Instagram and anything else that unfurls a URL, so
  one paste into a gym group shows the score to everyone in it. The numbers
  come from getRankFor, which reads the same board the site does — a card
  that disagreed with the leaderboard would be worse than no card.
*/
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const card = await getRankFor(id).catch(() => null);
  const image = { url: `/api/og?id=${id}`, width: 1200, height: 630 };

  if (!card) {
    return {
      title: "Gym Rank",
      openGraph: { images: [image] },
      twitter: { card: "summary_large_image", images: [image.url] },
    };
  }

  const title = `${card.displayName} · ${card.dots.toFixed(1)} DOTS`;
  const description = `#${card.overallRank} of ${card.totalLifters} at ${card.collegeShort} · ${card.totalKg.toFixed(0)} kg total, ${card.weightClass}.`;

  return {
    title,
    description,
    openGraph: { title, description, images: [image] },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image.url],
    },
  };
}

/*
  A lifter's public page. Two jobs:

  1. Show the lifts behind a score, so the board is inspectable.
  2. Let a different signed-in lifter co-sign a set they watched.

  Co-signing lives here rather than on /me because the person vouching must
  be someone other than the owner. The owner sends the link; the witness
  does the tapping. The server action re-checks the identity either way.
*/
// `params` is awaited inside the Suspense boundary, not here: with Cache
// Components, reading it in the page shell blocks prerendering of the shell.
export default function LifterPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <main className="mx-auto w-full max-w-md px-5 pb-16 pt-10">
      <Suspense
        fallback={<p className="pt-8 text-sm text-chalk-faint">Loading</p>}
      >
        <Profile params={params} />
      </Suspense>
    </main>
  );
}

async function Profile({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const lifter = await getLifterById(id).catch(() => null);
  if (!lifter) notFound();

  const [lifts, session, card] = await Promise.all([
    getLiftsFor(lifter.id),
    auth(),
    getRankFor(lifter.id).catch(() => null),
  ]);
  const viewer = session?.user?.email
    ? await getLifterByEmail(session.user.email)
    : null;

  const isOwner = viewer?.id === lifter.id;
  // A co-sign is "I was in the room", so it has to come from the same gym.
  const sameCollege =
    viewer?.college != null && viewer.college.id === lifter.college?.id;
  const canCosign = viewer !== null && !isOwner && sameCollege;

  const summary = summarise(lifts, lifter.bodyweightKg);
  const byMovement = new Map(lifts.map((l) => [l.movement, l]));
  const weightClass = weightClassFor(lifter.bodyweightKg);
  const boardHref = lifter.college ? `/c/${lifter.college.slug}` : "/";

  return (
    <div>
      <Link href={boardHref} className={navButton}>
        <ChevronLeft />
        {lifter.college ? `${lifter.college.shortName} board` : "All colleges"}
      </Link>
      <div className="pt-8">
      {isOwner && (
        <Link
          href="/me"
          className="mb-6 flex items-center justify-between rounded-sm border border-rule bg-iron-raised px-4 py-3 text-[13px] text-chalk-dim transition-colors hover:border-chalk-faint hover:text-chalk"
        >
          <span>
            You&rsquo;re viewing your public page.{" "}
            <span className="font-bold text-chalk">Back to your lifts</span>
          </span>
          <ChevronRight />
        </Link>
      )}
      <section
        className="rise glow"
        style={
          {
            "--i": 0,
            "--glow-color": plateFor(weightClass),
          } as React.CSSProperties
        }
      >
        <div
          aria-hidden
          className="h-1 w-16 rounded-full"
          style={{ background: plateFor(weightClass) }}
        />
        <h1 className="mt-4 text-[1.75rem] font-extrabold leading-none tracking-[-0.03em]">
          {lifter.displayName}
        </h1>
        <p className="mt-2 text-[13px] text-chalk-dim">
          {lifter.college && <span>{lifter.college.shortName} · </span>}
          {weightClass}
          {summary.totalKg !== null && (
            <span className="tnum"> · {summary.totalKg.toFixed(0)} kg total</span>
          )}
        </p>

        {summary.dots !== null && (
          <div className="mt-5 flex items-end gap-4">
            <p className="tnum text-[3.5rem] font-extrabold leading-[0.85] tracking-[-0.045em]">
              <CountUp value={summary.dots} />
            </p>
            <div className="pb-1 text-[13px] leading-tight text-chalk-dim">
              <p>DOTS</p>
              {card && (
                <p className="mt-1 flex items-center gap-1.5 font-bold text-chalk">
                  {card.overallRank <= 3 && (
                    <span
                      className="medal"
                      style={
                        {
                          "--medal": [
                            "var(--gold)",
                            "var(--silver)",
                            "var(--bronze)",
                          ][card.overallRank - 1],
                        } as React.CSSProperties
                      }
                    >
                      {card.overallRank}
                    </span>
                  )}
                  <span className="tnum">
                    #{card.overallRank} of {card.totalLifters}
                  </span>
                </p>
              )}
            </div>
          </div>
        )}
      </section>

      <section className="rise pt-10" style={{ "--i": 1 } as React.CSSProperties}>
        <h2 className="border-b border-rule pb-2 text-[13px] font-medium text-chalk-dim">
          Lifts
        </h2>
        {lifts.length === 0 && (
          <p className="pt-4 text-[13px] text-chalk-faint">Nothing entered yet.</p>
        )}
        {MOVEMENTS.map((movement) => {
          const lift = byMovement.get(movement.id);
          if (!lift) return null;
          const isPullups = movement.id === "pullups";
          return (
            <div
              key={movement.id}
              className="flex items-center gap-3 border-b border-rule py-3"
            >
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-medium">{movement.label}</p>
                <p className="tnum text-[11px] text-chalk-faint">
                  {isPullups
                    ? `${lift.reps} reps`
                    : `${lift.weightKg} kg × ${lift.reps} · est. 1RM ${lift.est1rmKg?.toFixed(1)} kg`}
                </p>
              </div>
              {lift.verifiedByName ? (
                <span className="flex shrink-0 items-center gap-1.5 rounded-full border border-[color-mix(in_oklab,var(--plate-10)_50%,transparent)] bg-[color-mix(in_oklab,var(--plate-10)_14%,transparent)] px-2.5 py-1 text-[12px] text-chalk">
                  <Check />
                  <span className="text-chalk-dim">by</span>
                  <span className="font-medium">{lift.verifiedByName}</span>
                </span>
              ) : canCosign ? (
                <CosignButton liftId={lift.id} />
              ) : (
                <span className="shrink-0 rounded-full border border-rule px-2.5 py-1 text-[12px] text-chalk-faint">
                  unverified
                </span>
              )}
            </div>
          );
        })}
      </section>

      {!viewer && lifts.length > 0 && (
        <section className="rise pt-8" style={{ "--i": 2 } as React.CSSProperties}>
          <p className="text-[13px] leading-relaxed text-chalk-dim">
            Watched one of these sets? Sign in to co-sign it. You need a
            profile of your own first — a co-sign is worth exactly as much as
            the name behind it.
          </p>
          <SignInForm
            redirectTo={`/lifter/${id}`}
            label="Continue with Google"
            className={navButton}
            formClassName="pt-3"
          />
        </section>
      )}

      {viewer && !isOwner && !sameCollege && lifts.length > 0 && (
        <section className="rise pt-8" style={{ "--i": 2 } as React.CSSProperties}>
          <p className="text-[13px] leading-relaxed text-chalk-faint">
            Co-signs come from lifters at the same college — someone who
            could have been in the room.
          </p>
        </section>
      )}

      {isOwner && (
        <section className="rise pt-8" style={{ "--i": 2 } as React.CSSProperties}>
          <p className="text-[13px] leading-relaxed text-chalk-faint">
            This is your page as other people see it. Share the link to get a
            set co-signed.
          </p>
          <Link href="/me" className={`${navButton} mt-3`}>
            Your lifts
            <ChevronRight />
          </Link>
        </section>
      )}
      </div>
    </div>
  );
}

const navButton =
  "press inline-flex min-h-11 items-center gap-1.5 rounded-sm border border-rule px-3.5 text-[15px] text-chalk-dim hover:border-chalk-faint hover:text-chalk";

function Check() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 16 16"
      className="h-3 w-3 text-[var(--plate-10)]"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m3 8.5 3 3 7-7" />
    </svg>
  );
}

function ChevronRight() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 16 16"
      className="h-3.5 w-3.5 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m6 3 5 5-5 5" />
    </svg>
  );
}

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
