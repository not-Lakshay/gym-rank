"use client";

import { ViewTransition, createContext, use, useEffect, useState } from "react";
import { Avatar } from "./avatar";

/*
  Tap a lifter on a board and their avatar and score fly into the header
  of their page. React's <ViewTransition> pairs two elements that carry the
  same name across a navigation and morphs one into the other.

  Two things shape this file. A name must be unique on screen, and a lifter
  can be on a page twice (the overall board and a class board), so only the
  row you tapped gets one. And a profile streams in from the database, so
  the first frame after the tap is its loading state, not its header: the
  tapped row leaves its details here, and the loading state draws them in
  the header's place under the same names, giving the morph somewhere to
  land. When the real header arrives it takes over the names in place.
*/

export type Arrival = {
  id: string;
  username: string;
  displayName: string;
  /** Their cartoon avatar, or null for initials. */
  avatar: string | null;
  /** Plate colour of their weight class. */
  ring: string;
  /** DOTS as shown on the board; null on lift boards, where it's kilos. */
  score: string | null;
};

// Module state, not React state: it has to outlive the board page that
// set it. Cleared after a few seconds so a later, unrelated visit to a
// profile can't pick up a stale tap.
let arriving: Arrival | null = null;

const Departing = createContext(false);

// How long the profile skeleton may show before the page reloads itself.
const STALL_MS = 8000;

/** Wraps one board row or podium spot. Adds no box (display: contents). */
export function Departure({
  arrival,
  children,
}: {
  arrival: Arrival;
  children: React.ReactNode;
}) {
  const [on, setOn] = useState(false);
  return (
    <Departing value={on}>
      <div
        className="contents"
        onClickCapture={(e) => {
          // A plain tap on a link to this lifter's page; a new-tab click
          // isn't a navigation here.
          const link = (e.target as Element).closest("a");
          if (link?.getAttribute("href") !== `/u/${arrival.username}`) return;
          if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
          arriving = arrival;
          setTimeout(() => {
            if (arriving === arrival) arriving = null;
          }, 4000);
          setOn(true);
        }}
      >
        {children}
      </div>
    </Departing>
  );
}

/** Names its child for the morph — only inside the row being tapped. */
export function Morph({
  id,
  part,
  children,
}: {
  id: string;
  part: "avatar" | "score";
  children: React.ReactNode;
}) {
  const on = use(Departing);
  return (
    <ViewTransition name={on ? `${part}-${id}` : undefined} share="morph" default="none">
      {children}
    </ViewTransition>
  );
}

/**
 * A profile's loading state. Right after a tap on a board the header is
 * that lifter's, so the morph has a target; otherwise `header`, a
 * skeleton. `children` (the lifts skeleton) follows either way.
 */
export function ArrivingProfile({
  header,
  children,
}: {
  header: React.ReactNode;
  children: React.ReactNode;
}) {
  const [who] = useState(() => arriving);

  // Safety net. A profile answers in well under a second, yet a phone was
  // once left on this skeleton with the page already delivered. If it's
  // still showing after a while, load the page afresh — once per profile,
  // so a slow connection can't turn it into a reload loop.
  useEffect(() => {
    const t = setTimeout(() => {
      const key = `stall-reload:${location.pathname}`;
      try {
        if (sessionStorage.getItem(key)) return;
        sessionStorage.setItem(key, "1");
      } catch {
        return; // no storage, no way to stop a loop: leave it
      }
      location.reload();
    }, STALL_MS);
    return () => clearTimeout(t);
  }, []);

  return (
    <>
      {who ? <ArrivingHeader who={who} /> : header}
      {children}
    </>
  );
}

function ArrivingHeader({ who }: { who: Arrival }) {
  return (
    <div className="pt-8">
      <div className="flex items-center gap-4">
        <ViewTransition name={`avatar-${who.id}`} share="morph" default="none">
          <Avatar name={who.displayName} ring={who.ring} size={64} avatar={who.avatar} />
        </ViewTransition>
        <div className="min-w-0">
          <p className="text-[1.75rem] font-extrabold leading-none tracking-[-0.03em]">
            {who.displayName}
          </p>
          <span aria-hidden className="bone mt-2.5 block h-3 w-40 rounded-sm" />
        </div>
      </div>
      {who.score !== null && (
        <p className="tnum mt-5 text-[3.5rem] font-extrabold leading-none tracking-[-0.045em]">
          <ViewTransition name={`score-${who.id}`} share="morph" default="none">
            <span>{who.score}</span>
          </ViewTransition>
        </p>
      )}
    </div>
  );
}
