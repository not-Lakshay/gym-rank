/** "just now", "3h ago", "2d ago". Coarse on purpose: a notification is
 *  about who, not when. */
export function timeAgo(date: Date, now: Date = new Date()): string {
  const s = Math.max(0, (now.getTime() - date.getTime()) / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  const w = Math.floor(d / 7);
  return `${w}w ago`;
}

/** "Lakshay Bhardwaj" → "LB", "sarthak" → "S": first and last word, first
 *  letter or digit of each. For avatar discs, so never empty. */
export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const ends = words.length > 1 ? [words[0], words[words.length - 1]] : words;
  const out = ends
    .map((w) => Array.from(w).find((ch) => /[\p{L}\p{N}]/u.test(ch)) ?? "")
    .join("")
    .toUpperCase();
  return out || "?";
}

/** 1 → "1st", 2 → "2nd", 11 → "11th". Shared so the card and the
 *  dashboard never phrase the same rank two different ways. */
export function ordinal(n: number): string {
  const tens = n % 100;
  if (tens >= 11 && tens <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}
