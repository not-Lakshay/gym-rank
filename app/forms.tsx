"use client";

import { useActionState } from "react";
import type { ActionState } from "@/app/actions";
import {
  cosignLiftAction,
  saveLiftAction,
  saveProfileAction,
} from "@/app/actions";
import { MOVEMENTS } from "@/lib/movements";
import type { Lift } from "@/lib/lifters";

const initial: ActionState = { error: null };

/*
  The forms are client components for one reason: useActionState, so a
  validation failure renders as a line of text under the field instead of
  Next's error boundary. Everything else about them is still a plain
  <form action>, which works without JavaScript — the message just arrives
  as a full page render instead.
*/

export function LiftRowForm({
  movement,
  existing,
}: {
  movement: (typeof MOVEMENTS)[number];
  existing: Lift | undefined;
}) {
  const [state, action, pending] = useActionState(saveLiftAction, initial);
  const isPullups = movement.id === "pullups";

  const delta = deltaFor(existing);

  return (
    <form action={action} className="border-b border-rule py-3">
      <div className="flex items-center gap-3">
        <input type="hidden" name="movement" value={movement.id} />

        <div className="min-w-0 flex-1">
          <label className="block text-[14px] font-medium">
            {movement.label}
          </label>
          <span className="tnum block text-[11px] text-chalk-faint">
            {existing
              ? isPullups
                ? `${existing.reps} reps`
                : `est. 1RM ${existing.est1rmKg?.toFixed(1)} kg`
              : isPullups
                ? "max reps"
                : "weight x reps"}
            {delta && (
              <span className={delta.up ? "text-chalk-dim" : ""}>
                {" "}
                · {delta.text}
              </span>
            )}
            {existing?.verifiedByName && (
              <span> · co-signed by {existing.verifiedByName}</span>
            )}
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

        <button type="submit" disabled={pending} className={secondary}>
          {pending ? "…" : "Save"}
        </button>
      </div>

      {state.error && (
        <p role="alert" className="mt-2 text-[12px] text-[var(--plate-25)]">
          {state.error}
        </p>
      )}
    </form>
  );
}

function deltaFor(lift: Lift | undefined) {
  if (!lift || lift.previousValue === null) return null;
  const current = lift.movement === "pullups" ? lift.reps : lift.est1rmKg;
  if (current === null) return null;
  const diff = current - lift.previousValue;
  if (Math.abs(diff) < 0.05) return { up: false, text: "same as last entry" };
  const unit = lift.movement === "pullups" ? " reps" : " kg";
  const sign = diff > 0 ? "+" : "−";
  return {
    up: diff > 0,
    text: `${sign}${Math.abs(diff).toFixed(lift.movement === "pullups" ? 0 : 1)}${unit} since last entry`,
  };
}

export function ProfileForm({
  defaultName,
  defaultBodyweight,
  submitLabel,
}: {
  defaultName: string;
  defaultBodyweight?: number;
  submitLabel: string;
}) {
  const [state, action, pending] = useActionState(saveProfileAction, initial);

  return (
    <form action={action} className="flex flex-col gap-4">
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

      {state.error && (
        <p role="alert" className="text-[12px] text-[var(--plate-25)]">
          {state.error}
        </p>
      )}

      <button type="submit" disabled={pending} className={`${primary} w-fit`}>
        {pending ? "Saving…" : submitLabel}
      </button>
    </form>
  );
}

export function CosignButton({ liftId }: { liftId: string }) {
  const [state, action, pending] = useActionState(cosignLiftAction, initial);

  return (
    <form action={action} className="shrink-0 text-right">
      <input type="hidden" name="liftId" value={liftId} />
      <button type="submit" disabled={pending} className={secondary}>
        {pending ? "…" : "I saw this"}
      </button>
      {state.error && (
        <p role="alert" className="mt-1 text-[11px] text-[var(--plate-25)]">
          {state.error}
        </p>
      )}
    </form>
  );
}

// 16px is deliberate: iOS Safari zooms the page when an input with a smaller
// font size is focused. min-h-11 keeps the tap target thumb-sized.
export const field =
  "tnum min-h-11 w-[4.5rem] shrink-0 rounded-sm border border-rule bg-iron-raised px-3 text-[16px] text-chalk outline-none transition-colors placeholder:text-chalk-faint focus:border-chalk-dim";

export const primary =
  "inline-flex min-h-11 items-center justify-center rounded-sm bg-chalk px-5 text-[15px] font-bold text-iron transition-opacity hover:opacity-85 disabled:opacity-60";

export const secondary =
  "inline-flex min-h-11 shrink-0 items-center justify-center rounded-sm border border-rule px-4 text-[15px] font-medium text-chalk transition-colors hover:border-chalk-dim disabled:opacity-60";
