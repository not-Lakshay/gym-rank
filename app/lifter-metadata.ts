import type { Metadata } from "next";
import { rankFor } from "@/lib/cached";
import type { Lifter } from "@/lib/lifters";

/*
  What a pasted link looks like before anyone clicks it.

  This is the whole share mechanism: the image is fetched and rendered by
  WhatsApp, Instagram and anything else that unfurls a URL, so one paste
  into a gym group shows the score to everyone in it. The numbers come from
  getRankFor, which reads the same board the site does — a card that
  disagreed with the leaderboard would be worse than no card.

  Shared by /u/<username> and the legacy /lifter/<id> redirect, so a link
  shared before usernames existed still previews as the person, not as a
  generic card.
*/
export async function lifterMetadata(lifter: Lifter | null): Promise<Metadata> {
  const card = lifter ? await rankFor(lifter.id).catch(() => null) : null;
  const image = {
    url: `/api/og?id=${lifter?.id ?? ""}`,
    width: 1200,
    height: 630,
  };

  if (!card) {
    return {
      title: lifter ? `@${lifter.username} · Gym Rank` : "Gym Rank",
      openGraph: { images: [image] },
      twitter: { card: "summary_large_image", images: [image.url] },
    };
  }

  const title = `${card.displayName} · ${card.dots.toFixed(1)} DOTS`;
  const description = `#${card.overallRank} of ${card.totalLifters} at ${card.collegeShort} · ${card.totalKg.toFixed(0)} kg total, ${card.weightClass}.`;

  return {
    title,
    description,
    openGraph: { title, description, images: [image] },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image.url],
    },
  };
}
