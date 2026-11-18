import { Suspense, ViewTransition } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { auth } from "@/auth";
import {
  Bone,
  Check,
  ChevronLeft,
  ChevronRight,
  LifterHeaderSkeleton,
  LiftsSkeleton,
  navButton,
} from "@/app/board";
import { CosignButton } from "@/app/forms";
import { lifterMetadata } from "@/app/lifter-metadata";
import { SignInForm } from "@/app/sign-in";
import {
  MOVEMENTS,
  TOTAL_MOVEMENTS,
  getLifterByEmail,
  getLifterByUsername,
  getLiftsFor,
  summarise,
} from "@/lib/lifters";
import { getRankFor } from "@/lib/leaderboard";
import { batchLabel } from "@/lib/batch";
import { cosignStatus, cosignText } from "@/lib/cosign";
import { plateFor } from "@/lib/plates";
import { weightClassFor } from "@/lib/scoring";
import { Avatar } from "@/app/avatar";
import { Barbell } from "@/app/barbell";
import { ArrivingProfile } from "@/app/morph";
import { Roll } from "@/app/roll";
import { TabBar } from "@/app/tab-bar";

type Params = Promise<{ username: string }>;

// The share card's text lives in app/lifter-metadata.ts, shared with the
// legacy /lifter/<id> route.
export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { username } = await params;
  const lifter = await getLifterByUsername(username).catch(() => null);
  return lifterMetadata(lifter);
}

/*
  A lifter's public page, at their handle. Two jobs:

  1. Show the lifts behind a score, so the board is inspectable.
  2. Let a different signed-in lifter at the same college co-sign a set
     they watched.

  Co-signing lives here rather than on /me because the person vouching must
  be someone other than the owner. The owner sends the link; the witness
  does the tapping. The server action re-checks the identity either way.
*/
// `params` is awaited inside the Suspense boundary, not here: with Cache
// Components, reading it in the page shell blocks prerendering of the shell.
export default function LifterPage({ params }: { params: Params }) {
  return (
    <>
      <main className="mx-auto w-full max-w-md px-5 pb-16 pt-10">
        <Suspense
          fallback={
            <div role="status" aria-label="Loading">
              <Bone className="h-11 w-36" />
              {/* Straight after a tap on a board, the lifter's real header,
                  so their avatar and score have somewhere to fly to. */}
              <ArrivingProfile header={<LifterHeaderSkeleton />}>
                <LiftsSkeleton />
              </ArrivingProfile>
            </div>
          }
        >
          <Profile params={params} />
        </Suspense>
      </main>
      <TabBar />
    </>
  );
}

async function Profile({ params }: { params: Params }) {
  const { username } = await params;
  // auth() touches crypto before it reads cookies; marking the render
  // dynamic first keeps prerendering from tripping on the random bytes.
  await connection();
  // Two waits on the database, not four: who this is (and who's looking),
  // then everything about them at once. Each wait is a trip to a database
  // a region away, and this page is opened by tapping a name.
  const [lifter, session] = await Promise.all([
    getLifterByUsername(username).catch(() => null),
    auth(),
  ]);
  if (!lifter) notFound();

  const [lifts, card, viewer] = await Promise.all([
    getLiftsFor(lifter.id),
    // No college, no board, no rank — and passing the id saves a lookup.
    lifter.college ? getRankFor(lifter.id, lifter.college.id).catch(() => null) : null,
    session?.user?.email ? getLifterByEmail(session.user.email) : null,
  ]);

  const isOwner = viewer?.id === lifter.id;
  // A co-sign is "I was in the room", so it has to come from the same gym.
  const sameCollege =
    viewer?.college != null && viewer.college.id === lifter.college?.id;
  const canCosign = viewer !== null && !isOwner && sameCollege;

  const summary = summarise(lifts, lifter.bodyweightKg);
  const byMovement = new Map(lifts.map((l) => [l.movement, l]));
  const cosign = cosignStatus(
    TOTAL_MOVEMENTS.map((m) => byMovement.get(m)?.cosigners ?? []),
  );
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
        {/* No rise here: after a tap on a board, this header is where the
            avatar and score land (app/morph.tsx), and a fade would dim them
            mid-flight. The names below must match the ones in morph.tsx. */}
        <section
          className="glow"
          style={{ "--glow-color": plateFor(weightClass) } as React.CSSProperties}
        >
          <div className="flex items-center gap-4">
            <ViewTransition name={`avatar-${lifter.id}`} share="morph" default="none">
              <Avatar name={lifter.displayName} ring={plateFor(weightClass)} size={64} />
            </ViewTransition>
            <div className="min-w-0">
              <h1 className="text-[1.75rem] font-extrabold leading-none tracking-[-0.03em]">
                {lifter.displayName}
              </h1>
              <p className="mt-1.5 text-[13px] text-chalk-dim">
                <span className="text-chalk">@{lifter.username}</span>
                {lifter.college && <span> · {lifter.college.shortName}</span>}
                {lifter.batchYear !== null && (
                  <span> · {batchLabel(lifter.batchYear)}</span>
                )}
                <span> · {weightClass}</span>
                {summary.totalKg !== null && (
                  <span className="tnum"> · {summary.totalKg.toFixed(0)} kg total</span>
                )}
              </p>
            </div>
          </div>

          {summary.dots !== null && (
            <div className="mt-5 flex items-end gap-4">
              <p className="tnum text-[3.5rem] font-extrabold leading-none tracking-[-0.045em]">
                <ViewTransition name={`score-${lifter.id}`} share="morph" default="none">
                  <Roll value={summary.dots} />
                </ViewTransition>
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
          <h2 className="border-b border-rule pb-2 caption">
            Lifts
          </h2>
          {lifts.length === 0 && (
            <p className="pt-4 text-[13px] text-chalk-faint">Nothing entered yet.</p>
          )}
          {cosign && (
            <p className="flex items-center gap-1.5 pt-3 text-[13px] text-chalk-dim">
              <span className={cosign.kind === "full" ? "" : "opacity-50"}>
                <Check />
              </span>
              {cosignText(cosign)}
            </p>
          )}
          {MOVEMENTS.map((movement, i) => {
            const lift = byMovement.get(movement.id);
            if (!lift) return null;
            const isPullups = movement.id === "pullups";
            // Any number of people can vouch for a lift, each once.
            const canAdd = canCosign && !lift.cosigners.some((c) => c.id === viewer?.id);
            return (
              <div key={movement.id} className="border-b border-rule py-3">
                <div className="flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-[14px] font-medium">{movement.label}</p>
                    <p className="tnum text-[11px] text-chalk-faint">
                      {isPullups
                        ? `${lift.reps} reps`
                        : `${lift.weightKg} kg × ${lift.reps} · est. 1RM ${lift.est1rmKg?.toFixed(1)} kg`}
                    </p>
                  </div>
                  {lift.weightKg !== null && (
                    <Barbell kg={lift.weightKg} delayMs={200 + i * 120} />
                  )}
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {lift.cosigners.length > 0 && (
                    <span className="flex min-w-0 max-w-full items-center gap-1.5 rounded-full border border-[color-mix(in_oklab,var(--plate-10)_50%,transparent)] bg-[color-mix(in_oklab,var(--plate-10)_14%,transparent)] px-2.5 py-1 text-[12px] text-chalk">
                      <Check />
                      <span className="text-chalk-dim">by</span>
                      <span className="truncate font-medium">
                        {lift.cosigners.map((c) => c.name).join(", ")}
                      </span>
                    </span>
                  )}
                  {canAdd ? (
                    <CosignButton liftId={lift.id} />
                  ) : lift.cosigners.length === 0 ? (
                    <span className="shrink-0 rounded-full border border-rule px-2.5 py-1 text-[12px] text-chalk-faint">
                      unverified
                    </span>
                  ) : null}
                </div>
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
              redirectTo={`/u/${lifter.username}`}
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
