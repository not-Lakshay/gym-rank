"use client";
import React, { useEffect, useRef, useState } from "react";
import { motion, useInView } from "motion/react";
import { cn } from "@/lib/utils";

type EncryptedTextProps = {
  text: string;
  className?: string;
  /**
   * Time in milliseconds between revealing each subsequent real character.
   * Lower is faster. Defaults to 50ms per character.
   */
  revealDelayMs?: number;
  /** Optional custom character set to use for the gibberish effect. */
  charset?: string;
  /**
   * Time in milliseconds between gibberish flips for unrevealed characters.
   * Lower is more jittery. Defaults to 50ms.
   */
  flipDelayMs?: number;
  /** CSS class for styling the encrypted/scrambled characters */
  encryptedClassName?: string;
  /** CSS class for styling the revealed characters */
  revealedClassName?: string;
  /** Replay the scramble when the pointer enters the nearest link/button. */
  scrambleOnHover?: boolean;
};

const DEFAULT_CHARSET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+-={}[];:,.<>/?";

function generateRandomCharacter(charset: string): string {
  const index = Math.floor(Math.random() * charset.length);
  return charset.charAt(index);
}

export const EncryptedText: React.FC<EncryptedTextProps> = ({
  text,
  className,
  revealDelayMs = 50,
  charset = DEFAULT_CHARSET,
  flipDelayMs = 50,
  encryptedClassName,
  revealedClassName,
  scrambleOnHover = false,
}) => {
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true });

  // Starts fully revealed, so server HTML and no-JS visitors read the real
  // text; the scramble only begins once the effect runs in the browser.
  const [revealCount, setRevealCount] = useState<number>(text.length);
  const [run, setRun] = useState(0);
  const [scrambled, setScrambled] = useState<string[]>([]);

  useEffect(() => {
    if (!scrambleOnHover) return;
    if (!window.matchMedia("(hover: hover)").matches) return;
    const target = ref.current?.closest("a,button") ?? ref.current;
    if (!target) return;
    const replay = () => setRun((n) => n + 1);
    target.addEventListener("mouseenter", replay);
    return () => target.removeEventListener("mouseenter", replay);
  }, [scrambleOnHover]);

  useEffect(() => {
    if (!isInView) return;
    // Hover-only scrambles skip the on-arrival run.
    if (scrambleOnHover && run === 0) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const scramble = (i: number) =>
      text[i] === " " ? " " : generateRandomCharacter(charset);
    const start = performance.now();
    let lastFlip = -Infinity;
    let frame = 0;

    const update = (now: number) => {
      const count = Math.min(
        text.length,
        Math.floor((now - start) / Math.max(1, revealDelayMs)),
      );
      setRevealCount(count);
      if (count >= text.length) return;

      if (now - lastFlip >= Math.max(0, flipDelayMs)) {
        setScrambled(text.split("").map((_, i) => scramble(i)));
        lastFlip = now;
      }
      frame = requestAnimationFrame(update);
    };

    frame = requestAnimationFrame(update);
    return () => cancelAnimationFrame(frame);
  }, [isInView, run, scrambleOnHover, text, revealDelayMs, charset, flipDelayMs]);

  if (!text) return null;

  return (
    <motion.span
      ref={ref}
      className={cn(className)}
      aria-label={text}
      role="text"
    >
      {text.split("").map((char, index) => {
        const isRevealed = index < revealCount;
        const displayChar = isRevealed
          ? char
          : (scrambled[index] ?? char);

        return (
          <span
            key={index}
            aria-hidden
            className={cn(isRevealed ? revealedClassName : encryptedClassName)}
          >
            {displayChar}
          </span>
        );
      })}
    </motion.span>
  );
};
