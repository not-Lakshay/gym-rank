import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { renderSVG } from "uqr";
import { Barbell } from "@/app/barbell";
import { collegeBySlug } from "@/lib/cached";
import { siteLabel, siteUrl } from "@/lib/site";

/*
  A4 posters for a college gym wall: open /poster/<slug>?v=1..4, then
  Print → Save as PDF (A4, no margins, background graphics on). Printed
  once and left up for months, so nothing on them can go stale: no names,
  no counts, just the question the board answers.

  Four variants, one hook each, meant to go up together around the gym:
    1  "Who's the strongest?"  question and QR side by side
    2  "Prove it."             an empty podium
    3  "Your PR deserves…"     a loaded barbell
    4  "60 kg can beat 90 kg"  the bodyweight-fair scoring

  Not linked from anywhere and kept out of search.
*/

export const metadata: Metadata = {
  title: "Poster — Gym Rank",
  robots: { index: false, follow: false },
};

type Variant = "1" | "2" | "3" | "4";

export default function PosterPage({ params, searchParams }: PageProps<"/poster/[slug]">) {
  return (
    <Suspense>
      <Poster params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function Poster({
  params,
  searchParams,
}: Pick<PageProps<"/poster/[slug]">, "params" | "searchParams">) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const college = await collegeBySlug(slug).catch(() => null);
  if (!college) notFound();
  const v: Variant = (["1", "2", "3", "4"] as const).find((x) => x === query.v) ?? "1";
  const name = college.shortName;

  const qr = renderSVG(`${siteUrl}/p/${college.slug}`, {
    ecc: "Q",
    border: 2,
    blackColor: "#0a0908",
    whiteColor: "#ffffff",
  });
  const qrCard = (
    <div className="poster-qr">
      <div dangerouslySetInnerHTML={{ __html: qr }} />
      <p className="poster-scan">SCAN ME</p>
    </div>
  );

  return (
    <main className="poster-wrap">
      {/* Only this page prints edge to edge on A4; a style tag that leaves with the route. */}
      <style>{"@page { size: A4; margin: 0; }"}</style>
      <div className={`poster poster-v${v}`}>
        <span aria-hidden className="poster-glow" />

        <p className="poster-brand">GYM RANK · {name}</p>

        {v === "1" && (
          <>
            <h1 className="poster-title">
              Who&rsquo;s the <span className="poster-hot">strongest</span> at {name}?
            </h1>
            <p className="poster-sub">
              The {name} gym leaderboard. Squat, bench and deadlift, scored for bodyweight,
              so a 60&nbsp;kg lifter can beat a 90&nbsp;kg one.
            </p>
            <div className="poster-qr-row">
              <div>
                <p className="poster-tease-big">
                  Who&rsquo;s #1
                  <br />
                  right now?
                </p>
                <p className="poster-tease-small">Scan to find out.</p>
                <span aria-hidden className="poster-arrow">→</span>
              </div>
              {qrCard}
            </div>
          </>
        )}

        {v === "2" && (
          <>
            <h1 className="poster-title">
              Think you&rsquo;re strong?
              <br />
              <span className="poster-hot">Prove it.</span>
            </h1>
            <Podium />
            <div className="poster-qr-row">
              <div>
                <p className="poster-tease-big">
                  The podium&rsquo;s
                  <br />
                  waiting.
                </p>
                <p className="poster-tease-small">
                  Squat, bench, deadlift. Scored for bodyweight.
                </p>
                <span aria-hidden className="poster-arrow">→</span>
              </div>
              {qrCard}
            </div>
          </>
        )}

        {v === "3" && (
          <>
            <h1 className="poster-title">
              Your PR deserves
              <br />a <span className="poster-hot">leaderboard.</span>
            </h1>
            <p className="poster-sub">
              Stop telling people your bench. Put it on the {name} board, get it co-signed
              by the people who watched, and see where you really rank.
            </p>
            <div aria-hidden className="poster-bar">
              <Barbell kg={140} />
            </div>
            <div className="poster-qr-row">
              <div>
                <p className="poster-tease-big">
                  See where
                  <br />
                  you rank.
                </p>
                <p className="poster-tease-small">One minute. Free.</p>
                <span aria-hidden className="poster-arrow">→</span>
              </div>
              {qrCard}
            </div>
          </>
        )}

        {v === "4" && (
          <>
            <h1 className="poster-title">
              Pound for pound,
              <br />
              who&rsquo;s the <span className="poster-hot">strongest?</span>
            </h1>
            <p className="poster-sub">
              Every lift on the {name} board is scored against your bodyweight. A fair
              fight, every time.
            </p>
            <Scale />
            <div className="poster-qr-row">
              <div>
                <p className="poster-tease-big">
                  Where do
                  <br />
                  you rank?
                </p>
                <p className="poster-tease-small">Scan to find out.</p>
                <span aria-hidden className="poster-arrow">→</span>
              </div>
              {qrCard}
            </div>
          </>
        )}

        {/* For a scan that fails: glare, dim light, an old camera. The home page has the college picker. */}
        <p className="poster-url">
          QR not working? Type <b>{siteLabel}</b>
        </p>

        <ol className="poster-steps">
          <li>
            <b>1</b>
            <span>Scan</span>
          </li>
          <li>
            <b>2</b>
            <span>Sign in with your college email</span>
          </li>
          <li>
            <b>3</b>
            <span>Add your lifts. About a minute.</span>
          </li>
        </ol>

        <div className="poster-chips">
          <span style={{ "--c": "var(--gold)" } as React.CSSProperties}>
            #1 squat · bench · deadlift titles up for grabs
          </span>
          <span style={{ "--c": "var(--success)" } as React.CSSProperties}>
            Gym-mates co-sign your lifts. No fake numbers.
          </span>
          <span style={{ "--c": "var(--lift-bench)" } as React.CSSProperties}>
            {v === "4"
              ? "Weight classes: compete against lifters your weight"
              : "Weight classes: compete with people your size"}
          </span>
        </div>

        <p className="poster-foot">
          Free · No app to download · Made by a fellow {name} lifter
        </p>
      </div>
    </main>
  );
}

/** Three empty steps, #2 · #1 · #3, each waiting for a name. */
function Podium() {
  const steps = [
    { place: 2, color: "var(--silver)", h: "17mm" },
    { place: 1, color: "var(--gold)", h: "25mm" },
    { place: 3, color: "var(--bronze)", h: "13mm" },
  ];
  return (
    <div aria-hidden className="poster-podium">
      {steps.map((s) => (
        <div key={s.place} style={{ "--c": s.color } as React.CSSProperties}>
          <span className="poster-podium-who">?</span>
          <span className="poster-podium-step" style={{ height: s.h }}>
            {s.place}
          </span>
        </div>
      ))}
    </div>
  );
}

/**
 * A balance held level: two red plates on one pan, one blue on the other.
 * Different loads, even beam: what scoring against bodyweight does.
 */
function Scale() {
  const plate = (x: number, y: number, r: number, fill: string) => (
    <g>
      <circle cx={x} cy={y} r={r} fill={fill} />
      <circle cx={x} cy={y} r={r * 0.22} fill="var(--iron)" />
    </g>
  );
  return (
    <svg aria-hidden className="poster-scale" viewBox="0 0 300 130">
      <path d="M150 34 L150 118 M118 122 H182" stroke="var(--chalk-dim)" strokeWidth="6" strokeLinecap="round" />
      <path d="M40 34 H260" stroke="var(--chalk)" strokeWidth="6" strokeLinecap="round" />
      <circle cx="150" cy="34" r="8" fill="var(--gold)" />
      <path d="M40 34 L18 84 M40 34 L62 84 M260 34 L238 84 M260 34 L282 84" stroke="var(--chalk-dim)" strokeWidth="2" />
      <path d="M12 84 H68 M232 84 H288" stroke="var(--gold)" strokeWidth="6" strokeLinecap="round" />
      {plate(30, 66, 15, "var(--plate-25)")}
      {plate(52, 66, 15, "var(--plate-25)")}
      {plate(260, 64, 17, "var(--plate-20)")}
    </svg>
  );
}
