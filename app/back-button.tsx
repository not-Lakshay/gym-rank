"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

/*
  "Back" for pages you reach from the footer (privacy, terms, scoring):
  they have no single parent, so it returns to wherever you came from.
  Opened fresh in a new tab, with nothing to go back to, it goes home.
*/
export function BackButton({
  className,
  children,
}: {
  className: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  return (
    <Link
      href="/"
      className={className}
      onClick={(e) => {
        if (window.history.length > 1) {
          e.preventDefault();
          router.back();
        }
      }}
    >
      {children}
    </Link>
  );
}
