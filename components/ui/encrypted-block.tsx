"use client";
import React, { useEffect, useRef } from "react";

/*
  EncryptedText scrambles one string. This scrambles a whole block of markup:
  it walks the text nodes React already rendered and decrypts them left to
  right, so links, <span> highlights and entities survive untouched. The
  server HTML is the real text — nothing is replaced until the effect runs,
  and the originals are written back when it ends.
*/

const CHARSET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+-={}[];:,.<>/?";

function scrambleChar() {
  return CHARSET.charAt(Math.floor(Math.random() * CHARSET.length));
}

/* Real characters up to `revealed`, gibberish after it. Whitespace is kept so
   the text keeps its shape and nothing reflows mid-animation. */
export function encryptLine(original: string, revealed: number): string {
  if (revealed >= original.length) return original;
  let out = original.slice(0, Math.max(0, revealed));
  for (let i = out.length; i < original.length; i++) {
    out += /\s/.test(original[i]) ? original[i] : scrambleChar();
  }
  return out;
}

export function EncryptedBlock({
  children,
  /** How long the whole block takes to decrypt, end to end. */
  revealMs = 1100,
  flipDelayMs = 50,
}: {
  children: React.ReactNode;
  revealMs?: number;
  flipDelayMs?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes: { node: Text; text: string }[] = [];
    let n = walker.nextNode();
    while (n) {
      if (n.nodeValue && n.nodeValue.trim())
        nodes.push({ node: n as Text, text: n.nodeValue });
      n = walker.nextNode();
    }
    if (!nodes.length) return;

    const total = nodes.reduce((sum, e) => sum + e.text.length, 0);
    const restore = () => nodes.forEach((e) => (e.node.nodeValue = e.text));

    const start = performance.now();
    let lastFlip = -Infinity;
    let frame = 0;

    const update = (now: number) => {
      const revealed = Math.floor(
        (total * (now - start)) / Math.max(1, revealMs),
      );
      if (revealed >= total) return restore();

      if (now - lastFlip >= flipDelayMs) {
        let offset = 0;
        for (const e of nodes) {
          e.node.nodeValue = encryptLine(e.text, revealed - offset);
          offset += e.text.length;
        }
        lastFlip = now;
      }
      frame = requestAnimationFrame(update);
    };

    frame = requestAnimationFrame(update);
    return () => {
      cancelAnimationFrame(frame);
      restore();
    };
  }, [revealMs, flipDelayMs]);

  // display:contents so the wrapper adds no box — children stay direct
  // participants in the parent's flex layout.
  return (
    <div ref={ref} className="contents">
      {children}
    </div>
  );
}
