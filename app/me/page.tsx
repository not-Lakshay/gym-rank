import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { auth } from "@/auth";
import { DeleteAccountButton, Drawer, LiftsForm, ProfileForm, primary } from "@/app/forms";
import { LiftTiles } from "@/app/lift-tiles";
import { SignInForm, SignOutForm } from "@/app/sign-in";
import { CollegeField } from "@/app/college-picker";
import {
  Bone,
  Check,
  ChevronLeft,
  ChevronRight,
  LiftTitleTag,
  MostTrustedTag,
  ProfileSkeleton,
  TrustBadge,
  navButton,
  Footer,
} from "@/app/board";
import {
  collegeForEmail,
  getCollegeOptions,
  type College,
} from "@/lib/colleges";
import {
  MOVEMENTS,
  TOTAL_MOVEMENTS,
  type Lift,
  type Lifter,
  getLifterByEmail,
  getLiftsFor,
  isUsernameTaken,
  summarise,
} from "@/lib/lifters";
import { suggestUsername, usernameCandidates } from "@/lib/username";
import {
  getGlobalRankFor,
  getLiftBoards,
  getRankFor,
  standingsFor,
  type RankCard,
} from "@/lib/leaderboard";
import type { Movement } from "@/lib/movements";
import { ordinal } from "@/lib/format";
import { unseenCountFor } from "@/lib/notifications";
import { batchLabel } from "@/lib/batch";
import { TRUST_LABEL, cosignStatus, cosignText, trustTier } from "@/lib/cosign";
import { liftTitles, mostTrusted } from "@/lib/cached";
import { plateFor } from "@/lib/plates";
import { weightClassFor } from "@/lib/scoring";
import { siteUrl } from "@/lib/site";
import { ShareButton } from "@/app/share";
import { Avatar } from "@/app/avatar";
import { Roll } from "@/app/roll";
import { TabBar } from "@/app/tab-bar";
import { DotsHelp, TrustHelp } from "@/app/help";
import { ThemeSwitch } from "@/app/prefs";

// `error` is set by Auth.js when a sign-in fails (pages.error in auth.ts).
type SearchParams = Promise<{ college?: string; error?: string }>;

export default function MePage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <>
      <main className="mx-auto w-full max-w-md px-5 pb-16 pt-10">
        <Suspense
          fallback={
            <>
              <Bone className="h-11 w-36" />
              <ProfileSkeleton />
            </>
          }
        >
          <Dashboard searchParams={searchParams} />
        </Suspense>
        <div className="mt-14 border-t border-rule pt-5">
          <ThemeSwitch />
        </div>
        <Footer />
      </main>
      <TabBar active="you" />
    </>
  );
}

async function Dashboard({ searchParams }: { searchParams: SearchParams }) {
  await connection();
  const session = await auth();
  const email = session?.user?.email;

  if (!email) {
    const { error } = await searchParams;
    return (
      <div>
        <div className="pt-8">
          <h1 className="text-[1.75rem] font-extrabold leading-none tracking-[-0.03em]">
            Sign in to add your lifts
          </h1>
          {error && (
            <p role="alert" className="mt-3 text-[13px] leading-relaxed text-chalk-dim">
              That sign-in didn&rsquo;t finish. Try again — if you opened the
              link inside WhatsApp or Instagram, open it in Chrome or Safari
              first.
            </p>
          )}
          <SignInForm
            redirectTo="/me"
            label="Continue with Google"
            className={primary}
            formClassName="pt-5"
          />
        </div>
      </div>
    );
  }

  const lifter = await getLifterByEmail(email);

  if (!lifter || !lifter.college) {
    // First-time setup needs the college list and a free handle; the
    // dashboard below does not, so this is the only branch that pays for
    // them. All of it in one round trip.
    const { college: fromUrl } = await searchParams;
    const [collegeField, suggested] = await Promise.all([
      buildCollegeField(email, lifter, fromUrl ?? null),
      lifter?.username ?? firstFreeUsername(session?.user?.name ?? "lifter"),
    ]);
    return (
      <div>
        <div className="pt-8">
          <h1 className="text-[1.75rem] font-extrabold leading-none tracking-[-0.03em]">
            {lifter ? "Pick your college" : "Set up your profile"}
          </h1>
          <p className="mt-2 text-[13px] leading-relaxed text-chalk-dim">
            Your college decides which board you are on. Bodyweight is what
            makes the scores comparable — it is never shown to anyone, only
            the class it falls into.
          </p>
          <div className="pt-6">
            <ProfileForm
              defaultName={lifter?.displayName ?? session?.user?.name ?? ""}
              defaultUsername={suggested}
              currentUsername={lifter?.username ?? null}
              defaultBodyweight={lifter?.bodyweightKg}
              defaultAvatar={lifter?.avatar ?? null}
              submitLabel="Continue"
              college={collegeField}
            />
          </div>
        </div>
      </div>
    );
  }

  // Everything the dashboard shows, in one round trip. The database is a
  // region away and each sequential stage is ~80 ms of nothing, so the
  // whole page is two stages: who you are, then everything about you.
  // The notifications themselves live on /notifications; here just the
  // unread count for the bell.
  const [lifts, card, globalCard, liftBoards, unseen, holders, titles] = await Promise.all([
    getLiftsFor(lifter.id),
    getRankFor(lifter.id, lifter.college.id).catch(() => null),
    getGlobalRankFor(lifter.id).catch(() => null),
    getLiftBoards({ collegeId: lifter.college.id }).catch(() => null),
    unseenCountFor(email).catch(() => 0),
    mostTrusted().catch(() => []),
    liftTitles().catch(() => ({}) as Record<string, Movement[]>),
  ]);
  const standings = liftBoards ? standingsFor(liftBoards, lifter.id) : {};

  return (
    <LifterView
      lifter={lifter}
      college={lifter.college}
      lifts={lifts}
      card={card}
      globalCard={globalCard}
      standings={standings}
      unseen={unseen ?? 0}
      isMostTrusted={holders.some((h) => h.lifterId === lifter.id)}
      myTitles={titles[lifter.id] ?? []}
      editForm={
        // Collapsed by default and needs the 159-college list, so it
        // streams in behind the dashboard instead of holding it up.
        <Suspense fallback={<Bone className="h-11 w-full" />}>
          <EditProfile
            lifter={lifter}
            email={email}
            cosigned={lifts.some((l) => l.cosigners.length > 0)}
          />
        </Suspense>
      }
    />
  );
}

/**
 * The college field: an institute email locks it, anything else gets the
 * picker, preselected from ?college= when they arrived via a college's
 * board. Fetches the two things it needs in parallel.
 */
async function buildCollegeField(
  email: string,
  lifter: Lifter | null,
  fromUrl: string | null = null,
) {
  const [detected, colleges] = await Promise.all([
    collegeForEmail(email),
    getCollegeOptions(),
  ]);
  const urlSlug = colleges.some((c) => c.slug === fromUrl) ? fromUrl : null;
  return (
    <CollegeField
      colleges={colleges}
      defaultSlug={lifter?.college?.slug ?? urlSlug}
      locked={
        detected
          ? { slug: detected.slug, shortName: detected.shortName, name: detected.name }
          : null
      }
      defaultBatch={lifter?.batchYear ?? null}
    />
  );
}

async function EditProfile({
  lifter,
  email,
  cosigned,
}: {
  lifter: Lifter;
  email: string;
  cosigned: boolean;
}) {
  const collegeField = await buildCollegeField(email, lifter);
  return (
    <ProfileForm
      defaultName={lifter.displayName}
      defaultUsername={lifter.username}
      currentUsername={lifter.username}
      defaultBodyweight={lifter.bodyweightKg}
      defaultAvatar={lifter.avatar}
      submitLabel="Save profile"
      college={collegeField}
      cosigned={cosigned}
    />
  );
}

async function firstFreeUsername(displayName: string): Promise<string> {
  const candidates = usernameCandidates(suggestUsername(displayName), 20);
  for (const candidate of candidates) {
    if (!(await isUsernameTaken(candidate))) return candidate;
  }
  return candidates[0];
}

function LifterView({
  lifter,
  college,
  lifts,
  card,
  globalCard,
  standings,
  unseen,
  isMostTrusted,
  myTitles,
  editForm,
}: {
  lifter: Lifter;
  college: College;
  lifts: Lift[];
  card: RankCard | null;
  globalCard: RankCard | null;
  standings: Partial<Record<Movement, { rank: number; of: number }>>;
  unseen: number;
  isMostTrusted: boolean;
  myTitles: Movement[];
  editForm: React.ReactNode;
}) {
  const summary = summarise(lifts, lifter.bodyweightKg);
  const byMovement = new Map(lifts.map((l) => [l.movement, l]));
  // A disputed lift counts as not co-signed.
  const perLift = TOTAL_MOVEMENTS.map((m) => {
    const lift = byMovement.get(m);
    return lift && !lift.disputed ? lift.cosigners : [];
  });
  const cosign = cosignStatus(perLift);
  const tier = trustTier(perLift);
  const vouchers = new Set(perLift.flat().map((w) => w.id)).size;
  const weightClass = weightClassFor(lifter.bodyweightKg);
  const plate = plateFor(weightClass);

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <Link href={`/c/${college.slug}`} className={navButton}>
          <ChevronLeft />
          {college.shortName} board
        </Link>
        <Link
          href="/notifications"
          aria-label={unseen > 0 ? `Notifications, ${unseen} new` : "Notifications"}
          className={`${navButton} bell-wrap relative px-3`}
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
            <path d="M12 2.5v1.2" />
            <path d="M5.5 17.5h13c-1.2-1.3-1.9-2.9-1.9-5.2v-1.6a4.6 4.6 0 0 0-9.2 0v1.6c0 2.3-.7 3.9-1.9 5.2z" />
            <path d="M9.8 20.2a2.4 2.4 0 0 0 4.4 0" />
          </svg>
          {unseen > 0 && (
            <span className="bell-badge tnum absolute -right-2 -top-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1 text-[11px] font-extrabold leading-none text-iron ring-2 ring-iron">
              {unseen > 9 ? "9+" : unseen}
            </span>
          )}
        </Link>
      </div>

      <div className="pt-8">
      {/* The one loud thing on the page — this is what gets screenshotted. */}
      <section
        className="rise glow"
        style={{ "--i": 0, "--glow-color": plate } as React.CSSProperties}
      >
        <div
          aria-hidden
          className="h-1 w-16 rounded-full"
          style={{ background: plate }}
        />

        {summary.dots === null ? (
          <div className="pt-4">
            <p className="text-[1.5rem] font-extrabold leading-tight tracking-[-0.02em]">
              No score yet
            </p>
            <p className="mt-2 text-[13px] leading-relaxed text-chalk-dim">
              Enter your{" "}
              {summary.missingForTotal
                .map((m) =>
                  MOVEMENTS.find((x) => x.id === m)?.label.toLowerCase(),
                )
                .join(", ")}{" "}
              to get on the {college.shortName} board.
            </p>
          </div>
        ) : (
          <div className="pt-4">
            {/* Rolls in on arrival, and again after a save changes it. */}
            <p className="tnum text-[4.5rem] font-extrabold leading-none tracking-[-0.045em]">
              <Roll value={summary.dots} />
            </p>
            <p className="mt-3 text-[13px] text-chalk-dim">
              DOTS score
              <DotsHelp />
              <span className="tnum text-chalk-faint">
                {" "}
                · {summary.totalKg?.toFixed(0)} kg total
              </span>
            </p>

            {tier && (
              <button
                type="button"
                popoverTarget="trust-help"
                className={`press mt-3 inline-flex max-w-full flex-wrap items-center gap-1.5 rounded-full border border-rule py-1 pl-2 pr-3 text-[13px] text-chalk hover:border-chalk-faint ${
                  // No name plate on your own page; the pill wears the aurora.
                  isMostTrusted ? "aurora" : ""
                }`}
              >
                <TrustBadge tier={tier} size={16} named />
                <span className="font-bold">{TRUST_LABEL[tier]}</span>
                <span className="text-chalk-dim">
                  · {vouchers} {vouchers === 1 ? "person vouches" : "people vouch"}
                </span>
                {isMostTrusted && <MostTrustedTag />}
                <span aria-hidden className="text-chalk-faint">?</span>
              </button>
            )}
            {myTitles.length > 0 && (
              <p className="mt-2 flex flex-wrap items-center gap-1.5">
                {myTitles.map((m) => <LiftTitleTag key={m} movement={m} />)}
                <span className="text-[12px] text-chalk-dim">at {college.shortName}</span>
              </p>
            )}
            <TrustHelp />

            {card && (
              <p className="mt-3 flex items-center gap-2 text-[15px] font-bold">
                {card.overallRank <= 3 && (
                  <span
                    className="medal"
                    style={
                      {
                        "--medal": ["var(--gold)", "var(--silver)", "var(--bronze)"][
                          card.overallRank - 1
                        ],
                      } as React.CSSProperties
                    }
                  >
                    {card.overallRank}
                  </span>
                )}
                <span>
                  <span className="tnum">#{card.overallRank}</span> of{" "}
                  <span className="tnum">{card.totalLifters}</span>
                  <span className="font-normal text-chalk-dim">
                    {" "}
                    at {college.shortName} · {ordinal(card.classRank)} in class
                  </span>
                </span>
              </p>
            )}

            {/* The reward for co-signing. Until then, Next steps (below)
                says exactly what it takes to get there. */}
            {globalCard && (
              <p className="mt-1.5 text-[13px] text-chalk-dim">
                <span className="tnum font-bold text-chalk">
                  #{globalCard.overallRank}
                </span>{" "}
                of {globalCard.totalLifters} across all colleges
              </p>
            )}

            {/*
              The gap to the person directly above you. "Third" is a fact;
              "2.3 off Sarthak" is a reason to come back next week, which
              is the only thing that makes a leaderboard worth keeping.
            */}
            {card?.nextUp ? (
              <div className="mt-5">
                <p className="text-[13px] text-chalk-dim">
                  <span className="tnum font-bold text-chalk">
                    {card.nextUp.dotsAhead.toFixed(1)}
                  </span>{" "}
                  to pass {card.nextUp.displayName}
                </p>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-rule">
                  <div
                    className="bar-grow h-full rounded-full"
                    style={{
                      width: `${(card.dots / (card.dots + card.nextUp.dotsAhead)) * 100}%`,
                      background: plate,
                    }}
                  />
                </div>
              </div>
            ) : card ? (
              <p className="mt-5 text-[13px] font-bold">
                Top of the board. Nobody above you.
              </p>
            ) : null}
          </div>
        )}

        <p className="mt-4 flex items-center gap-2.5 text-[14px] font-bold">
          <Avatar name={lifter.displayName} ring={plate} size={32} avatar={lifter.avatar} />
          <span className="min-w-0">
            {lifter.displayName}
            <span className="font-normal text-chalk-dim">
              {" "}
              · @{lifter.username}
              {lifter.batchYear !== null && ` · ${batchLabel(lifter.batchYear)}`} · {weightClass}
            </span>
          </span>
        </p>

        {card && (
          <div className="pt-6">
            <ShareButton
              url={`${siteUrl}/u/${lifter.username}`}
              text={`#${card.overallRank} of ${card.totalLifters} at ${college.shortName} — ${card.dots.toFixed(1)} DOTS.`}
            />
            <p className="mt-2 text-[12px] leading-relaxed text-chalk-faint">
              Sends your page. Whoever opens it sees the board.
            </p>
          </div>
        )}
      </section>

      <div className="rise pt-8" style={{ "--i": 2 } as React.CSSProperties}>
        <LiftTiles lifts={byMovement} titles={myTitles} />
      </div>

      {/* Folded away once there's something in it, so the page reads at a glance. */}
      <Drawer
        summary="Your lifts"
        defaultOpen={lifts.length === 0}
        className="rise pt-8"
        style={{ "--i": 2 } as React.CSSProperties}
      >
        {cosign && (
          <p className="flex items-center gap-1.5 pt-3 text-[13px] text-chalk-dim">
            <span className={cosign.kind === "full" ? "" : "opacity-50"}>
              <Check />
            </span>
            {cosignText(cosign)}
          </p>
        )}

        <LiftsForm
          lifts={Object.fromEntries(byMovement)}
          standings={standings}
          boardHref={`/c/${college.slug}`}
          bodyweightKg={lifter.bodyweightKg}
        />
      </Drawer>

      <Link
        href="/friends"
        className="rise mt-6 flex items-center justify-between rounded-sm border border-rule bg-iron-raised px-4 py-3 text-[14px] text-chalk-dim transition-colors hover:border-chalk-faint hover:text-chalk"
        style={{ "--i": 1 } as React.CSSProperties}
      >
        <span>
          <span className="font-bold text-chalk">Friends board</span>
          <span> · you and your friends</span>
        </span>
        <ChevronRight />
      </Link>

      {/* Up here, by the name and avatar it changes, not under everything. */}
      <Drawer summary="Edit profile" className="rise pt-6" style={{ "--i": 1 } as React.CSSProperties}>
        <div className="pt-5">{editForm}</div>
      </Drawer>

      {/*
        After the first save: what to do next, until all three lifts are
        co-signed and there's nothing left to do but lift.
      */}
      {card && card.verifiedCount < 3 && (
        <section className="rise pt-10" style={{ "--i": 1 } as React.CSSProperties}>
          <h2 className="border-b border-rule pb-2 caption">Next steps</h2>
          <ol className="mt-4 flex flex-col gap-5">
            <Step n={1} done title={`You're on the ${college.shortName} board`}>
              <p>
                #{card.overallRank} of {card.totalLifters}. Save a better set any
                time to climb.
              </p>
            </Step>
            <Step n={2} title="Send your page to someone who watched">
              <p>
                They open it and tap &ldquo;I saw this&rdquo; on each lift they
                saw. That&rsquo;s a co-sign.
              </p>
              <div className="mt-3">
                <ShareButton
                  url={`${siteUrl}/u/${lifter.username}`}
                  text="Watched my lifts? Co-sign them on Gym Rank:"
                  label="Send to a witness"
                />
              </div>
            </Step>
            <Step n={3} title="Get all three lifts co-signed">
              <p>
                {card.verifiedCount} of 3 so far. All three puts you on the
                global board, against every college.
              </p>
              <div aria-hidden className="mt-2 flex gap-1.5">
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className={`h-1.5 w-8 rounded-full ${
                      i < card.verifiedCount ? "bg-[var(--success)]" : "bg-rule"
                    }`}
                  />
                ))}
              </div>
            </Step>
          </ol>
        </section>
      )}

      <section className="rise pt-10" style={{ "--i": 3 } as React.CSSProperties}>
        <h2 className="border-b border-rule pb-2 caption">
          Get co-signed
        </h2>
        <p className="mt-3 text-[13px] leading-relaxed text-chalk-dim">
          Numbers here are self-reported. Someone at {college.shortName} who
          watched your set can vouch for it from your page — send them this
          link, or have them open it on your phone right after the set.
        </p>
        <Link href={`/u/${lifter.username}`} className={`${navButton} mt-3 w-fit`}>
          Your public page
          <ChevronRight />
        </Link>
        <p className="tnum mt-2 text-[12px] text-chalk-faint">
          {siteUrl.replace(/^https?:\/\//, "")}/u/{lifter.username}
        </p>
      </section>

      <SignOutForm className={quietButton} formClassName="pt-10" />

      <div className="mt-10 border-t border-rule pt-6">
        <DeleteAccountButton />
      </div>
      </div>
    </div>
  );
}

/* One item of Next steps: a number, or a tick once it's done. */
function Step({
  n,
  done = false,
  title,
  children,
}: {
  n: number;
  done?: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <li className="flex gap-3">
      <span
        aria-hidden
        className={`tnum mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[12px] font-bold ${
          done ? "bg-[var(--success)] text-iron" : "border border-rule text-chalk-dim"
        }`}
      >
        {done ? "✓" : n}
      </span>
      <div className="min-w-0 flex-1 text-[13px] leading-relaxed text-chalk-dim">
        <p className={`text-[14px] font-bold ${done ? "text-chalk-dim" : "text-chalk"}`}>
          {title}
          {done && <span className="sr-only"> (done)</span>}
        </p>
        {children}
      </div>
    </li>
  );
}

const quietButton =
  "press inline-flex min-h-11 items-center rounded-sm border border-rule px-4 text-[15px] text-chalk-faint hover:border-chalk-faint hover:text-chalk";
