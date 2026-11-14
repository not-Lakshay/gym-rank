import { Suspense } from "react";
import Link from "next/link";
import { auth, signIn, signOut } from "@/auth";
import { saveLiftAction, saveProfileAction } from "@/app/actions";
import {
  MOVEMENTS,
  type Lift,
  type Lifter,
  getLifterByEmail,
  getLiftsFor,
  summarise,
} from "@/lib/lifters";
import { weightClassFor } from "@/lib/scoring";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-full w-full max-w-md flex-col gap-8 px-5 py-10">
      <header className="flex flex-col gap-2">
        <Link
          href="/"
          className="text-sm text-black/50 hover:text-black dark:text-white/50 dark:hover:text-white"
        >
          &larr; Leaderboard
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight">Your lifts</h1>
      </header>

      {/* Reads the session cookie, so it has to sit behind a boundary:
          with cacheComponents on, reading cookies() outside one is a
          build error. */}
      <Suspense fallback={<p className="text-sm text-black/45">Loading…</p>}>
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
      <form
        action={async () => {
          "use server";
          await signIn("google", { redirectTo: "/" });
        }}
      >
        <button type="submit" className={primaryButton}>
          Sign in with Google
        </button>
      </form>
    );
  }

  const lifter = await getLifterByEmail(email);

  if (!lifter) {
    return (
      <ProfileForm
        defaultName={session?.user?.name ?? ""}
        heading="Set up your profile"
        blurb="Bodyweight is needed to score your lifts — it's never shown publicly, only your weight class is."
        submitLabel="Continue"
      />
    );
  }

  const lifts = await getLiftsFor(lifter.id);
  return <LifterView lifter={lifter} lifts={lifts} />;
}

function LifterView({ lifter, lifts }: { lifter: Lifter; lifts: Lift[] }) {
  const summary = summarise(lifts, lifter.bodyweightKg);
  const byMovement = new Map(lifts.map((l) => [l.movement, l]));

  return (
    <div className="flex flex-col gap-8">
      <section className="rounded-2xl border border-black/10 p-5 dark:border-white/15">
        <p className="text-sm font-medium">{lifter.displayName}</p>
        <p className="text-xs text-black/50 dark:text-white/50">
          {weightClassFor(lifter.bodyweightKg)}
        </p>

        <div className="mt-4">
          {summary.dots === null ? (
            <p className="text-sm text-black/55 dark:text-white/55">
              Enter{" "}
              {summary.missingForTotal
                .map((m) => MOVEMENTS.find((x) => x.id === m)?.label.toLowerCase())
                .join(", ")}{" "}
              to get your score.
            </p>
          ) : (
            <>
              <p className="text-4xl font-semibold tabular-nums">
                {summary.dots.toFixed(1)}
              </p>
              <p className="text-xs text-black/50 dark:text-white/50">
                pound-for-pound score · {summary.totalKg?.toFixed(1)}kg total
              </p>
            </>
          )}
        </div>
      </section>

      <section className="flex flex-col gap-5">
        <h2 className="text-sm font-medium uppercase tracking-wide text-black/50 dark:text-white/50">
          Your lifts
        </h2>

        {MOVEMENTS.map((movement) => {
          const existing = byMovement.get(movement.id);
          const isPullups = movement.id === "pullups";

          return (
            <form
              key={movement.id}
              action={saveLiftAction}
              className="flex flex-col gap-2 rounded-2xl border border-black/10 p-4 dark:border-white/15"
            >
              <input type="hidden" name="movement" value={movement.id} />

              <div className="flex items-baseline justify-between">
                <span className="text-sm font-medium">{movement.label}</span>
                {existing && (
                  <span className="text-xs tabular-nums text-black/50 dark:text-white/50">
                    {isPullups
                      ? `${existing.reps} reps`
                      : `est. 1RM ${existing.est1rmKg?.toFixed(1)}kg`}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                {!isPullups && (
                  <label className="flex-1">
                    <span className="sr-only">Weight in kg</span>
                    <input
                      name="weightKg"
                      type="number"
                      inputMode="decimal"
                      step="0.5"
                      min="1"
                      max={movement.maxKg ?? undefined}
                      required
                      defaultValue={existing?.weightKg ?? ""}
                      placeholder="kg"
                      className={input}
                    />
                  </label>
                )}

                <label className="flex-1">
                  <span className="sr-only">Reps</span>
                  <input
                    name="reps"
                    type="number"
                    inputMode="numeric"
                    step="1"
                    min="1"
                    max={isPullups ? 100 : 100}
                    required
                    defaultValue={existing?.reps ?? ""}
                    placeholder="reps"
                    className={input}
                  />
                </label>

                <button type="submit" className={secondaryButton}>
                  Save
                </button>
              </div>

              {!isPullups && (
                <p className="text-xs text-black/40 dark:text-white/40">
                  Weight x reps from a real set — the 1RM is estimated for you.
                </p>
              )}
            </form>
          );
        })}
      </section>

      <details className="rounded-2xl border border-black/10 p-4 dark:border-white/15">
        <summary className="cursor-pointer text-sm font-medium">
          Edit profile
        </summary>
        <div className="pt-4">
          <ProfileForm
            defaultName={lifter.displayName}
            defaultBodyweight={lifter.bodyweightKg}
            submitLabel="Save profile"
          />
        </div>
      </details>

      <form
        action={async () => {
          "use server";
          await signOut({ redirectTo: "/" });
        }}
      >
        <button type="submit" className={secondaryButton}>
          Sign out
        </button>
      </form>
    </div>
  );
}

function ProfileForm({
  defaultName,
  defaultBodyweight,
  heading,
  blurb,
  submitLabel,
}: {
  defaultName: string;
  defaultBodyweight?: number;
  heading?: string;
  blurb?: string;
  submitLabel: string;
}) {
  return (
    <form action={saveProfileAction} className="flex flex-col gap-4">
      {heading && <h2 className="text-lg font-medium">{heading}</h2>}
      {blurb && (
        <p className="text-sm text-black/55 dark:text-white/55">{blurb}</p>
      )}

      <label className="flex flex-col gap-1">
        <span className="text-xs text-black/55 dark:text-white/55">
          Display name
        </span>
        <input
          name="displayName"
          type="text"
          minLength={2}
          maxLength={40}
          required
          defaultValue={defaultName}
          className={input}
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-xs text-black/55 dark:text-white/55">
          Bodyweight (kg)
        </span>
        <input
          name="bodyweightKg"
          type="number"
          inputMode="decimal"
          step="0.1"
          min="30"
          max="250"
          required
          defaultValue={defaultBodyweight ?? ""}
          className={input}
        />
      </label>

      <button type="submit" className={primaryButton}>
        {submitLabel}
      </button>
    </form>
  );
}

const input =
  "w-full rounded-lg border border-black/15 bg-transparent px-3 py-2 text-sm outline-none focus:border-black/40 dark:border-white/20 dark:focus:border-white/50";

const primaryButton =
  "rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-opacity hover:opacity-85";

const secondaryButton =
  "rounded-full border border-black/15 px-4 py-2 text-sm font-medium transition-colors hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10";
