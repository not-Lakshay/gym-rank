"use client";

import { useEffect, useRef, useState } from "react";

/*
  The score counts up once, on arrival.

  This is the one deliberately animated moment in the app, and it is here
  because this number is the entire reason the page exists — watching it
  land reads as a result being weighed rather than a value being printed.
  Everywhere else, motion is attached to something that carries meaning.

  Server-rendered text is the starting state, so the number is correct
  before hydration and for anyone without JavaScript.
*/
export function CountUp({
  value,
  decimals = 1,
  durationMs = 750,
}: {
  value: number;
  decimals?: number;
  durationMs?: number;
}) {
  const [shown, setShown] = useState(value);
  const frame = useRef<number | null>(null);

  useEffect(() => {
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (reduced) {
      setShown(value);
      return;
    }

    const start = performance.now();
    // Decelerating: fast off the line, settling onto the final digit.
    const ease = (t: number) => 1 - Math.pow(1 - t, 3);

    function tick(now: number) {
      const t = Math.min((now - start) / durationMs, 1);
      setShown(value * ease(t));
      if (t < 1) frame.current = requestAnimationFrame(tick);
    }

    frame.current = requestAnimationFrame(tick);
    return () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    };
  }, [value, durationMs]);

  return <>{shown.toFixed(decimals)}</>;
}
