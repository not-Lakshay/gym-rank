import { Suspense } from "react";
import Link from "next/link";
import { auth, signIn, signOut } from "@/auth";
import { LiftRowForm, ProfileForm, primary } from "@/app/forms";
import {
  MOVEMENTS,
  type Lift,
  type Lifter,
  getLifterByEmail,
  getLiftsFor,
  summarise,
} from "@/lib/lifters";
import { plateFor } from "@/lib/plates";
import { weightClassFor } from "@/lib/scoring";

export default function MePage() {
  return (
    <main className="mx-auto w-full max-w-md px-5 pb-16 pt-10">
      <Link href="/" className={navButton}>
        <ChevronLeft />
        Leaderboard
      </Link>

      <Suspense
        fallback={<p className="pt-8 text-sm text-chalk-faint">Loading</p>}
      >
        <Dashboard />
      </Suspense>
    </main>
  );
}

async function Dashboard() {
  const session = await auth();
  const email = session?.user?.email;

  if (!email) {
    return (
      <div className="pt-8">
        <h1 className="text-[1.75rem] font-extrabold leading-none tracking-[-0.03em]">
          Sign in to add your lifts
        </h1>
        <form
          className="pt-5"
          action={async () => {
            "use server";
            await signIn("google", { redirectTo: "/me" });
          }}
        >
          <button type="submit" className={primary}>
            Continue with Google
          </button>
        </form>
      </div>
    );
  }

  const lifter = await getLifterByEmail(email);

  if (!lifter) {
    return (
      <div className="pt-8">
        <h1 className="text-[1.75rem] font-extrabold leading-none tracking-[-0.03em]">
          Set up your profile
        </h1>
        <p className="mt-2 text-[13px] leading-relaxed text-chalk-dim">
          Bodyweight is what makes the scores comparable. It is never shown to
          anyone — only the class it falls into.
        </p>
        <div className="pt-6">
          <ProfileForm
            defaultName={session?.user?.name ?? ""}
            submitLabel="Continue"
          />
        </div>
      </div>
    );
  }

  const lifts = await getLiftsFor(lifter.id);
  return <LifterView lifter={lifter} lifts={lifts} />;
}

function LifterView({ lifter, lifts }: { lifter: Lifter; lifts: Lift[] }) {
  const summary = summarise(lifts, lifter.bodyweightKg);
  const byMovement = new Map(lifts.map((l) => [l.movement, l]));
  const weightClass = weightClassFor(lifter.bodyweightKg);
  const plate = plateFor(weightClass);

  return (
    <div className="pt-8">
      {/* The one loud thing on the page — this is what gets screenshotted. */}
      <section>
        <div
          aria-hidden
          className="h-1 w-16 rounded-full"
          style={{ background: plate }}
        />

        {summary.dots === null ? (
          <div className="pt-4">
            <p className="text-[1.5rem] font-extrabold leading-tight tracking-[-0.02em]">
              No score yet
            </p>
            <p className="mt-2 text-[13px] leading-relaxed text-chalk-dim">
              Enter your{" "}
              {summary.missingForTotal
                .map((m) =>
                  MOVEMENTS.find((x) => x.id === m)?.label.toLowerCase(),
                )
                .join(", ")}{" "}
              to get on the board.
            </p>
          </div>
        ) : (
          <div className="pt-4">
            <p className="tnum text-[4.5rem] font-extrabold leading-[0.85] tracking-[-0.045em]">
              {summary.dots.toFixed(1)}
            </p>
            <p className="mt-3 text-[13px] text-chalk-dim">
              DOTS score
              <span className="tnum text-chalk-faint">
                {" "}
                · {summary.totalKg?.toFixed(0)} kg total
              </span>
            </p>
          </div>
        )}

        <p className="mt-4 text-[14px] font-bold">
          {lifter.displayName}
          <span className="font-normal text-chalk-dim"> · {weightClass}</span>
        </p>
      </section>

      <section className="pt-10">
        <h2 className="border-b border-rule pb-2 text-[13px] font-medium text-chalk-dim">
          Your lifts
        </h2>

        <div>
          {MOVEMENTS.map((movement) => (
            <LiftRowForm
              key={movement.id}
              movement={movement}
              existing={byMovement.get(movement.id)}
            />
          ))}
        </div>
      </section>

      <section className="pt-10">
        <h2 className="border-b border-rule pb-2 text-[13px] font-medium text-chalk-dim">
          Get co-signed
        </h2>
        <p className="mt-3 text-[13px] leading-relaxed text-chalk-dim">
          Numbers here are self-reported. Someone who watched your set can
          vouch for it from your page — send them this link, or have them
          open it on your phone right after the set.
        </p>
        <Link
          href={`/lifter/${lifter.id}`}
          className={`${navButton} mt-3 w-fit`}
        >
          Your public page
          <ChevronRight />
        </Link>
      </section>

      <details className="pt-8">
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between rounded-sm border border-rule px-4 text-[15px] text-chalk-dim transition-colors hover:border-chalk-faint hover:text-chalk">
          Edit name or bodyweight
          <span aria-hidden className="text-chalk-faint">+</span>
        </summary>
        <div className="pt-5">
          <ProfileForm
            defaultName={lifter.displayName}
            defaultBodyweight={lifter.bodyweightKg}
            submitLabel="Save profile"
          />
        </div>
      </details>

      <form
        className="pt-8"
        action={async () => {
          "use server";
          await signOut({ redirectTo: "/" });
        }}
      >
        <button type="submit" className={quietButton}>
          Sign out
        </button>
      </form>
    </div>
  );
}

function ChevronRight() {
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

// Outlined: navigation and account controls. Visibly tappable, but clearly
// not the main action on the screen.
const navButton =
  "inline-flex min-h-11 items-center gap-1.5 rounded-sm border border-rule px-3.5 text-[15px] text-chalk-dim transition-colors hover:border-chalk-faint hover:text-chalk";

const quietButton =
  "inline-flex min-h-11 items-center rounded-sm border border-rule px-4 text-[15px] text-chalk-faint transition-colors hover:border-chalk-faint hover:text-chalk";
