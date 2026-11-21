"use client";

import { useEffect } from "react";

/*
  Tapping outside a popup (the "?" explanations, the badge guide, Report a
  problem) closes it, which is the browser's light dismiss. But the same
  tap also lands on whatever is underneath: closing the badge guide over a
  board opened the profile behind it. A popover's ::backdrop can't catch
  it (browsers force pointer-events: none on it), so this swallows that one
  click instead. The popup still closes; the page behind doesn't react.
*/
export function PopoverGuard() {
  useEffect(() => {
    let swallow = false;

    const onPointerDown = (e: PointerEvent) => {
      const open = document.querySelector<HTMLElement>("[popover]:popover-open");
      const target = e.target as Element | null;
      swallow =
        open !== null &&
        target !== null &&
        !open.contains(target) &&
        // The button that opened it toggles it shut; let that click through.
        !target.closest("[popovertarget]");
    };

    const onClick = (e: MouseEvent) => {
      if (!swallow) return;
      swallow = false;
      e.preventDefault();
      e.stopPropagation();
    };

    // Capture phase on window: runs before React's handlers and before a
    // link's navigation.
    window.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("click", onClick, true);
    };
  }, []);

  return null;
}
