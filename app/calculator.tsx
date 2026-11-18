"use client";

import { useState } from "react";
import {
  dotsScore,
  estimatedOneRepMax,
  weightClassFor,
} from "@/lib/scoring";
import {
  MAX_BODYWEIGHT,
  MAX_SCORED_REPS,
  MIN_BODYWEIGHT,
  validateBodyweight,
  validateLift,
} from "@/lib/validate";
import { saveTryout } from "@/lib/tryout";
import { field } from "./forms";

type Set = { kg: string; reps: string };
const empty: Set = { kg: "", reps: "" };

/*
  Try-before-you-sign-in. The scoring is pure arithmetic that already runs
  on the server, so running it in the browser costs nothing and removes the
  biggest ask in the funnel: handing over a Google account before you know
  whether the number is worth having.

  `boardDots` is the current board's scores, already sorted descending — the
  page fetched them for the board anyway, so the projected rank is a binary
  search, not a query.
*/
export function Calculator({
  boardDots,
  signInForm,
}: {
  boardDots: number[];
  signInForm: React.ReactNode;
}) {
  const [bw, setBw] = useState("");
  const [sets, setSets] = useState<Record<"squat" | "bench" | "deadlift", Set>>({
    squat: empty,
    bench: empty,
    deadlift: empty,
  });

  const bodyweight = Number(bw);
  const lifts = ["squat", "bench", "deadlift"] as const;
  const oneRm = Object.fromEntries(
    lifts.map((m) => [
      m,
      estimatedOneRepMax(Number(sets[m].kg), Number(sets[m].reps)),
    ]),
  ) as Record<(typeof lifts)[number], number>;
  const total = lifts.reduce((sum, m) => sum + oneRm[m], 0);

  /*
    The same rules the server action applies, from the same module. Without
    this the preview will happily score 500 kg of bodyweight and then the
    board rejects it on save — the min/max attributes on the inputs below
    do nothing, because nothing here submits a form.

    Only filled-in fields are judged, so the message appears when someone
    has typed something wrong, not while they are still typing.
  */
  function firstError(): string | null {
    const bodyweightError =
      bw.trim() === "" ? null : validateBodyweight(bodyweight);
    if (bodyweightError) return bodyweightError;

    for (const m of lifts) {
      if (sets[m].kg.trim() === "" || sets[m].reps.trim() === "") continue;
      const liftError = validateLift({
        movement: m,
        weightKg: Number(sets[m].kg),
        reps: Number(sets[m].reps),
        bodyweightKg: bodyweight,
      });
      if (liftError) return liftError;
    }
    return null;
  }

  const error = firstError();
  const complete =
    error === null &&
    validateBodyweight(bodyweight) === null &&
    lifts.every((m) => oneRm[m] > 0);
  const dots = complete ? dotsScore(total, bodyweight) : null;
  const filled =
    (validateBodyweight(bodyweight) === null && bw.trim() !== "" ? 1 : 0) +
    lifts.filter((m) => oneRm[m] > 0).length;

  // rank = 1 + number of lifters strictly ahead
  const ahead = dots === null ? 0 : boardDots.filter((d) => d > dots).length;
  const rank = ahead + 1;
  const of = boardDots.length + 1;

  function update(m: keyof typeof sets, key: keyof Set, value: string) {
    setSets((s) => ({ ...s, [m]: { ...s[m], [key]: value } }));
  }

  // The caller frames it (a card, a heading); this is just the sums.
  return (
    <div className="mt-4">
      <p className="text-[12px] leading-relaxed text-chalk-dim">
        Your heaviest set of each: the weight, and the reps you got at it.
      </p>

      <div className="mt-4 flex flex-col gap-3">
        <label className="flex items-center gap-3">
          <span className="min-w-0 flex-1 text-[14px] font-medium">
            Bodyweight
          </span>
          <input
            type="number"
            inputMode="decimal"
            step="0.1"
            min={MIN_BODYWEIGHT}
            max={MAX_BODYWEIGHT}
            placeholder="kg"
            value={bw}
            onChange={(e) => setBw(e.target.value)}
            className={field}
            aria-label="Bodyweight in kg"
          />
          <span className="w-[4.5rem] shrink-0" aria-hidden />
        </label>

        {(
          [
            ["squat", "Squat"],
            ["bench", "Bench press"],
            ["deadlift", "Deadlift"],
          ] as const
        ).map(([id, label]) => (
          <div key={id} className="flex items-center gap-3">
            <span className="min-w-0 flex-1">
              <span className="block text-[14px] font-medium">{label}</span>
              {oneRm[id] > 0 && (
                <span className="tnum text-[11px] text-chalk-faint">
                  est. 1RM {oneRm[id].toFixed(1)} kg
                </span>
              )}
            </span>
            <input
              type="number"
              inputMode="decimal"
              step="0.5"
              min="1"
              placeholder="kg"
              value={sets[id].kg}
              onChange={(e) => update(id, "kg", e.target.value)}
              className={field}
              aria-label={`${label} weight in kg`}
            />
            <input
              type="number"
              inputMode="numeric"
              step="1"
              min="1"
              max={MAX_SCORED_REPS}
              placeholder="reps"
              value={sets[id].reps}
              onChange={(e) => update(id, "reps", e.target.value)}
              className={field}
              aria-label={`${label} reps`}
            />
          </div>
        ))}
      </div>

      <div className="mt-5 flex items-end justify-between gap-4 border-t border-rule pt-4">
        {error ? (
          <p
            role="alert"
            className="text-[13px] leading-relaxed text-[var(--plate-25)]"
          >
            {error}
          </p>
        ) : dots === null ? (
          <p className="text-[13px] text-chalk-dim">
            {filled === 0
              ? "Fill in bodyweight and all three lifts."
              : `${filled} of 4 filled — ${4 - filled} to go.`}
          </p>
        ) : (
          <div key={dots.toFixed(1)} className="rise">
            <p className="tnum text-[2.5rem] font-extrabold leading-none tracking-[-0.03em]">
              {dots.toFixed(1)}
            </p>
            <p className="tnum mt-2 text-[13px] text-chalk-dim">
              #{rank} of {of}
              <span className="text-chalk-faint">
                {" "}
                · {total.toFixed(0)} kg total · {weightClassFor(bodyweight)}
              </span>
            </p>
          </div>
        )}
        {dots !== null && (
          // "Save it" signs in; keep the numbers so sign-up starts with them.
          <div
            className="shrink-0"
            onSubmitCapture={() => saveTryout({ bodyweight: bw, ...sets })}
          >
            {signInForm}
          </div>
        )}
      </div>
    </div>
  );
}
