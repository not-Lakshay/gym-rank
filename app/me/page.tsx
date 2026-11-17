import { Suspense } from "react";
import Link from "next/link";
import { after, connection } from "next/server";
import { auth } from "@/auth";
import { DeleteAccountButton, LiftRowForm, ProfileForm, primary } from "@/app/forms";
import { SignInForm, SignOutForm } from "@/app/sign-in";
import { CollegeField } from "@/app/college-picker";
import {
  Bone,
  Check,
  ChevronLeft,
  ChevronRight,
  ProfileSkeleton,
  navButton,
} from "@/app/board";
import {
  collegeForEmail,
  getCollegeOptions,
  type College,
} from "@/lib/colleges";
import {
  MOVEMENTS,
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
import {
  getNotificationsFor,
  markNotificationsSeen,
  type Notification,
} from "@/lib/notifications";
import { ordinal, timeAgo } from "@/lib/format";
import { plateFor } from "@/lib/plates";
import { weightClassFor } from "@/lib/scoring";
import { siteUrl } from "@/lib/site";
import { ShareButton } from "@/app/share";
import { CountUp } from "@/app/score";

type SearchParams = Promise<{ college?: string }>;

export default function MePage({ searchParams }: { searchParams: SearchParams }) {
  return (
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
    </main>
  );
}

async function Dashboard({ searchParams }: { searchParams: SearchParams }) {
  await connection();
  const session = await auth();
  const email = session?.user?.email;

  if (!email) {
    return (
      <div>
        <Link href="/?all" className={navButton}>
          <ChevronLeft />
          All colleges
        </Link>
        <div className="pt-8">
          <h1 className="text-[1.75rem] font-extrabold leading-none tracking-[-0.03em]">
            Sign in to add your lifts
          </h1>
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
        <Link href="/?all" className={navButton}>
          <ChevronLeft />
          All colleges
        </Link>
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
  const [lifts, card, globalCard, notifications, liftBoards] = await Promise.all([
    getLiftsFor(lifter.id),
    getRankFor(lifter.id, lifter.college.id).catch(() => null),
    getGlobalRankFor(lifter.id).catch(() => null),
    getNotificationsFor(lifter.id).catch(() => [] as Notification[]),
    getLiftBoards({ collegeId: lifter.college.id }).catch(() => null),
  ]);
  const standings = liftBoards ? standingsFor(liftBoards, lifter.id) : {};

  // Rendered once as "new", then they're just history. The write happens
  // after the response is sent, so it never slows the page.
  if (notifications.some((n) => !n.seen)) {
    after(() => markNotificationsSeen(lifter.id).catch(() => {}));
  }

  return (
    <LifterView
      lifter={lifter}
      college={lifter.college}
      lifts={lifts}
      card={card}
      globalCard={globalCard}
      notifications={notifications}
      standings={standings}
      editForm={
        // Collapsed by default and needs the 159-college list, so it
        // streams in behind the dashboard instead of holding it up.
        <Suspense fallback={<Bone className="h-11 w-full" />}>
          <EditProfile lifter={lifter} email={email} />
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
        detected ? { shortName: detected.shortName, name: detected.name } : null
      }
    />
  );
}

async function EditProfile({ lifter, email }: { lifter: Lifter; email: string }) {
  const collegeField = await buildCollegeField(email, lifter);
  return (
    <ProfileForm
      defaultName={lifter.displayName}
      defaultUsername={lifter.username}
      currentUsername={lifter.username}
      defaultBodyweight={lifter.bodyweightKg}
      submitLabel="Save profile"
      college={collegeField}
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
  notifications,
  standings,
  editForm,
}: {
  lifter: Lifter;
  college: College;
  lifts: Lift[];
  card: RankCard | null;
  globalCard: RankCard | null;
  notifications: Notification[];
  standings: Partial<Record<Movement, { rank: number; of: number }>>;
  editForm: React.ReactNode;
}) {
  const summary = summarise(lifts, lifter.bodyweightKg);
  const byMovement = new Map(lifts.map((l) => [l.movement, l]));
  const weightClass = weightClassFor(lifter.bodyweightKg);
  const plate = plateFor(weightClass);
  const unseen = notifications.filter((n) => !n.seen).length;

  return (
    <div>
      <Link href={`/c/${college.slug}`} className={navButton}>
        <ChevronLeft />
        {college.shortName} board
      </Link>

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
            <p className="tnum text-[4.5rem] font-extrabold leading-[0.85] tracking-[-0.045em]">
              <CountUp value={summary.dots} />
            </p>
            <p className="mt-3 text-[13px] text-chalk-dim">
              DOTS score
              <span className="tnum text-chalk-faint">
                {" "}
                · {summary.totalKg?.toFixed(0)} kg total
              </span>
            </p>

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

            {/*
              The global line is the reward for co-signing. Either you are
              on that board, or this says exactly what it takes to get there.
            */}
            {globalCard ? (
              <p className="mt-1.5 text-[13px] text-chalk-dim">
                <span className="tnum font-bold text-chalk">
                  #{globalCard.overallRank}
                </span>{" "}
                of {globalCard.totalLifters} across all colleges
              </p>
            ) : card ? (
              <p className="mt-1.5 text-[12px] text-chalk-faint">
                {3 - card.verifiedCount} more co-sign
                {3 - card.verifiedCount === 1 ? "" : "s"} and you are on the
                global board.
              </p>
            ) : null}

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

        <p className="mt-4 text-[14px] font-bold">
          {lifter.displayName}
          <span className="font-normal text-chalk-dim">
            {" "}
            · @{lifter.username} · {weightClass}
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

      {notifications.length > 0 && (
        <section className="rise pt-10" style={{ "--i": 1 } as React.CSSProperties}>
          <h2 className="flex items-center justify-between border-b border-rule pb-2 text-[13px] font-medium text-chalk-dim">
            Since you were last here
            {unseen > 0 && (
              <span className="rounded-sm bg-chalk px-1.5 text-[10px] font-bold uppercase text-iron">
                {unseen} new
              </span>
            )}
          </h2>
          <ol>
            {notifications.map((n) => (
              <li
                key={n.id}
                className="flex items-center gap-3 border-b border-rule py-2.5 text-[13px]"
              >
                <span
                  aria-hidden
                  className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                    n.seen ? "bg-rule" : "bg-chalk"
                  }`}
                />
                <span className={`min-w-0 flex-1 ${n.seen ? "text-chalk-dim" : ""}`}>
                  <NoticeText notice={n} />
                </span>
                <span className="tnum shrink-0 text-[11px] text-chalk-faint">
                  {timeAgo(n.createdAt)}
                </span>
              </li>
            ))}
          </ol>
        </section>
      )}

      <section className="rise pt-10" style={{ "--i": 2 } as React.CSSProperties}>
        <h2 className="border-b border-rule pb-2 text-[13px] font-medium text-chalk-dim">
          Your lifts
        </h2>

        <div>
          {MOVEMENTS.map((movement) => (
            <LiftRowForm
              key={movement.id}
              movement={movement}
              existing={byMovement.get(movement.id)}
              standing={standings[movement.id] ?? null}
              boardHref={`/c/${college.slug}?tab=${movement.id}`}
            />
          ))}
        </div>
      </section>

      <section className="rise pt-10" style={{ "--i": 3 } as React.CSSProperties}>
        <h2 className="border-b border-rule pb-2 text-[13px] font-medium text-chalk-dim">
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

      <details className="rise pt-8" style={{ "--i": 4 } as React.CSSProperties}>
        <summary className="press flex min-h-11 cursor-pointer list-none items-center justify-between rounded-sm border border-rule px-4 text-[15px] text-chalk-dim hover:border-chalk-faint hover:text-chalk">
          Edit profile
          <span aria-hidden className="text-chalk-faint">+</span>
        </summary>
        <div className="pt-5">{editForm}</div>
      </details>

      <SignOutForm className={quietButton} formClassName="pt-8" />

      <div className="mt-10 border-t border-rule pt-6">
        <DeleteAccountButton />
      </div>
      </div>
    </div>
  );
}

function NoticeText({ notice }: { notice: Notification }) {
  const who = notice.actorUsername ? (
    <Link
      href={`/u/${notice.actorUsername}`}
      className="font-bold text-chalk underline-offset-4 hover:underline"
    >
      {notice.actorName ?? "Someone"}
      <span className="font-normal text-chalk-dim"> @{notice.actorUsername}</span>
    </Link>
  ) : (
    <span className="font-bold text-chalk">Someone</span>
  );

  if (notice.kind === "cosign") {
    const label =
      MOVEMENTS.find((m) => m.id === notice.movement)?.label.toLowerCase() ??
      "a lift";
    return (
      <>
        <Check /> {who} co-signed your {label}
      </>
    );
  }
  return <>{who} passed you on the board</>;
}

const quietButton =
  "press inline-flex min-h-11 items-center rounded-sm border border-rule px-4 text-[15px] text-chalk-faint hover:border-chalk-faint hover:text-chalk";
