import type { Metadata } from "next";
import { Archivo } from "next/font/google";
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
  title: "Gym Rank",
  description: "Bodyweight-adjusted lifting leaderboard for the LNMIIT gym.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${archivo.variable} h-full`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
