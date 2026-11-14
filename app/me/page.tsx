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
import { plateFor } from "@/lib/plates";
import { weightClassFor } from "@/lib/scoring";

export default function MePage() {
  return (
    <main className="mx-auto w-full max-w-md px-5 pb-16 pt-10">
      <Link
        href="/"
        className="text-[13px] text-chalk-dim transition-colors hover:text-chalk"
      >
        Back to the board
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
        <h1 className="text-[1.75rem] font-800 leading-none tracking-[-0.03em]">
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
        <h1 className="text-[1.75rem] font-800 leading-none tracking-[-0.03em]">
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
            <p className="text-[1.5rem] font-800 leading-tight tracking-[-0.02em]">
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
            <p className="tnum text-[4.5rem] font-800 leading-[0.85] tracking-[-0.045em]">
              {summary.dots.toFixed(1)}
            </p>
            <p className="mt-3 text-[13px] text-chalk-dim">
              pound for pound
              <span className="tnum text-chalk-faint">
                {" "}
                · {summary.totalKg?.toFixed(0)} kg total
              </span>
            </p>
          </div>
        )}

        <p className="mt-4 text-[14px] font-700">
          {lifter.displayName}
          <span className="font-400 text-chalk-dim"> · {weightClass}</span>
        </p>
      </section>

      <section className="pt-10">
        <h2 className="border-b border-rule pb-2 text-[13px] font-500 text-chalk-dim">
          Your lifts
        </h2>

        <div>
          {MOVEMENTS.map((movement) => {
            const existing = byMovement.get(movement.id);
            const isPullups = movement.id === "pullups";

            return (
              <form
                key={movement.id}
                action={saveLiftAction}
                className="flex items-center gap-3 border-b border-rule py-3"
              >
                <input type="hidden" name="movement" value={movement.id} />

                <div className="min-w-0 flex-1">
                  <label className="block text-[14px] font-500">
                    {movement.label}
                  </label>
                  <span className="tnum text-[11px] text-chalk-faint">
                    {existing
                      ? isPullups
                        ? `${existing.reps} reps`
                        : `est. 1RM ${existing.est1rmKg?.toFixed(1)} kg`
                      : isPullups
                        ? "max reps"
                        : "weight x reps"}
                  </span>
                </div>

                {!isPullups && (
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
                    aria-label={`${movement.label} weight in kg`}
                    className={field}
                  />
                )}

                <input
                  name="reps"
                  type="number"
                  inputMode="numeric"
                  step="1"
                  min="1"
                  max="100"
                  required
                  defaultValue={existing?.reps ?? ""}
                  placeholder="reps"
                  aria-label={`${movement.label} reps`}
                  className={field}
                />

                <button type="submit" className={secondary}>
                  Save
                </button>
              </form>
            );
          })}
        </div>
      </section>

      <details className="pt-8">
        <summary className="cursor-pointer text-[13px] text-chalk-dim transition-colors hover:text-chalk">
          Edit name or bodyweight
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
        <button
          type="submit"
          className="text-[13px] text-chalk-faint underline underline-offset-2 transition-colors hover:text-chalk"
        >
          Sign out
        </button>
      </form>
    </div>
  );
}

function ProfileForm({
  defaultName,
  defaultBodyweight,
  submitLabel,
}: {
  defaultName: string;
  defaultBodyweight?: number;
  submitLabel: string;
}) {
  return (
    <form action={saveProfileAction} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5">
        <span className="text-[12px] text-chalk-dim">Display name</span>
        <input
          name="displayName"
          type="text"
          minLength={2}
          maxLength={40}
          required
          defaultValue={defaultName}
          className={`${field} w-full text-left`}
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-[12px] text-chalk-dim">Bodyweight in kg</span>
        <input
          name="bodyweightKg"
          type="number"
          inputMode="decimal"
          step="0.1"
          min="30"
          max="250"
          required
          defaultValue={defaultBodyweight ?? ""}
          className={`${field} w-full text-left`}
        />
      </label>

      <button type="submit" className={`${primary} w-fit`}>
        {submitLabel}
      </button>
    </form>
  );
}

const field =
  "tnum w-16 shrink-0 rounded-sm border border-rule bg-iron-raised px-2.5 py-2 text-[14px] text-chalk outline-none transition-colors placeholder:text-chalk-faint focus:border-chalk-dim";

const primary =
  "rounded-sm bg-chalk px-4 py-2.5 text-[13px] font-700 text-iron transition-opacity hover:opacity-85";

const secondary =
  "shrink-0 rounded-sm border border-rule px-3 py-2 text-[13px] font-500 text-chalk transition-colors hover:border-chalk-dim";
