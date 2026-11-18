import Link from "next/link";

/*
  The bottom tab bar on phones, so the app moves like an app. Each page
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

export function TabBar({ active }: { active?: Tab }) {
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-rule bg-iron pb-[env(safe-area-inset-bottom)] md:hidden"
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
                  current ? "text-accent" : "text-chalk-faint hover:text-chalk"
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
  );
}
