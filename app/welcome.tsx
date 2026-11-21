"use client";

import { useSyncExternalStore } from "react";
import { ThemeSwitch } from "./prefs";

/*
  A one-line hello for a signed-out first visit: what the board is and the
  one thing to do. Closed once, it stays closed on this device. Not a modal:
  most first visits come from a link to a board, and the board is the point.
*/

const KEY = "welcome-dismissed"; // also read by the before-paint script in prefs.tsx
const listeners = new Set<() => void>();

function dismissed() {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false; // No storage: show it; the ✕ still hides it for this visit.
  }
}

let closedThisVisit = false;

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function close() {
  closedThisVisit = true;
  try {
    localStorage.setItem(KEY, "1");
  } catch {
    // Private mode: hidden for this visit only.
  }
  listeners.forEach((l) => l());
}

export function Welcome() {
  // Server renders it, so a first visit doesn't jump when it appears after
  // load; for a returning visitor the before-paint script has already set
  // <html data-welcome="off">, which hides it until hydration removes it.
  const hidden = useSyncExternalStore(
    subscribe,
    () => closedThisVisit || dismissed(),
    () => false,
  );
  if (hidden) return null;

  return (
    <aside
      aria-label="Welcome"
      className="welcome mb-5 flex items-start gap-2 rounded-sm border border-rule bg-iron-raised py-3 pl-4 pr-1 text-[14px] leading-relaxed text-chalk-dim"
    >
      <div className="pt-0.5">
        <p>
          <span className="font-bold text-chalk">Your college&rsquo;s gym leaderboard.</span>{" "}
          Scores are adjusted for bodyweight, so everyone competes fairly. Tap{" "}
          <span className="font-bold text-chalk">Add yours</span> to sign in with
          Google and enter your squat, bench and deadlift.
        </p>
        <div className="mt-2.5">
          <ThemeSwitch />
        </div>
      </div>
      <button
        type="button"
        onClick={close}
        aria-label="Dismiss"
        className="press -my-1 inline-flex size-11 shrink-0 items-center justify-center rounded-sm text-chalk-faint hover:text-chalk"
      >
        <svg aria-hidden width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
      </button>
    </aside>
  );
}
