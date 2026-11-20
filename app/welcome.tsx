"use client";

import { useSyncExternalStore } from "react";

/*
  A one-line hello for a signed-out first visit: what the board is and the
  one thing to do. Closed once, it stays closed on this device. Not a modal:
  most first visits come from a link to a board, and the board is the point.
*/

const KEY = "welcome-dismissed";
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
  // Server renders nothing (true), so a returning visitor never sees it flash.
  const hidden = useSyncExternalStore(
    subscribe,
    () => closedThisVisit || dismissed(),
    () => true,
  );
  if (hidden) return null;

  return (
    <aside
      aria-label="Welcome"
      className="mb-5 flex items-start gap-2 rounded-sm border border-rule bg-iron-raised py-3 pl-4 pr-1 text-[13px] leading-relaxed text-chalk-dim"
    >
      <p className="pt-0.5">
        <span className="font-bold text-chalk">Your college&rsquo;s gym leaderboard.</span>{" "}
        Scores are adjusted for bodyweight, so everyone competes fairly. Tap{" "}
        <span className="font-bold text-chalk">Add yours</span> to sign in with
        Google and enter your squat, bench and deadlift.
      </p>
      <button
        type="button"
        onClick={close}
        aria-label="Dismiss"
        className="press -my-1 inline-flex size-11 shrink-0 items-center justify-center rounded-sm text-[18px] text-chalk-faint hover:text-chalk"
      >
        ✕
      </button>
    </aside>
  );
}
