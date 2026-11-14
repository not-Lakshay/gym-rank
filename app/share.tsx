"use client";

import { useState } from "react";

type Status = "idle" | "copied" | "failed";

/*
  Sharing has to be one tap on a phone, because that is where it happens —
  someone finishes a set, looks at their rank, and sends it to the gym
  group. navigator.share opens the native sheet (WhatsApp, Instagram DM),
  which is the whole point; the clipboard is the desktop fallback.

  The shared payload is the public lifter URL, not an image. WhatsApp
  fetches that URL and renders /api/og as the preview, so the group sees
  the card without the sender doing anything.
*/
export function ShareButton({ url, text }: { url: string; text: string }) {
  const [status, setStatus] = useState<Status>("idle");

  async function share() {
    // A cancelled share sheet throws, and that is not an error worth
    // showing anyone — it just means they changed their mind.
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ text, url });
        return;
      } catch {
        return;
      }
    }

    try {
      await navigator.clipboard.writeText(`${text} ${url}`);
      setStatus("copied");
      setTimeout(() => setStatus("idle"), 2000);
    } catch {
      setStatus("failed");
    }
  }

  return (
    <div>
      <button type="button" onClick={share} className={shareButton}>
        <ShareIcon />
        {status === "copied" ? "Link copied" : "Share your rank"}
      </button>
      {status === "failed" && (
        <p className="mt-2 text-[12px] text-chalk-dim">
          Couldn&apos;t copy automatically — the link is{" "}
          <span className="text-chalk">{url}</span>
        </p>
      )}
    </div>
  );
}

const shareButton =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-sm bg-chalk px-5 text-[15px] font-bold text-iron transition-opacity hover:opacity-85";

function ShareIcon() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 16 16"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M8 10V2" />
      <path d="M5 5l3-3 3 3" />
      <path d="M3 9v4a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V9" />
    </svg>
  );
}
