"use client";

import { useActionState, useEffect, useState } from "react";
import type { ActionState } from "@/app/actions";
import {
  checkUsernameAction,
  cosignLiftAction,
  saveLiftAction,
  saveProfileAction,
} from "@/app/actions";
import { MOVEMENTS } from "@/lib/movements";
import type { Lift } from "@/lib/lifters";
import { siteLabel } from "@/lib/site";
import {
  USERNAME_MAX,
  USERNAME_MIN,
  normalizeUsername,
  validateUsername,
} from "@/lib/username";

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
  standing = null,
  boardHref,
}: {
  movement: (typeof MOVEMENTS)[number];
  existing: Lift | undefined;
  /** Rank on this lift's college board, once the lift is entered. */
  standing?: { rank: number; of: number } | null;
  boardHref?: string;
}) {
  const [state, action, pending] = useActionState(saveLiftAction, initial);
  const isPullups = movement.id === "pullups";

  const delta = deltaFor(existing);

  // Save only lights up once a value differs from what is stored. Five
  // identical Save buttons give no hint which row you touched.
  const storedKg = existing?.weightKg?.toString() ?? "";
  const storedReps = existing?.reps?.toString() ?? "";
  const [kg, setKg] = useState(storedKg);
  const [reps, setReps] = useState(storedReps);
  const dirty = (!isPullups && kg !== storedKg) || reps !== storedReps;

  const [dismissedAt, setDismissedAt] = useState(0);
  const justSaved = !!state.savedAt && state.savedAt > dismissedAt;
  useEffect(() => {
    if (!justSaved) return;
    const t = setTimeout(() => setDismissedAt(state.savedAt!), 1800);
    return () => clearTimeout(t);
  }, [justSaved, state.savedAt]);

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
            {standing && (
              <span>
                {" "}
                ·{" "}
                {boardHref ? (
                  <a
                    href={boardHref}
                    className="text-chalk-dim underline-offset-4 hover:text-chalk hover:underline"
                  >
                    #{standing.rank} of {standing.of}
                  </a>
                ) : (
                  <span className="text-chalk-dim">
                    #{standing.rank} of {standing.of}
                  </span>
                )}
              </span>
            )}
          </span>
        </div>

        {isPullups ? (
          <span
            aria-hidden
            className="flex min-h-11 w-[4.5rem] shrink-0 items-center justify-center text-[11px] text-chalk-faint"
          >
            bodyweight
          </span>
        ) : (
          <input
            name="weightKg"
            type="number"
            inputMode="decimal"
            step="0.5"
            min="1"
            max={movement.maxKg ?? undefined}
            required
            value={kg}
            onChange={(e) => setKg(e.target.value)}
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
          value={reps}
          onChange={(e) => setReps(e.target.value)}
          placeholder="reps"
          aria-label={`${movement.label} reps`}
          className={field}
        />

        <button
          type="submit"
          disabled={pending || (!dirty && !justSaved)}
          className={`${secondary} ${
            justSaved
              ? "border-[var(--plate-10)] text-[var(--plate-10)]"
              : dirty
                ? "border-chalk bg-chalk text-iron hover:opacity-85"
                : ""
          }`}
        >
          {pending ? "…" : justSaved ? "Saved" : "Save"}
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

type Availability =
  | { kind: "idle" }
  | { kind: "checking" }
  | { kind: "ok"; message: string }
  | { kind: "bad"; message: string };

/*
  The username field checks itself as you type: local rules instantly, then
  the server for "is it taken" after a pause. Nobody should learn their
  handle is gone from the error after pressing Save.
*/
function UsernameField({
  defaultUsername,
  current,
}: {
  defaultUsername: string;
  /** The handle already saved, if editing — always reported as yours. */
  current: string | null;
}) {
  const [value, setValue] = useState(defaultUsername);
  const [status, setStatus] = useState<Availability>({ kind: "idle" });
  const username = normalizeUsername(value);

  useEffect(() => {
    if (username === "" || username === current) return;
    const local = validateUsername(username);
    // Local failures are shown synchronously below; only a locally valid
    // handle is worth a round trip.
    if (local) return;
    const t = setTimeout(async () => {
      setStatus({ kind: "checking" });
      try {
        const result = await checkUsernameAction(username);
        setStatus({ kind: result.ok ? "ok" : "bad", message: result.message });
      } catch {
        setStatus({ kind: "idle" });
      }
    }, 350);
    return () => clearTimeout(t);
  }, [username, current]);

  const local = username === "" ? null : validateUsername(username);
  const shown: Availability =
    username === current && current !== null
      ? { kind: "ok", message: `@${current} is yours.` }
      : local
        ? { kind: "bad", message: local }
        : status;

  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[12px] text-chalk-dim">Username</span>
      <span className="relative block">
        <span
          aria-hidden
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[16px] text-chalk-faint"
        >
          @
        </span>
        <input
          name="username"
          type="text"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          minLength={USERNAME_MIN}
          maxLength={USERNAME_MAX}
          required
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className={`${field} w-full pl-7 text-left`}
          aria-describedby="username-status"
        />
      </span>
      <span
        id="username-status"
        className={`min-h-4 text-[12px] ${
          shown.kind === "bad"
            ? "text-[var(--plate-25)]"
            : shown.kind === "ok"
              ? "text-[var(--plate-10)]"
              : "text-chalk-faint"
        }`}
      >
        {shown.kind === "checking"
          ? "Checking…"
          : shown.kind === "idle"
            ? `Your link: ${siteLabel}/u/your-handle. Letters, numbers, dots, underscores.`
            : shown.message}
      </span>
    </label>
  );
}

export function ProfileForm({
  defaultName,
  defaultUsername,
  currentUsername = null,
  defaultBodyweight,
  submitLabel,
  college,
}: {
  defaultName: string;
  defaultUsername: string;
  currentUsername?: string | null;
  defaultBodyweight?: number;
  submitLabel: string;
  /** Rendered by the server (a CollegeField); the form just hosts it. */
  college: React.ReactNode;
}) {
  const [state, action, pending] = useActionState(saveProfileAction, initial);

  return (
    <form action={action} className="flex flex-col gap-4">
      {college}

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

      <UsernameField defaultUsername={defaultUsername} current={currentUsername} />

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
  "press inline-flex min-h-11 items-center justify-center rounded-sm bg-chalk px-5 text-[15px] font-bold text-iron hover:opacity-85 disabled:opacity-60";

export const secondary =
  "press inline-flex min-h-11 shrink-0 items-center justify-center rounded-sm border border-rule px-4 text-[15px] font-medium text-chalk hover:border-chalk-dim disabled:opacity-50";
