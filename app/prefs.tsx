"use client";

import { useLayoutEffect, useSyncExternalStore } from "react";

/*
  Choices a visitor makes that stay on this device (localStorage): the
  theme, and closing the "How it works" card. Each is mirrored onto <html>
  as a data attribute the CSS reads — data-theme="neon", data-howto="done"
  — so no account or cookie is involved and every page stays static.
*/

// Applies the saved choices before first paint, so Neon never flashes
// Iron and a closed card never flashes back. Inline in <head>.
const apply = `try{var d=document.documentElement,s=localStorage;if(s.getItem("theme")==="neon")d.dataset.theme="neon";if(s.getItem("howto")==="done")d.dataset.howto="done"}catch(e){}`;

/**
 * The before-paint script, for the root layout's <head>. The pattern is
 * from Next's "preventing flash before hydration" guide: executable on the
 * server, text/plain on the client so React doesn't warn about rendering a
 * script, and re-applied after mount because development's Strict Mode
 * remount resets <html> attributes (a no-op in production).
 */
export function BeforePaint() {
  useLayoutEffect(() => {
    try {
      const root = document.documentElement;
      if (localStorage.getItem("theme") === "neon") root.dataset.theme = "neon";
      if (localStorage.getItem("howto") === "done") root.dataset.howto = "done";
    } catch {
      // No storage: defaults.
    }
  }, []);
  return (
    <script
      type={typeof window === "undefined" ? "text/javascript" : "text/plain"}
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: apply }}
    />
  );
}

/* ---------------------------------------------------------------- Theme */

// The two themes (globals.css), in the order they arrived.
const THEMES = [
  { id: "iron", label: "Iron" },
  { id: "neon", label: "Neon" },
] as const;

type Theme = (typeof THEMES)[number]["id"];

const listeners = new Set<() => void>();

function currentTheme(): Theme {
  return document.documentElement.dataset.theme === "neon" ? "neon" : "iron";
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function choose(theme: Theme) {
  if (theme === "neon") document.documentElement.dataset.theme = "neon";
  else delete document.documentElement.dataset.theme;
  try {
    localStorage.setItem("theme", theme);
  } catch {
    // Private mode: the choice holds for this visit only.
  }
  listeners.forEach((l) => l());
}

export function ThemeSwitch() {
  // The server can't know the choice; it renders Iron and the browser
  // corrects it straight after hydration.
  const theme = useSyncExternalStore(subscribe, currentTheme, () => "iron" as Theme);

  return (
    <div role="radiogroup" aria-label="Theme" className="flex items-center gap-2">
      <span className="caption">Theme</span>
      <span className="flex rounded-sm border border-rule p-0.5">
        {THEMES.map((t) => (
          <button
            key={t.id}
            type="button"
            role="radio"
            aria-checked={theme === t.id}
            onClick={() => choose(t.id)}
            className={`press min-h-9 rounded-sm px-3.5 text-[13px] font-bold ${
              theme === t.id ? "bg-accent text-iron" : "text-chalk-dim hover:text-chalk"
            }`}
          >
            {t.label}
          </button>
        ))}
      </span>
    </div>
  );
}

/* --------------------------------------------------------- How it works */

/** Closes the "How it works" card for good on this device (.howto in CSS). */
export function CloseHowTo() {
  return (
    <button
      type="button"
      aria-label="Close"
      onClick={() => {
        document.documentElement.dataset.howto = "done";
        try {
          localStorage.setItem("howto", "done");
        } catch {
          // Private mode: closed for this visit only.
        }
      }}
      className="press -mr-1.5 -mt-1.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-sm text-chalk-faint hover:text-chalk"
    >
      <svg aria-hidden viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
        <path d="M4 4l8 8M12 4l-8 8" />
      </svg>
    </button>
  );
}
