import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { auth } from "@/auth";
import { unseenCountFor } from "@/lib/notifications";

/*
  The bottom tab bar, on every screen size, so the app moves like an app. Each page
  says which tab it is rather than the bar reading the URL: that keeps the
  bar static (no client JavaScript, and nothing to suspend on routes with
  dynamic params). "Board" goes to /, which sends a signed-in lifter
  straight on to their own college's board.
*/
type Tab = "board" | "global" | "you";

const TABS: { id: Tab; href: string; label: string; icon: React.ReactNode }[] = [
  {
    id: "board",
    href: "/",
    label: "Board",
    icon: <path d="M2 21V13h6v8M8 21V8h8v13M16 21v-6h6v6M1 21h22" />,
  },
  {
    id: "global",
    href: "/global",
    label: "Global",
    icon: (
      <>
        <circle cx="12" cy="12" r="9.5" />
        <path d="M2.5 12h19M12 2.5c2.5 2.6 3.8 5.8 3.8 9.5s-1.3 6.9-3.8 9.5c-2.5-2.6-3.8-5.8-3.8-9.5s1.3-6.9 3.8-9.5z" />
      </>
    ),
  },
  {
    id: "you",
    href: "/me",
    label: "You",
    icon: (
      <>
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7" />
      </>
    ),
  },
];

/*
  The notification bell, top right in the gap above every page's header
  (absolute, not fixed: a fixed bell would sit on the headers' own
  buttons once you scroll). Only for signed-in lifters; it streams in on
  its own so the rest of the page stays cached.
*/
async function Bell() {
  await connection();
  const email = (await auth())?.user?.email;
  const unseen = email ? await unseenCountFor(email).catch(() => null) : null;
  if (unseen === null) return null;

  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-30">
      <div className="mx-auto flex max-w-md justify-end px-3 pt-1">
        <Link
          href="/me#notifications"
          aria-label={unseen > 0 ? `Notifications, ${unseen} new` : "Notifications"}
          className={`press pointer-events-auto relative flex h-9 w-9 items-center justify-center rounded-full ${
            unseen > 0 ? "text-chalk" : "text-chalk-faint hover:text-chalk"
          }`}
        >
          <svg
            aria-hidden
            viewBox="0 0 24 24"
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0" />
          </svg>
          {unseen > 0 && (
            <span className="tnum absolute right-0 top-0 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold leading-none text-iron">
              {unseen > 9 ? "9+" : unseen}
            </span>
          )}
        </Link>
      </div>
    </div>
  );
}

export function TabBar({ active }: { active?: Tab }) {
  return (
    <>
    <Suspense fallback={null}>
      <Bell />
    </Suspense>
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-rule bg-iron pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="mx-auto flex max-w-md">
        {TABS.map((tab) => {
          const current = tab.id === active;
          return (
            <li key={tab.id} className="flex-1">
              <Link
                href={tab.href}
                aria-current={current ? "page" : undefined}
                className={`press flex min-h-14 flex-col items-center justify-center gap-1 text-[11px] font-bold ${
                  current
                    ? "text-accent [filter:drop-shadow(0_0_calc(6px*var(--glow))_var(--accent))]"
                    : "text-chalk-faint hover:text-chalk"
                }`}
              >
                <svg
                  aria-hidden
                  viewBox="0 0 24 24"
                  className="h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  {tab.icon}
                </svg>
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
    </>
  );
}
