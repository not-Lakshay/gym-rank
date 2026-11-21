import Link from "next/link";
import { MostTrustedTag, TrustBadge } from "./board";
import { MOST_TRUSTED_MIN, TRUSTED_WITNESSES } from "@/lib/cosign";

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
 * What the trust badges mean (trustTier in lib/cosign.ts). Spans, so it
 * works inside a HelpPop and on the scoring page alike.
 */
export function TrustLevels() {
  const row = "mt-2 flex items-start gap-2";
  return (
    <>
      <span className="block">
        A shield beside a name shows how many different people have vouched
        for their squat, bench and deadlift. Co-signs from the same person
        count once, and disputed lifts don&rsquo;t count.
      </span>
      <span className={row}>
        <TrustBadge tier="witnessed" size={16} named />
        <span><span className="font-bold text-chalk">Witnessed</span>: at least one of the three co-signed.</span>
      </span>
      <span className={row}>
        <TrustBadge tier="verified" size={16} named />
        <span><span className="font-bold text-chalk">Verified</span>: all three co-signed. That opens the global board.</span>
      </span>
      <span className={row}>
        <TrustBadge tier="trusted" size={16} named />
        <span>
          <span className="font-bold text-chalk">Trusted</span>: all three co-signed, by{" "}
          {TRUSTED_WITNESSES} or more different people.
        </span>
      </span>
      <span className={row}>
        <MostTrustedTag />
        <span>
          The lifter at each college with the most different people vouching
          (at least {MOST_TRUSTED_MIN}). A tie goes to whoever got there first.
        </span>
      </span>
    </>
  );
}

/** The trust tiers as a popover, for the badge on a profile. Once per page. */
export function TrustHelp() {
  return (
    <HelpPop id="trust-help">
      <span className="block font-bold text-chalk">Trust badges</span>
      <span className="mt-1.5 block">
        <TrustLevels />
      </span>
    </HelpPop>
  );
}
