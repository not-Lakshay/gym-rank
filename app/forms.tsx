"use client";

import {
  startTransition,
  useActionState,
  useEffect,
  useState,
  useSyncExternalStore,
} from "react";
import type { ActionState } from "@/app/actions";
import {
  checkUsernameAction,
  cosignLiftAction,
  deleteMyAccountAction,
  doubtLiftAction,
  removeLiftAction,
  saveLiftsAction,
  saveProfileAction,
} from "@/app/actions";
import { MOVEMENTS, TOTAL_MOVEMENTS, type Movement } from "@/lib/movements";
import type { Lift } from "@/lib/lifters";
import { STANDARD_BODYWEIGHTS, estimatedLift, noviceOneRepMax } from "@/lib/standards";
import { estimatedOneRepMax } from "@/lib/scoring";
import { siteLabel } from "@/lib/site";
import { clearTryout, parseTryout, readTryout } from "@/lib/tryout";
import { AVATAR_SETS, avatarSrc } from "@/lib/avatars";
import { initials } from "@/lib/format";
import Image from "next/image";
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

// What they typed into a board's calculator before signing up
// (lib/tryout.ts). Null on the server and while hydrating, then read from
// this device; nothing else changes it mid-visit, so nothing to subscribe to.
const unsubscribed = () => () => {};
function useTryout() {
  return parseTryout(useSyncExternalStore(unsubscribed, readTryout, () => null));
}

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
  // A first-timer who tried the board's calculator starts with those numbers.
  const tried = useTryout();
  const prefilled = Object.keys(lifts).length === 0 && tried !== null;
  const start = prefilled
    ? { ...stored, squat: tried.squat, bench: tried.bench, deadlift: tried.deadlift }
    : stored;
  // What's been typed since, over the starting numbers.
  const [edits, setEdits] = useState<Record<string, Row>>({});
  const rows = { ...start, ...edits };
  // Each scored row's 1RM as typed (or saved), for the "Never done" estimates.
  const known = Object.fromEntries(
    TOTAL_MOVEMENTS.map((m) => [
      m,
      estimatedOneRepMax(Number(rows[m].kg), Number(rows[m].reps)) || 0,
    ]),
  ) as Partial<Record<Movement, number>>;
  const dirty = MOVEMENTS.some(
    (m) => rows[m.id].kg !== stored[m.id].kg || rows[m.id].reps !== stored[m.id].reps,
  );

  const [dismissedAt, setDismissedAt] = useState(0);
  const justSaved = !!state.savedAt && state.savedAt > dismissedAt;
  useEffect(() => {
    if (!justSaved) return;
    clearTryout(); // the calculator's numbers are saved for real now
    // Back up to the score and the college board button, to see the result.
    window.scrollTo({ top: 0, behavior: "smooth" });
    const t = setTimeout(() => setDismissedAt(state.savedAt!), 1800);
    return () => clearTimeout(t);
  }, [justSaved, state.savedAt]);
  const prs = state.prs ?? [];

  return (
    <form action={action}>
      {state.savedAt && (
        <Celebration key={state.savedAt} prs={prs} passed={state.passed ?? []} />
      )}
      {Object.keys(lifts).length === 0 && (
        <div className="mt-3 rounded-sm border border-rule p-3 text-[13px] leading-relaxed text-chalk-dim">
          <p className="font-bold text-chalk">What to enter</p>
          <p className="mt-1">
            For each lift, your <span className="text-chalk">heaviest set ever</span>:
            the most weight you&rsquo;ve lifted with good form, and how many reps
            you got <em>at that weight</em>.
          </p>
          <p className="mt-1">
            Squatted 100 kg for 3? Enter <span className="tnum text-chalk">100</span> kg
            and <span className="tnum text-chalk">3</span> reps. For pull-ups, enter the
            most you&rsquo;ve done in one go.
          </p>
          {prefilled && (
            <p className="mt-1 text-chalk">
              Squat, bench and deadlift are filled in from what you tried on the
              board. Check them, then save.
            </p>
          )}
        </div>
      )}
      {MOVEMENTS.map((movement) => (
        <LiftRow
          key={movement.id}
          movement={movement}
          existing={lifts[movement.id]}
          // OHP and pull-ups have no board tab any more, so no rank link.
          standing={TOTAL_MOVEMENTS.includes(movement.id) ? standings[movement.id] ?? null : null}
          boardHref={`${boardHref}?tab=${movement.id}`}
          bodyweightKg={bodyweightKg}
          known={known}
          row={rows[movement.id]}
          onChange={(row) => setEdits((all) => ({ ...all, [movement.id]: row }))}
          pr={prs.includes(movement.id)}
        />
      ))}

      <p className="mt-3 text-[12px] leading-relaxed text-chalk-faint">
        Your DOTS score only needs squat, bench and deadlift. Overhead press
        and pull-ups are optional — they show on your profile.
      </p>

      {state.error && (
        <p role="alert" className="mt-3 text-[12px] text-[var(--danger)]">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending || (!dirty && !justSaved)}
        className={`${primary} mt-4 w-full ${
          justSaved ? "bg-[var(--success)]" : ""
        }`}
      >
        {pending ? "Saving…" : justSaved ? "Saved" : "Save lifts"}
      </button>
    </form>
  );
}

/*
  After a save: a toast dropping in at the top of the screen, where the
  save scrolls you, for a new PR or for passing someone on the board.
  Keyed by savedAt, so each save plays it once.
*/
function Celebration({ prs, passed }: { prs: Movement[]; passed: string[] }) {
  const [shown, setShown] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setShown(false), 5000);
    return () => clearTimeout(t);
  }, []);
  if (!shown || (prs.length === 0 && passed.length === 0)) return null;

  const lifts = prs.map((m) => MOVEMENTS.find((x) => x.id === m)?.label.toLowerCase() ?? m);
  const others = passed.length - 1;
  return (
    <div
      role="status"
      className="toast fixed inset-x-0 top-3 z-50 mx-auto w-[min(22rem,calc(100%-2rem))] rounded-sm border border-rule bg-iron-raised px-4 py-3 text-[14px] shadow-[0_12px_32px_rgba(0,0,0,0.55)]"
    >
      {lifts.length > 0 && (
        <p className="flex items-center gap-2.5 font-bold">
          <Stamp />
          New {listOf(lifts)} {lifts.length === 1 ? "PR" : "PRs"}
        </p>
      )}
      {passed.length > 0 && (
        <p className={`flex items-center gap-2 ${lifts.length > 0 ? "mt-2" : ""}`}>
          <span aria-hidden className="text-[var(--success)]">
            ▲
          </span>
          <span>
            You passed <span className="font-bold">{passed[0]}</span>
            {others > 0 && ` and ${others} other${others === 1 ? "" : "s"}`}
          </span>
        </p>
      )}
    </div>
  );
}

function listOf(words: string[]) {
  return words.length < 2 ? words.join("") : `${words.slice(0, -1).join(", ")} and ${words.at(-1)}`;
}

// Where the chalk flies when a PR stamp lands, in px from its centre.
const DUST = [
  [-16, -12],
  [14, -14],
  [18, 6],
  [-18, 8],
  [2, 16],
  [-4, -18],
];

function Stamp() {
  return (
    <span aria-hidden className="relative inline-flex shrink-0">
      <span className="pr-stamp">PR</span>
      {DUST.map(([x, y], i) => (
        <span
          key={i}
          className="dust"
          style={{ "--x": `${x}px`, "--y": `${y}px` } as React.CSSProperties}
        />
      ))}
    </span>
  );
}

function LiftRow({
  movement,
  existing,
  standing,
  boardHref,
  bodyweightKg,
  known,
  row,
  onChange,
  pr,
}: {
  movement: (typeof MOVEMENTS)[number];
  existing: Lift | undefined;
  standing: { rank: number; of: number } | null;
  boardHref: string;
  bodyweightKg: number;
  known: Partial<Record<Movement, number>>;
  row: Row;
  onChange: (row: Row) => void;
  /** Just saved, and better than any entry before it. */
  pr: boolean;
}) {
  const isPullups = movement.id === "pullups";
  const optional = !TOTAL_MOVEMENTS.includes(movement.id);
  const delta = deltaFor(existing);
  // True while a removal plays its vanish animation (see RemoveLift).
  const [vanishing, setVanishing] = useState(false);

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
            {pr && (
              <>
                <Stamp />
                <span className="sr-only">new personal record</span>
              </>
            )}
          </span>
          <span className={`tnum block text-[11px] text-chalk-faint ${vanishing ? "vanish" : ""}`}>
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
            className={`${field} ${vanishing ? "vanish-value" : ""}`}
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
          className={`${field} ${vanishing ? "vanish-value" : ""}`}
        />
      </div>

      {movement.id === "overhead_press" && <ShoulderPress />}
      {!optional && !existing && (
        <NeverDone
          movement={movement}
          bodyweightKg={bodyweightKg}
          known={known}
          onUse={(kg) => onChange({ kg: String(kg), reps: "1" })}
        />
      )}
      {existing && (
        <RemoveLift
          movement={movement}
          cosigns={existing.cosigners.length}
          inTotal={!optional}
          onVanish={setVanishing}
          onRemoved={() => onChange({ kg: "", reps: "" })}
        />
      )}
    </div>
  );
}

// How long the row takes to vanish before the removal is sent; matches
// the .vanish animation in globals.css.
const VANISH_MS = 650;

/*
  Two taps, like deleting the account: the first says what will go, the
  second plays the vanish and then removes it. Plain buttons calling the
  action directly — not a form submit, since the row sits inside the lifts
  form (forms can't nest) and Enter there must mean Save, not Remove.
*/
function RemoveLift({
  movement,
  cosigns,
  inTotal,
  onVanish,
  onRemoved,
}: {
  movement: (typeof MOVEMENTS)[number];
  cosigns: number;
  /** Squat, bench or deadlift: removing it takes away the DOTS score. */
  inTotal: boolean;
  /** Starts (true) or undoes (false) the row's vanish animation. */
  onVanish: (on: boolean) => void;
  /** Empties the row, so the old numbers aren't sitting there to re-save. */
  onRemoved: () => void;
}) {
  const [armed, setArmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const name = movement.label.toLowerCase();

  const remove = () => {
    setBusy(true);
    setError(null);
    onVanish(true);
    startTransition(async () => {
      await new Promise((r) => setTimeout(r, VANISH_MS));
      const result = await removeLiftAction(movement.id, initial);
      if (result.error) {
        setError(result.error);
        onVanish(false); // it failed: bring the row back
        setBusy(false);
      } else {
        // Empty the boxes, then end the animation so the row is visible
        // again — the row stays, only the numbers go.
        onRemoved();
        onVanish(false);
      }
    });
  };

  return (
    <div className="mt-2">
      {armed ? (
        <div className="rounded-sm border border-[color-mix(in_oklab,var(--danger)_45%,transparent)] bg-[color-mix(in_oklab,var(--danger)_8%,transparent)] p-3">
          <p className="text-[12px] leading-relaxed text-chalk-dim">
            Removes your {name}
            {cosigns > 0 && ` and its ${cosigns} co-sign${cosigns === 1 ? "" : "s"}`}.
            {inTotal &&
              " Your DOTS score needs squat, bench and deadlift, so you'll leave the board until you enter it again."}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={remove}
              disabled={busy}
              className="press inline-flex min-h-9 items-center rounded-sm bg-[var(--danger)] px-3 text-[13px] font-bold text-iron hover:opacity-85 disabled:opacity-60"
            >
              {busy ? "Removing…" : `Yes, remove my ${name}`}
            </button>
            <button
              type="button"
              onClick={() => setArmed(false)}
              disabled={busy}
              className={`${secondary} min-h-9 px-3 text-[13px]`}
            >
              Keep it
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setArmed(true)}
          className="press inline-flex min-h-8 items-center gap-1.5 rounded-sm border border-rule px-2.5 text-[12px] font-medium text-chalk-dim hover:border-[var(--danger)] hover:text-[var(--danger)]"
        >
          <TrashIcon />
          Remove
        </button>
      )}
      {error && (
        <p role="alert" className="mt-2 text-[12px] text-[var(--danger)]">
          {error}
        </p>
      )}
    </div>
  );
}

function TrashIcon() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 16 16"
      className="h-3.5 w-3.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M2.5 4.5h11M6.5 4.5V3h3v1.5M4 4.5l.7 8.5h6.6l.7-8.5M6.8 7v4M9.2 7v4" />
    </svg>
  );
}

/*
  For someone who has never done this lift: a likely one-rep max and a
  button that puts it in the row as a single. Scaled from their other lifts
  when they've entered any; otherwise what a beginner of each bodyweight
  typically lifts, with theirs picked out. Only shown until it's entered.
*/
function NeverDone({
  movement,
  bodyweightKg,
  known,
  onUse,
}: {
  movement: (typeof MOVEMENTS)[number];
  bodyweightKg: number;
  /** 1RMs from the other rows, typed or saved. */
  known: Partial<Record<Movement, number>>;
  onUse: (kg: number) => void;
}) {
  const estimate = estimatedLift(movement.id, bodyweightKg, known);
  if (estimate === null) return null;
  const mine = estimate.kg;
  const name = movement.label.toLowerCase();
  const fromNames = estimate.from
    .map((m) => MOVEMENTS.find((x) => x.id === m)!.label.toLowerCase())
    .join(" and ");

  return (
    <details className="group mt-2">
      <summary className={hintSummary}>Never done a {name}?</summary>
      <div className="mt-2 rounded-sm border border-rule p-3">
        {estimate.from.length > 0 ? (
          <p className="text-[12px] leading-relaxed text-chalk-dim">
            From your {fromNames}, you&rsquo;d likely manage about{" "}
            <span className="tnum font-bold text-chalk">{mine} kg</span> for one.
            Use it to get a score now, and replace it once you&rsquo;ve done the
            lift.
          </p>
        ) : (
          <>
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
          </>
        )}
        <button
          type="button"
          onClick={(e) => {
            onUse(mine);
            e.currentTarget.closest("details")!.open = false;
          }}
          className={`${secondary} mt-3 min-h-9 px-3 text-[13px]`}
        >
          Use {mine} kg × 1
        </button>
      </div>
    </details>
  );
}

// A small question under a lift row that opens an answer (NeverDone, ShoulderPress).
export const hintSummary =
  "w-fit cursor-pointer list-none text-[12px] text-chalk-dim underline-offset-4 hover:text-chalk hover:underline [&::-webkit-details-marker]:hidden";

/*
  Plenty of college gyms do shoulder press, often seated with dumbbells,
  rather than a standing barbell overhead press. Not the same lift, but
  close enough to count, as long as dumbbells are added together.
*/
function ShoulderPress() {
  return (
    <details className="mt-2">
      <summary className={hintSummary}>Only do shoulder press?</summary>
      <p className="mt-2 rounded-sm border border-rule p-3 text-[12px] leading-relaxed text-chalk-dim">
        Enter that. It isn&rsquo;t quite the same lift, but it&rsquo;s close
        enough: seated or standing, barbell or dumbbells. With dumbbells, add
        the two together: a pair of 20 kg dumbbells is{" "}
        <span className="tnum text-chalk">40</span> kg.
      </p>
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
            ? "text-[var(--danger)]"
            : shown.kind === "ok"
              ? "text-[var(--success)]"
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
  defaultAvatar = null,
  submitLabel,
  college,
}: {
  defaultName: string;
  defaultUsername: string;
  currentUsername?: string | null;
  defaultBodyweight?: number;
  /** Their cartoon avatar so far; null is initials. */
  defaultAvatar?: string | null;
  submitLabel: string;
  /** Rendered by the server (a CollegeField); the form just hosts it. */
  college: React.ReactNode;
}) {
  const [state, action, pending] = useActionState(saveProfileAction, initial);
  // A first-timer who tried the board's calculator: their bodyweight from it.
  const tried = useTryout();
  const bodyweight = defaultBodyweight ?? tried?.bodyweight ?? "";

  // After a save: back to the top, where the new name and avatar show, with
  // a moment's confirmation, the way saving lifts does.
  const [dismissedAt, setDismissedAt] = useState(0);
  const justSaved = !!state.savedAt && state.savedAt > dismissedAt;
  useEffect(() => {
    if (!justSaved) return;
    window.scrollTo({ top: 0, behavior: "smooth" });
    const t = setTimeout(() => setDismissedAt(state.savedAt!), 2500);
    return () => clearTimeout(t);
  }, [justSaved, state.savedAt]);

  return (
    <form action={action} className="flex flex-col gap-4">
      {justSaved && (
        <p
          role="status"
          className="toast fixed inset-x-0 top-3 z-50 mx-auto flex w-fit items-center gap-2 rounded-sm border border-rule bg-iron-raised px-4 py-3 text-[14px] font-bold shadow-[0_12px_32px_rgba(0,0,0,0.55)]"
        >
          <span aria-hidden className="text-[var(--success)]">
            ✓
          </span>
          Profile saved
        </p>
      )}
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
          // Remounts when the saved bodyweight is read after hydration, so
          // the uncontrolled input actually shows it.
          key={bodyweight}
          name="bodyweightKg"
          type="number"
          inputMode="decimal"
          step="0.1"
          min="30"
          max="250"
          required
          defaultValue={bodyweight}
          className={`${field} w-full text-left`}
        />
      </label>

      <AvatarPicker name={defaultName} current={defaultAvatar} />

      {state.error && (
        <p role="alert" className="text-[12px] text-[var(--danger)]">
          {state.error}
        </p>
      )}

      <button type="submit" disabled={pending} className={`${primary} w-fit`}>
        {pending ? "Saving…" : submitLabel}
      </button>
    </form>
  );
}

/*
  Initials, or a cartoon avatar from one of the sets (lib/avatars.ts). On the
  form it's one line: the current pick and a button. The sets open in a
  sheet over the page, each a row showing its first three; tapping a row
  opens the whole set, one set at a time. Plain radio buttons under the
  pictures, so it works by keyboard and screen reader, and the form posts
  whichever is checked even with the sheet or its set closed.
*/
function AvatarPicker({ name, current }: { name: string; current: string | null }) {
  // Only for the preview beside the button; the checked radio is what's posted.
  const [picked, setPicked] = useState(current);
  const disc =
    "flex aspect-square items-center justify-center overflow-hidden rounded-full border-2 border-rule bg-iron-raised transition-[border-color,box-shadow] peer-checked:border-accent peer-checked:shadow-[0_0_0_2px_var(--accent)] peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-chalk";
  const sets = AVATAR_SETS.map((set) => (
    <details
      key={set.label}
      name="avatar-set"
      // Open where their current avatar is, so they see what they have.
      open={set.avatars.some((a) => a.id === current)}
      className="group rounded-sm border border-rule has-[:checked]:border-accent"
    >
      <summary className="press flex min-h-12 cursor-pointer list-none items-center gap-3 px-3 [&::-webkit-details-marker]:hidden">
        <span className="flex-1 text-[14px] font-bold">
          {set.label}
          <span className="ml-1.5 font-normal text-chalk-faint">{set.avatars.length}</span>
          <span className="ml-1.5 hidden text-accent group-has-[:checked]:inline">✓</span>
        </span>
        {/* A taste of the set; the grid below has them all once open. */}
        <span aria-hidden className="flex -space-x-2 group-open:hidden">
          {set.avatars.slice(0, 3).map((a) => (
            <Image
              key={a.id}
              src={avatarSrc(a.id)}
              alt=""
              width={30}
              height={30}
              unoptimized
              className="rounded-full border-2 border-iron bg-iron-raised"
            />
          ))}
        </span>
        <svg
          aria-hidden
          viewBox="0 0 16 16"
          className="h-3.5 w-3.5 shrink-0 text-chalk-faint transition-transform group-open:rotate-180"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="m3 6 5 5 5-5" />
        </svg>
      </summary>
      <div className="grid grid-cols-6 gap-2 px-3 pb-3 pt-1">
        {set.avatars.map((a) => (
          <label key={a.id} className="press relative cursor-pointer">
            <input
              type="radio"
              name="avatar"
              value={a.id}
              defaultChecked={current === a.id}
              aria-label={a.label}
              className="peer sr-only"
            />
            <span className={`${disc} w-full`}>
              <Image src={avatarSrc(a.id)} alt="" width={48} height={48} unoptimized />
            </span>
          </label>
        ))}
      </div>
    </details>
  ));

  return (
    <div>
      <p className="text-[12px] text-chalk-dim">Avatar</p>
      <div className="mt-1.5 flex items-center gap-3">
        <span
          aria-hidden
          className="tnum flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-rule bg-iron-raised text-[14px] font-extrabold text-chalk"
        >
          {picked ? (
            <Image
              src={avatarSrc(picked)}
              alt=""
              width={44}
              height={44}
              loading="eager"
              unoptimized
            />
          ) : (
            initials(name)
          )}
        </span>
        <button type="button" popoverTarget="avatar-sheet" className={secondary}>
          {picked ? "Change avatar" : "Select avatar"}
        </button>
      </div>

      <div
        id="avatar-sheet"
        popover="auto"
        // .help-pop gives it the dimmed backdrop the "?" explanations have.
        className="help-pop m-auto max-h-[85dvh] w-[min(26rem,calc(100%-1.5rem))] overflow-y-auto rounded-sm border border-rule bg-iron p-0 text-chalk"
        onChange={(e) => setPicked((e.target as HTMLInputElement).value || null)}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-rule bg-iron px-4 py-3">
          <h2 id="avatar-sheet-title" className="text-[15px] font-bold">
            Select avatar
          </h2>
          <button
            type="button"
            popoverTarget="avatar-sheet"
            popoverTargetAction="hide"
            className="press inline-flex min-h-9 items-center rounded-sm bg-chalk px-4 text-[14px] font-bold text-iron hover:opacity-85"
          >
            Done
          </button>
        </div>
        <div role="group" aria-labelledby="avatar-sheet-title" className="p-4">
          <label className="press relative flex w-fit cursor-pointer items-center gap-3 whitespace-nowrap text-[14px]">
            <input
              type="radio"
              name="avatar"
              value=""
              defaultChecked={current === null}
              className="peer sr-only"
            />
            <span className={`${disc} tnum w-11 shrink-0 text-[14px] font-extrabold text-chalk`}>
              {initials(name)}
            </span>
            Just my initials
          </label>
          <div className="mt-3 flex flex-col gap-2">{sets}</div>
        </div>
      </div>
    </div>
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
        <p role="alert" className="mt-1 text-[11px] text-[var(--danger)]">
          {state.error}
        </p>
      )}
    </form>
  );
}

/** Quiet on purpose: a doubt goes to the admin, not the board. */
export function DoubtButton({ liftId, doubted }: { liftId: string; doubted: boolean }) {
  const [state, action, pending] = useActionState(doubtLiftAction, initial);
  const [armed, setArmed] = useState(false);

  const tint =
    "border-[color-mix(in_oklab,var(--danger)_45%,transparent)] bg-[color-mix(in_oklab,var(--danger)_12%,transparent)]";
  const pill =
    "press inline-flex min-h-8 items-center gap-1.5 rounded-full border px-3 text-[12px] disabled:opacity-50";

  // Two steps, like account deletion: the first explains, the second sends.
  // Taking a doubt back needs no warning.
  return (
    <form
      action={action}
      onSubmit={() => setArmed(false)}
      className={armed ? "basis-full" : "ml-auto shrink-0"}
    >
      <input type="hidden" name="liftId" value={liftId} />
      {doubted && <input type="hidden" name="undo" value="1" />}

      {doubted ? (
        <span className={`inline-flex items-center gap-2 rounded-full border py-1 pl-3 pr-1 text-[12px] text-chalk ${tint}`}>
          <Flag />
          You doubted this
          <button
            type="submit"
            disabled={pending}
            className="press rounded-full px-2 py-0.5 text-chalk-dim underline-offset-4 hover:text-chalk hover:underline disabled:opacity-50"
          >
            {pending ? "…" : "Undo"}
          </button>
        </span>
      ) : armed ? (
        <div role="group" aria-label="Doubt this lift?" className={`rounded-sm border p-3 ${tint}`}>
          <p className="flex items-center gap-2 text-[13px] font-bold text-chalk">
            <Flag />
            Doubt this lift?
          </p>
          <p className="mt-1 text-[12px] leading-relaxed text-chalk-dim">
            Only if you&rsquo;re fairly sure it isn&rsquo;t real, not just one you
            didn&rsquo;t see.
          </p>
          <div className="mt-3 flex gap-2">
            <button
              type="submit"
              disabled={pending}
              className="press inline-flex min-h-9 items-center rounded-sm bg-[var(--danger)] px-4 text-[13px] font-bold text-white hover:opacity-85 disabled:opacity-60"
            >
              {pending ? "…" : "Yes, doubt it"}
            </button>
            <button
              type="button"
              onClick={() => setArmed(false)}
              className="press inline-flex min-h-9 items-center rounded-sm border border-rule px-4 text-[13px] text-chalk-dim hover:border-chalk-dim hover:text-chalk"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setArmed(true)}
          className={`${pill} border-rule text-chalk-faint hover:border-[var(--danger)] hover:text-[var(--danger)]`}
        >
          <Flag />
          Doubt
        </button>
      )}

      {state.error && (
        <p role="alert" className="mt-1 text-[11px] text-[var(--danger)]">
          {state.error}
        </p>
      )}
    </form>
  );
}

function Flag() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 16 16"
      className="h-3 w-3 shrink-0 text-[var(--danger)]"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3.5 14V2.5M3.5 3h8l-1.8 3 1.8 3h-8" />
    </svg>
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
    ? "border-[var(--danger)] text-[var(--danger)]"
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
        <p role="alert" className="text-[12px] text-[var(--danger)]">
          {state.error}
        </p>
      )}
    </form>
  );
}

/**
 * A <details> that starts open or closed and is then the visitor's to
 * toggle. The open state is frozen at first render, so a save that
 * refreshes the page (and changes what decided it) never snaps it shut.
 */
export function Drawer({
  summary,
  defaultOpen = false,
  className,
  style,
  children,
}: {
  summary: React.ReactNode;
  defaultOpen?: boolean;
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}) {
  const [open] = useState(defaultOpen);
  return (
    <details open={open} className={`drawer ${className ?? ""}`} style={style}>
      <summary className="press flex min-h-11 cursor-pointer list-none items-center justify-between rounded-sm border border-rule px-4 text-[15px] text-chalk-dim hover:border-chalk-faint hover:text-chalk [&::-webkit-details-marker]:hidden">
        {summary}
        <span aria-hidden className="text-chalk-faint">+</span>
      </summary>
      {children}
    </details>
  );
}
