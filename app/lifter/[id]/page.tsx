import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { auth, signIn } from "@/auth";
import { CosignButton } from "@/app/forms";
import {
  MOVEMENTS,
  getLifterByEmail,
  getLifterById,
  getLiftsFor,
  summarise,
} from "@/lib/lifters";
import { plateFor } from "@/lib/plates";
import { weightClassFor } from "@/lib/scoring";

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
      <Link href="/" className={navButton}>
        <ChevronLeft />
        Leaderboard
      </Link>
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

  const [lifts, session] = await Promise.all([getLiftsFor(lifter.id), auth()]);
  const viewer = session?.user?.email
    ? await getLifterByEmail(session.user.email)
    : null;

  const isOwner = viewer?.id === lifter.id;
  const canCosign = viewer !== null && !isOwner;

  const summary = summarise(lifts, lifter.bodyweightKg);
  const byMovement = new Map(lifts.map((l) => [l.movement, l]));
  const weightClass = weightClassFor(lifter.bodyweightKg);

  return (
    <div className="pt-8">
      <div
        aria-hidden
        className="h-1 w-16 rounded-full"
        style={{ background: plateFor(weightClass) }}
      />
      <h1 className="mt-4 text-[1.75rem] font-extrabold leading-none tracking-[-0.03em]">
        {lifter.displayName}
      </h1>
      <p className="mt-2 text-[13px] text-chalk-dim">
        {weightClass}
        {summary.dots !== null && (
          <span className="tnum">
            {" "}
            · {summary.dots.toFixed(1)} DOTS · {summary.totalKg?.toFixed(0)} kg
            total
          </span>
        )}
      </p>

      <section className="pt-10">
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
                <span className="shrink-0 text-right text-[12px] text-chalk-dim">
                  co-signed by
                  <span className="block font-medium text-chalk">
                    {lift.verifiedByName}
                  </span>
                </span>
              ) : canCosign ? (
                <CosignButton liftId={lift.id} />
              ) : (
                <span className="shrink-0 text-[12px] text-chalk-faint">
                  unverified
                </span>
              )}
            </div>
          );
        })}
      </section>

      {!viewer && lifts.length > 0 && (
        <section className="pt-8">
          <p className="text-[13px] leading-relaxed text-chalk-dim">
            Watched one of these sets? Sign in to co-sign it. You need a
            profile of your own first — a co-sign is worth exactly as much as
            the name behind it.
          </p>
          <form
            className="pt-3"
            action={async () => {
              "use server";
              await signIn("google", { redirectTo: `/lifter/${id}` });
            }}
          >
            <button type="submit" className={navButton}>
              Continue with Google
            </button>
          </form>
        </section>
      )}

      {isOwner && (
        <p className="pt-8 text-[13px] leading-relaxed text-chalk-faint">
          This is your page as other people see it. Share the link to get a
          set co-signed.
        </p>
      )}
    </div>
  );
}

const navButton =
  "inline-flex min-h-11 items-center gap-1.5 rounded-sm border border-rule px-3.5 text-[15px] text-chalk-dim transition-colors hover:border-chalk-faint hover:text-chalk";

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
