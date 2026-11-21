"use client";

import Link from "next/link";

/*
  A tab bar link. Tapping the tab you're already on, once you've scrolled,
  glides back to the top instead of reloading, like a phone app. At the
  top already, it does what the link does (Board then still takes you
  home to your own board). `home` limits the scroll to the tab's own page,
  so You on /friends still goes back to /me.
*/
export function TabLink({
  href,
  current,
  home,
  className,
  children,
}: {
  href: string;
  current: boolean;
  /** The tab's own path; omit when any page that marks this tab counts. */
  home?: string;
  className: string;
  children: React.ReactNode;
}) {
  // The path is read at tap time, not with usePathname(): reading the URL
  // during render would make every page using the tab bar dynamic.
  return (
    <Link
      href={href}
      aria-current={current ? "page" : undefined}
      className={className}
      onClick={(e) => {
        if (!current || window.scrollY === 0) return;
        if (home && window.location.pathname !== home) return;
        e.preventDefault();
        const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
      }}
    >
      {children}
    </Link>
  );
}
