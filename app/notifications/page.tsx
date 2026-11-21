import { Suspense } from "react";
import Link from "next/link";
import { after, connection } from "next/server";
import { auth } from "@/auth";
import { timeAgo } from "@/lib/format";
import { getLifterByEmail } from "@/lib/lifters";
import { MOVEMENTS } from "@/lib/movements";
import {
  getNotificationsFor,
  markNotificationsSeen,
  type Notification,
} from "@/lib/notifications";
import { Bone, ChevronLeft, Footer, button, navButton } from "@/app/board";
import { SignInForm } from "@/app/sign-in";
import { TabBar } from "@/app/tab-bar";

export const metadata = { title: "Notifications — Gym Rank", robots: { index: false } };

/*
  What happened to you while you were away: co-signs, doubts, and anyone
  who passed your score. Opened from the bell on /me; reading the page
  marks everything seen, after the response is sent.
*/
export default function NotificationsPage() {
  return (
    <>
      <main className="mx-auto w-full max-w-md px-5 pb-16 pt-10">
        <Link href="/me" className={navButton}>
          <ChevronLeft />
          You
        </Link>
        <header className="rise pb-6 pt-8" style={{ "--i": 0 } as React.CSSProperties}>
          <h1 className="text-[2.25rem] font-extrabold leading-[0.9] tracking-[-0.04em]">
            Notifications
          </h1>
          <p className="mt-2.5 text-[14px] leading-snug text-chalk-dim">
            Co-signs, doubts, and anyone who passes your score.
          </p>
        </header>
        <Suspense
          fallback={
            <div role="status" aria-label="Loading">
              {[0, 1, 2].map((i) => (
                <Bone key={i} className="mb-2 h-16 w-full" />
              ))}
            </div>
          }
        >
          <Alerts />
        </Suspense>
        <Footer />
      </main>
      <TabBar active="you" />
    </>
  );
}

async function Alerts() {
  await connection();
  const email = (await auth())?.user?.email;

  if (!email) {
    return (
      <Empty text="Sign in to hear when someone co-signs your lift, doubts it, or passes your score.">
        <SignInForm redirectTo="/notifications" label="Sign in" className={button} />
      </Empty>
    );
  }

  const lifter = await getLifterByEmail(email);
  if (!lifter) {
    return (
      <Empty text="Set up your profile and add a lift. Notifications start once you&apos;re on a board.">
        <Link href="/me" className={button}>
          Set up profile
        </Link>
      </Empty>
    );
  }

  const notifications = await getNotificationsFor(lifter.id, 30).catch(
    () => [] as Notification[],
  );
  if (notifications.some((n) => !n.seen)) {
    after(() => markNotificationsSeen(lifter.id).catch(() => {}));
  }

  if (notifications.length === 0) {
    return (
      <Empty text="Nothing yet. Get a gym-mate to co-sign a lift and it'll show up here." />
    );
  }

  const fresh = notifications.filter((n) => !n.seen);
  const earlier = notifications.filter((n) => n.seen);

  return (
    <div className="rise" style={{ "--i": 1 } as React.CSSProperties}>
      {fresh.length > 0 && <Group title="New" items={fresh} />}
      {earlier.length > 0 && <Group title="Earlier" items={earlier} />}
      <p className="pt-4 text-[12px] text-chalk-faint">Notifications from the last 30 days.</p>
    </div>
  );
}

function Empty({ text, children }: { text: string; children?: React.ReactNode }) {
  return (
    <div className="rise flex flex-col items-start gap-4 rounded-sm border border-rule bg-iron-raised p-5" style={{ "--i": 1 } as React.CSSProperties}>
      <p className="text-[14px] leading-relaxed text-chalk-dim">{text}</p>
      {children}
    </div>
  );
}

function Group({ title, items }: { title: string; items: Notification[] }) {
  return (
    <section className="pb-6">
      <h2 className="caption pb-2">{title}</h2>
      <ol className="flex flex-col gap-2">
        {items.map((n) => (
          <li
            key={n.id}
            className={`flex items-start gap-3 rounded-sm border p-3 text-[14px] leading-snug ${
              n.seen ? "border-rule" : "border-chalk-faint bg-iron-raised"
            }`}
          >
            <KindIcon kind={n.kind} />
            <span className={`min-w-0 flex-1 pt-1 ${n.seen ? "text-chalk-dim" : "text-chalk"}`}>
              <NoticeText notice={n} />
            </span>
            <span className="tnum shrink-0 pt-1 text-[11px] text-chalk-faint">
              {timeAgo(n.createdAt)}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}

const KIND_STYLE: Record<Notification["kind"], { color: string; path: React.ReactNode }> = {
  cosign: { color: "var(--success)", path: <path d="m5 12.5 4.5 4.5L19 7.5" /> },
  doubt: {
    color: "var(--danger)",
    path: <path d="M5 21V4m0 0h11l-2 4 2 4H5" />,
  },
  passed: {
    color: "var(--accent)",
    path: <path d="M12 19V5m0 0-6 6m6-6 6 6" />,
  },
};

function KindIcon({ kind }: { kind: Notification["kind"] }) {
  const { color, path } = KIND_STYLE[kind];
  return (
    <span
      aria-hidden
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
      style={{
        color,
        background: `color-mix(in oklab, ${color} 16%, transparent)`,
      }}
    >
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        {path}
      </svg>
    </span>
  );
}

function NoticeText({ notice }: { notice: Notification }) {
  const who = notice.actorUsername ? (
    <Link
      href={`/u/${notice.actorUsername}`}
      className="font-bold text-chalk underline-offset-4 hover:underline"
    >
      {notice.actorName ?? "Someone"}
    </Link>
  ) : (
    <span className="font-bold text-chalk">Someone</span>
  );
  const label =
    MOVEMENTS.find((m) => m.id === notice.movement)?.label.toLowerCase() ?? "a lift";

  if (notice.kind === "cosign") return <>{who} co-signed your {label}.</>;
  if (notice.kind === "doubt") {
    return <>A gym-mate doubted your {label}. Keep more co-signs than doubts on it.</>;
  }
  return <>{who} passed your score on the board.</>;
}
