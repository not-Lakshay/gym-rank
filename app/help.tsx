import Link from "next/link";
import { CloseHowTo } from "./prefs";

/*
  Explanations at the moment they're needed, instead of a tutorial up
  front. Each uses the browser's own popover — tap to open, tap outside or
  Esc to close, no JavaScript — so a trigger is a plain button with
  popoverTarget, and the explanation is rendered once per page.
*/

/**
 * The explanation box. `id` must be unique on the page. A <span>, with
 * <span className="block"> for its lines, because a "?" often sits inside
 * a sentence (a <p>) and a <div> or <p> there is invalid HTML that breaks
 * hydration. As a popover it's lifted into the top layer, so where it sits
 * in the markup doesn't change where it shows.
 */
export function HelpPop({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <span
      id={id}
      popover="auto"
      className="help-pop m-auto w-[min(20rem,calc(100%-2rem))] rounded-sm border border-rule bg-iron-raised p-4 text-left text-[13px] font-normal leading-relaxed text-chalk-dim"
    >
      {children}
    </span>
  );
}

/** A small "?" that opens a HelpPop. */
export function HelpDot({ target, label }: { target: string; label: string }) {
  return (
    <button
      type="button"
      popoverTarget={target}
      aria-label={label}
      className="press ml-1 inline-flex h-[18px] w-[18px] items-center justify-center rounded-full border border-chalk-faint align-[1px] text-[11px] font-bold leading-none text-chalk-dim hover:border-chalk hover:text-chalk"
    >
      ?
    </button>
  );
}

/** "?" plus its explanation of DOTS. Once per page. */
export function DotsHelp() {
  return (
    <>
      <HelpDot target="dots-help" label="What is DOTS?" />
      <HelpPop id="dots-help">
        <span className="block font-bold text-chalk">What is DOTS?</span>
        <span className="mt-1.5 block">
          Your squat, bench and deadlift added up, then adjusted for your
          bodyweight — so a 60 kg lifter and a 90 kg lifter are ranked
          fairly. Higher means stronger for your size.
        </span>
        <Link
          href="/scoring"
          className="mt-3 inline-block font-bold text-chalk underline underline-offset-4"
        >
          How scoring works ›
        </Link>
      </HelpPop>
    </>
  );
}

/**
 * Three steps for a first-time visitor on a college board. Closing it
 * hides it on this device for good (.howto, data-howto in globals.css).
 */
export function HowItWorks() {
  return (
    <section className="howto card mb-6 px-4 pb-4 pt-3" aria-labelledby="howto-title">
      <div className="flex items-start justify-between gap-3">
        <h2 id="howto-title" className="caption pt-2">
          How it works
        </h2>
        <CloseHowTo />
      </div>
      <ol className="mt-1 flex flex-col gap-2.5 text-[13px] leading-relaxed text-chalk-dim">
        {[
          <>
            Enter your <span className="text-chalk">heaviest squat, bench and deadlift</span> —
            the weight and how many reps you got.
          </>,
          <>
            Your total is <span className="text-chalk">adjusted for bodyweight</span> (DOTS),
            so lifters of every size compare fairly.
          </>,
          <>
            A friend who watched <span className="text-chalk">co-signs</span> each set. All
            three co-signed puts you on the global board.
          </>,
        ].map((step, i) => (
          <li key={i} className="flex gap-3">
            <span
              aria-hidden
              className="tnum mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent text-[11px] font-bold text-iron"
            >
              {i + 1}
            </span>
            <span>{step}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
