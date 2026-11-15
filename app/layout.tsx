import type { Metadata } from "next";
import { Archivo } from "next/font/google";
import { siteUrl } from "@/lib/site";
import "./globals.css";

/*
  One family, used across three weights. Archivo is a grotesque with true
  tabular figures, which matters more here than anything else: every screen
  in this app is a column of numbers that has to line up.
*/
const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  weight: ["400", "500", "700", "800"],
});

export const metadata: Metadata = {
  // Without this, the relative /api/og path in a page's openGraph images
  // never resolves to an absolute URL and the share preview arrives with
  // no image at all — the failure is silent, which is why it's worth a
  // comment rather than a one-liner.
  metadataBase: new URL(siteUrl),
  title: "Gym Rank",
  description:
    "Bodyweight-adjusted lifting leaderboards for college gyms across India.",
  // Every page inherits a preview card, so the bare domain pasted into a
  // group chat still unfurls as something. With no id, /api/og renders its
  // generic face; a lifter page overrides this with their own numbers.
  openGraph: {
    title: "Gym Rank",
    description:
      "Bodyweight-adjusted lifting leaderboards for college gyms across India.",
    images: [{ url: "/api/og", width: 1200, height: 630 }],
  },
  twitter: { card: "summary_large_image", images: ["/api/og"] },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${archivo.variable} h-full`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
