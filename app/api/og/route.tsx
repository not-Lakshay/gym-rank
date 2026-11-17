import { ImageResponse } from "next/og";
import { getRankFor, type RankCard } from "@/lib/leaderboard";
import { getLifterById } from "@/lib/lifters";
import { plateHexFor } from "@/lib/plates";
import { siteLabel } from "@/lib/site";
import { ordinal } from "@/lib/format";
import { isUuid } from "@/lib/validate";

/*
  The share card, rendered as a real PNG.

  This exists because of how links travel. Someone pastes their page into a
  gym WhatsApp group; WhatsApp fetches the page and renders its preview
  image. If that image is the rank card, the whole group sees a score and a
  URL without anyone screenshotting anything. So the card is not a page
  decoration — it is the entire distribution mechanism, and the domain
  printed at the bottom is the single most important element on it.

  Why a route handler and not app/lifter/[id]/opengraph-image.tsx: this one
  reads the database, and a route handler sits outside the React tree, so
  Cache Components' rules about uncached reads never apply to it.

  Satori constraints worth knowing before editing: flexbox only (no grid),
  every element with children needs an explicit display, and custom
  properties don't resolve — hence plateHexFor rather than plateFor.
*/

const IRON = "#0a0908";
const IRON_RAISED = "#161411";
const CHALK = "#f3efe7";
const CHALK_DIM = "#a49d91";
const CHALK_FAINT = "#6b6459";

const SIZE = { width: 1200, height: 630 };

export async function GET(request: Request) {
  const raw = new URL(request.url).searchParams.get("id");
  // Junk ids never reach the database; they get the generic card.
  const id = raw && isUuid(raw) ? raw : null;

  let card: RankCard | null = null;
  let fallbackName: string | null = null;

  if (id) {
    card = await getRankFor(id).catch(() => null);
    if (!card) {
      const lifter = await getLifterById(id).catch(() => null);
      fallbackName = lifter?.displayName ?? null;
    }
  }

  // A link with no rank behind it still has to preview as something, or the
  // message looks broken and nobody clicks it.
  const accent = card ? plateHexFor(card.weightClass) : CHALK_FAINT;

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          width: "100%",
          height: "100%",
          background: IRON,
          color: CHALK,
          fontFamily: "sans-serif",
        }}
      >
        {/* The plate colour, carrying the weight class the way a loaded bar does. */}
        <div style={{ display: "flex", width: 18, background: accent }} />

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            flex: 1,
            padding: "60px 72px",
          }}
        >
          <div style={{ display: "flex", fontSize: 30, color: CHALK_DIM }}>
            {card ? `${card.collegeShort} gym` : "College gyms"} · bodyweight-adjusted
          </div>

          {card ? (
            <div
              style={{
                display: "flex",
                alignItems: "flex-end",
                justifyContent: "space-between",
              }}
            >
              <div style={{ display: "flex", flexDirection: "column" }}>
                <div
                  style={{
                    display: "flex",
                    fontSize: 200,
                    fontWeight: 800,
                    lineHeight: 0.82,
                    letterSpacing: "-0.055em",
                  }}
                >
                  #{card.overallRank}
                </div>
                <div
                  style={{
                    display: "flex",
                    fontSize: 38,
                    color: CHALK_DIM,
                    paddingTop: 14,
                  }}
                >
                  of {card.totalLifters} lifters
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "flex-end",
                  paddingBottom: 10,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    fontSize: 84,
                    fontWeight: 800,
                    lineHeight: 1,
                    letterSpacing: "-0.03em",
                  }}
                >
                  {card.dots.toFixed(1)}
                </div>
                <div
                  style={{ display: "flex", fontSize: 28, color: CHALK_DIM, paddingTop: 8 }}
                >
                  DOTS · {card.totalKg.toFixed(0)} kg total
                </div>
              </div>
            </div>
          ) : (
            <div
              style={{ display: "flex", flexDirection: "column", maxWidth: 860 }}
            >
              <div
                style={{
                  display: "flex",
                  fontSize: 76,
                  fontWeight: 800,
                  letterSpacing: "-0.03em",
                  lineHeight: 1.05,
                }}
              >
                {fallbackName
                  ? `${fallbackName} hasn't finished a total yet`
                  : "See how your lifts rank"}
              </div>
              <div
                style={{
                  display: "flex",
                  fontSize: 32,
                  color: CHALK_DIM,
                  paddingTop: 24,
                }}
              >
                Squat, bench and deadlift, scored against bodyweight.
              </div>
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column" }}>
            {card && (
              <div
                style={{
                  display: "flex",
                  fontSize: 52,
                  fontWeight: 700,
                  letterSpacing: "-0.02em",
                }}
              >
                {card.displayName}
                {/* paddingLeft rather than a space literal: JSX trims the
                    whitespace between expressions, so a written space ends
                    up flush against the name. Class rank is dropped when
                    the class holds one person — "1st of 1" is noise. */}
                <span
                  style={{
                    color: CHALK_DIM,
                    fontWeight: 400,
                    paddingLeft: 18,
                  }}
                >
                  {card.classSize > 1
                    ? `· ${card.weightClass}, ${ordinal(card.classRank)} of ${card.classSize}`
                    : `· ${card.weightClass}`}
                </span>
              </div>
            )}

            {/* The reason the card exists. Never remove this line. */}
            <div
              style={{
                display: "flex",
                marginTop: 26,
                padding: "14px 24px",
                borderRadius: 6,
                background: IRON_RAISED,
                fontSize: 30,
                color: CHALK,
                alignSelf: "flex-start",
              }}
            >
              {siteLabel}
            </div>
          </div>
        </div>
      </div>
    ),
    {
      ...SIZE,
      headers: {
        // Short enough that a new PR shows up on the next share, long
        // enough that one link pasted in a busy group doesn't re-query
        // Neon for every preview fetch.
        "cache-control": "public, max-age=60, s-maxage=60",
      },
    },
  );
}
