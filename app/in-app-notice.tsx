"use client";

import { useState, useSyncExternalStore } from "react";
import { chromeIntentUrl, inAppBrowser, isAndroid } from "@/lib/inapp";

const noSubscribe = () => () => {};

/**
 * Renders `children` (the sign-in button) in a real browser. Inside an
 * app's built-in browser, where Google sign-in fails, it shows how to get
 * out instead. The server render always shows the button; the client swaps
 * it on hydration.
 */
export function InAppGate({
  className,
  compact,
  label,
  boxClassName = "",
  children,
}: {
  className: string;
  /** Spacing for the notice box (the form's own, so it sits the same). */
  boxClassName?: string;
  /** A small header slot: link to /me, which has room for the full notice. */
  compact?: boolean;
  label: string;
  children: React.ReactNode;
}) {
  const app = useSyncExternalStore(
    noSubscribe,
    () => inAppBrowser(navigator.userAgent),
    () => null,
  );
  const android = useSyncExternalStore(
    noSubscribe,
    () => isAndroid(navigator.userAgent),
    () => false,
  );
  const [copied, setCopied] = useState<boolean | null>(null);

  if (!app) return <>{children}</>;
  if (compact) {
    return (
      <a href="/me" className={className}>
        {label}
      </a>
    );
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(location.href);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className={`${boxClassName} text-[13px] leading-relaxed text-chalk-dim`}>
      <div className="rounded-sm border border-rule p-3">
        <p className="font-bold text-chalk">Open this in your browser to sign in</p>
        <p className="mt-1">
          Google blocks sign-in inside{" "}
          {app === "this app" ? "apps' built-in browsers" : `${app}'s browser`}.
          {android
            ? " Tap below to open this page in Chrome."
            : " Tap ⋯ or the share icon and choose “Open in Safari”, or copy the link and paste it there."}
        </p>
        {android ? (
          // Read the URL on tap, not render: a client-side navigation changes it.
          <button
            type="button"
            onClick={() => location.assign(chromeIntentUrl(location.href))}
            className={`${className} mt-3`}
          >
            Open in Chrome
          </button>
        ) : (
          <button type="button" onClick={copy} className={`${className} mt-3`}>
            {copied ? "Link copied" : "Copy link"}
          </button>
        )}
        {copied === false && (
          <p className="mt-2 break-all text-[12px] text-chalk-faint">
            Couldn&rsquo;t copy. Long-press to copy: {location.href}
          </p>
        )}
      </div>
    </div>
  );
}
