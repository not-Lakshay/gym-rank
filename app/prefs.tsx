"use client";

import { useLayoutEffect, useSyncExternalStore } from "react";

/*
  The theme a visitor picks stays on this device (localStorage) and is
  mirrored onto <html> as data-theme="neon", which the CSS reads — so no
  account or cookie is involved and every page stays static.
*/

// Applies the saved theme before first paint, so Neon never flashes Iron,
// and hides a dismissed welcome strip (app/welcome.tsx) before it can show.
// Inline in <head>.
const apply = `try{var s=localStorage,h=document.documentElement;if(s.getItem("theme")==="neon")h.dataset.theme="neon";if(s.getItem("welcome-dismissed")==="1")h.dataset.welcome="off"}catch(e){}`;

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
      if (localStorage.getItem("theme") === "neon") {
        document.documentElement.dataset.theme = "neon";
      }
      if (localStorage.getItem("welcome-dismissed") === "1") {
        document.documentElement.dataset.welcome = "off";
      }
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
