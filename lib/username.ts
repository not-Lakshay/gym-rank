/*
  Usernames, Instagram-style: the handle the system keys on, as opposed to
  the display name humans read. Lowercase letters, digits, dots and
  underscores; 3–20 characters; no leading, trailing or doubled dots.
  Stored lowercase, compared lowercase.

  No database import here: the profile form validates as you type with the
  same rules the server enforces, so the error you see is the one you'd get.
*/

export const USERNAME_MIN = 3;
export const USERNAME_MAX = 20;

// Route segments and words that would be confusing or look official.
const RESERVED = new Set([
  "me", "u", "c", "global", "api", "admin", "administrator", "gymrank",
  "gym_rank", "gym.rank", "privacy", "terms", "scoring", "lifter", "login",
  "signin", "signout", "settings", "about", "help", "support", "official",
  "staff", "mod", "moderator", "null", "undefined", "root",
]);

export function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase();
}

/** Null when valid, else the message to show under the field. */
export function validateUsername(raw: string): string | null {
  const u = normalizeUsername(raw);
  if (u.length < USERNAME_MIN) return `At least ${USERNAME_MIN} characters.`;
  if (u.length > USERNAME_MAX) return `At most ${USERNAME_MAX} characters.`;
  if (!/^[a-z0-9._]+$/.test(u)) {
    return "Letters, numbers, dots and underscores only.";
  }
  if (u.startsWith(".") || u.endsWith(".")) {
    return "Can't start or end with a dot.";
  }
  if (u.includes("..")) return "No double dots.";
  if (!/[a-z]/.test(u)) return "Needs at least one letter.";
  if (RESERVED.has(u)) return "That one's reserved.";
  return null;
}

/**
 * A starting handle from a display name: "Lakshay Bhardwaj" → "lakshay.bhardwaj".
 * Strips accents, drops anything that isn't a letter or digit, joins words
 * with dots, and trims to length. The caller checks availability and
 * appends a number if needed — this just produces the base.
 */
export function suggestUsername(displayName: string): string {
  const words = displayName
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);

  let base = words.slice(0, 2).join(".");
  if (base.length < USERNAME_MIN) base = (base + ".lifter").slice(0, USERNAME_MAX);
  if (base.length > USERNAME_MAX) base = base.slice(0, USERNAME_MAX).replace(/\.$/, "");
  if (validateUsername(base)) base = "lifter";
  return base;
}

/** `base`, then `base2`, `base3`, … each trimmed so the suffix still fits. */
export function usernameCandidates(base: string, count = 50): string[] {
  const out = [base];
  for (let n = 2; out.length < count; n++) {
    const suffix = String(n);
    out.push(base.slice(0, USERNAME_MAX - suffix.length).replace(/\.$/, "") + suffix);
  }
  return out;
}
