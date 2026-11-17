"use client";

import { useActionState, useEffect, useState } from "react";
import type { ActionState } from "@/app/actions";
import {
  checkUsernameAction,
  cosignLiftAction,
  deleteMyAccountAction,
  removeLiftAction,
  saveLiftsAction,
  saveProfileAction,
} from "@/app/actions";
import { MOVEMENTS, TOTAL_MOVEMENTS, type Movement } from "@/lib/movements";
import type { Lift } from "@/lib/lifters";
import { STANDARD_BODYWEIGHTS, noviceOneRepMax } from "@/lib/standards";
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

type Row = { kg: string; reps: string };
const rowFrom = (lift: Lift | undefined): Row => ({
  kg: lift?.weightKg?.toString() ?? "",
  reps: lift?.reps?.toString() ?? "",
});

/*
  Every lift in one form with one Save. Only rows that changed are saved
  (see saveLiftsAction), so pressing Save never voids the co-signs on a
  lift you didn't touch.
*/
export function LiftsForm({
  lifts,
  standings,
  boardHref,
  bodyweightKg,
}: {
  lifts: Partial<Record<Movement, Lift>>;
  /** Rank on each lift's college board, once entered. */
  standings: Partial<Record<Movement, { rank: number; of: number }>>;
  /** The college board; each row links to its lift's tab. */
  boardHref: string;
  bodyweightKg: number;
}) {
  const [state, action, pending] = useActionState(saveLiftsAction, initial);
  const stored = Object.fromEntries(MOVEMENTS.map((m) => [m.id, rowFrom(lifts[m.id])]));
  const [rows, setRows] = useState<Record<string, Row>>(stored);
  const dirty = MOVEMENTS.some(
    (m) => rows[m.id].kg !== stored[m.id].kg || rows[m.id].reps !== stored[m.id].reps,
  );

  const [dismissedAt, setDismissedAt] = useState(0);
  const justSaved = !!state.savedAt && state.savedAt > dismissedAt;
  useEffect(() => {
    if (!justSaved) return;
    const t = setTimeout(() => setDismissedAt(state.savedAt!), 1800);
    return () => clearTimeout(t);
  }, [justSaved, state.savedAt]);

  return (
    <form action={action}>
      {MOVEMENTS.map((movement) => (
        <LiftRow
          key={movement.id}
          movement={movement}
          existing={lifts[movement.id]}
          standing={standings[movement.id] ?? null}
          boardHref={`${boardHref}?tab=${movement.id}`}
          bodyweightKg={bodyweightKg}
          row={rows[movement.id]}
          onChange={(row) => setRows((all) => ({ ...all, [movement.id]: row }))}
        />
      ))}

      <p className="mt-3 text-[12px] leading-relaxed text-chalk-faint">
        Your DOTS score only needs squat, bench and deadlift. Overhead press
        and pull-ups are optional — they just put you on those lift boards.
      </p>

      {state.error && (
        <p role="alert" className="mt-3 text-[12px] text-[var(--plate-25)]">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending || (!dirty && !justSaved)}
        className={`${primary} mt-4 w-full ${
          justSaved ? "bg-[var(--plate-10)]" : ""
        }`}
      >
        {pending ? "Saving…" : justSaved ? "Saved" : "Save lifts"}
      </button>
    </form>
  );
}

function LiftRow({
  movement,
  existing,
  standing,
  boardHref,
  bodyweightKg,
  row,
  onChange,
}: {
  movement: (typeof MOVEMENTS)[number];
  existing: Lift | undefined;
  standing: { rank: number; of: number } | null;
  boardHref: string;
  bodyweightKg: number;
  row: Row;
  onChange: (row: Row) => void;
}) {
  const isPullups = movement.id === "pullups";
  const optional = !TOTAL_MOVEMENTS.includes(movement.id);
  const delta = deltaFor(existing);

  return (
    <div className="border-b border-rule py-3">
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5 text-[14px] font-medium">
            {movement.label}
            {optional && (
              <span className="rounded-sm border border-rule px-1 text-[10px] font-bold uppercase leading-[1.4] tracking-wide text-chalk-faint">
                optional
              </span>
            )}
          </span>
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
            {existing && existing.cosigners.length > 0 && (
              <span> · co-signed by {existing.cosigners.map((c) => c.name).join(", ")}</span>
            )}
            {standing && (
              <span>
                {" "}
                ·{" "}
                <a
                  href={boardHref}
                  className="text-chalk-dim underline-offset-4 hover:text-chalk hover:underline"
                >
                  #{standing.rank} of {standing.of}
                </a>
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
            name={`${movement.id}.kg`}
            type="number"
            inputMode="decimal"
            step="0.5"
            min="1"
            max={movement.maxKg ?? undefined}
            value={row.kg}
            onChange={(e) => onChange({ ...row, kg: e.target.value })}
            placeholder="kg"
            aria-label={`${movement.label} weight in kg`}
            className={field}
          />
        )}

        <input
          name={`${movement.id}.reps`}
          type="number"
          inputMode="numeric"
          step="1"
          min="1"
          max="100"
          value={row.reps}
          onChange={(e) => onChange({ ...row, reps: e.target.value })}
          placeholder="reps"
          aria-label={`${movement.label} reps`}
          className={field}
        />
      </div>

      {!optional && !existing && (
        <NeverDone
          movement={movement}
          bodyweightKg={bodyweightKg}
          onUse={(kg) => onChange({ kg: String(kg), reps: "1" })}
        />
      )}
      {existing && (
        <RemoveLift
          movement={movement}
          cosigns={existing.cosigners.length}
          inTotal={!optional}
          onRemoved={() => onChange({ kg: "", reps: "" })}
        />
      )}
    </div>
  );
}

/*
  Two taps, like deleting the account: the first says what will go, the
  second removes it. It sits inside the lifts form (forms can't nest), so
  it submits that form to removeLiftAction via formAction instead.
*/
function RemoveLift({
  movement,
  cosigns,
  inTotal,
  onRemoved,
}: {
  movement: (typeof MOVEMENTS)[number];
  cosigns: number;
  /** Squat, bench or deadlift: removing it takes away the DOTS score. */
  inTotal: boolean;
  /** Empties the row, so the old numbers aren't sitting there to re-save. */
  onRemoved: () => void;
}) {
  const [state, action, pending] = useActionState(removeLiftAction, initial);
  const [armed, setArmed] = useState(false);
  const name = movement.label.toLowerCase();

  useEffect(() => {
    if (state.savedAt) onRemoved();
    // Only when a removal lands, not when the parent re-renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.savedAt]);

  return (
    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
      {armed ? (
        <>
          <button
            type="submit"
            formAction={action}
            name="movement"
            value={movement.id}
            disabled={pending}
            className="press text-[12px] font-bold text-[var(--plate-25)] underline-offset-4 hover:underline"
          >
            {pending ? "Removing…" : `Yes, remove my ${name}`}
          </button>
          <button
            type="button"
            onClick={() => setArmed(false)}
            className="text-[12px] text-chalk-faint hover:text-chalk"
          >
            Keep it
          </button>
          <p className="basis-full text-[12px] leading-relaxed text-chalk-dim">
            Removes your {name}
            {cosigns > 0 && ` and its ${cosigns} co-sign${cosigns === 1 ? "" : "s"}`}.
            {inTotal &&
              " Your DOTS score needs squat, bench and deadlift, so you'll leave the board until you enter it again."}
          </p>
        </>
      ) : (
        <button
          type="button"
          onClick={() => setArmed(true)}
          className="text-[12px] text-chalk-faint underline-offset-4 hover:text-chalk hover:underline"
        >
          Remove
        </button>
      )}
      {state.error && (
        <p role="alert" className="basis-full text-[12px] text-[var(--plate-25)]">
          {state.error}
        </p>
      )}
    </div>
  );
}

/*
  For someone who has never done this lift: what a beginner of each
  bodyweight typically lifts, with theirs picked out, and a button that
  puts it in the row as a single. Only shown until the lift is entered.
*/
function NeverDone({
  movement,
  bodyweightKg,
  onUse,
}: {
  movement: (typeof MOVEMENTS)[number];
  bodyweightKg: number;
  onUse: (kg: number) => void;
}) {
  const mine = noviceOneRepMax(movement.id, bodyweightKg);
  if (mine === null) return null;
  const name = movement.label.toLowerCase();

  return (
    <details className="group mt-2">
      <summary className="w-fit cursor-pointer list-none text-[12px] text-chalk-dim underline-offset-4 hover:text-chalk hover:underline [&::-webkit-details-marker]:hidden">
        Never done a {name}?
      </summary>
      <div className="mt-2 rounded-sm border border-rule p-3">
        <p className="text-[12px] leading-relaxed text-chalk-dim">
          Typical one-rep max for a beginner, by bodyweight. Use yours to get
          a score now, and replace it once you&rsquo;ve done the lift.
        </p>
        <table className="tnum mt-2 w-full text-[12px]">
          <thead>
            <tr className="text-left text-chalk-faint">
              <th className="py-1 font-medium">Bodyweight</th>
              <th className="py-1 text-right font-medium">Typical {name}</th>
            </tr>
          </thead>
          <tbody>
            {STANDARD_BODYWEIGHTS.map((bw) => (
              <tr key={bw} className="border-t border-rule text-chalk-dim">
                <td className="py-1">{bw} kg</td>
                <td className="py-1 text-right">{noviceOneRepMax(movement.id, bw)} kg</td>
              </tr>
            ))}
            <tr className="border-t border-rule font-bold text-chalk">
              <td className="py-1">You · {bodyweightKg} kg</td>
              <td className="py-1 text-right">{mine} kg</td>
            </tr>
          </tbody>
        </table>
        <button
          type="button"
          onClick={() => onUse(mine)}
          className={`${secondary} mt-3 min-h-9 px-3 text-[13px]`}
        >
          Use {mine} kg × 1
        </button>
      </div>
    </details>
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



/*
  Delete your own account. Two taps: the first arms the button and says
  what will happen, the second does it. Nothing modal.
*/
export function DeleteAccountButton() {
  const [state, action, pending] = useActionState(deleteMyAccountAction, initial);
  const [armed, setArmed] = useState(false);

  const look = armed
    ? "border-[var(--plate-25)] text-[var(--plate-25)]"
    : "border-rule text-chalk-faint hover:border-chalk-faint hover:text-chalk";

  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!armed) {
          e.preventDefault();
          setArmed(true);
          setTimeout(() => setArmed(false), 6000);
        }
      }}
      className="flex flex-col items-start gap-2"
    >
      {armed && (
        <p className="text-[12px] leading-relaxed text-chalk-dim">
          Deletes your profile, your lifts and their history, and any
          co-signs on them. Cannot be undone. Tap again to confirm.
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className={`press inline-flex min-h-11 items-center rounded-sm border px-4 text-[15px] ${look}`}
      >
        {pending ? "Deleting…" : armed ? "Yes, delete my account" : "Delete my account"}
      </button>
      {state.error && (
        <p role="alert" className="text-[12px] text-[var(--plate-25)]">
          {state.error}
        </p>
      )}
    </form>
  );
}
