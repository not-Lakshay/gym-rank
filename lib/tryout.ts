/*
  What a visitor typed into a board's calculator before signing up, kept
  on their device (localStorage) from "Save it" until their first lifts
  are saved, so sign-up starts with the numbers already filled in. Never
  sent anywhere: bodyweight stays private.
*/

const KEY = "tryout";

export type TriedSet = { kg: string; reps: string };
export type Tryout = {
  bodyweight: string;
  squat: TriedSet;
  bench: TriedSet;
  deadlift: TriedSet;
};

export function saveTryout(tryout: Tryout) {
  try {
    localStorage.setItem(KEY, JSON.stringify(tryout));
  } catch {
    // Private mode: they type them again.
  }
}

export function clearTryout() {
  try {
    localStorage.removeItem(KEY);
  } catch {}
}

/** The raw saved value; a string, so useSyncExternalStore can compare it. */
export function readTryout(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

// Strings only, short: these go straight into inputs, and the server
// validates them again on save.
const text = (v: unknown) => (typeof v === "string" ? v.slice(0, 8) : "");
const set = (v: unknown): TriedSet => {
  const s = (v ?? {}) as Record<string, unknown>;
  return { kg: text(s.kg), reps: text(s.reps) };
};

export function parseTryout(raw: string | null): Tryout | null {
  if (!raw) return null;
  try {
    const t = JSON.parse(raw) as Record<string, unknown> | null;
    if (!t || typeof t !== "object") return null;
    return {
      bodyweight: text(t.bodyweight),
      squat: set(t.squat),
      bench: set(t.bench),
      deadlift: set(t.deadlift),
    };
  } catch {
    return null;
  }
}
