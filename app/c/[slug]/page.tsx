import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { auth } from "@/auth";
import { getCollegeBySlug, type College } from "@/lib/colleges";
import { getLeaderboard } from "@/lib/leaderboard";
import { getLifterByEmail } from "@/lib/lifters";
import { plateFor } from "@/lib/plates";
import { WEIGHT_CLASSES } from "@/lib/scoring";
import {
  Board,
  ChevronLeft,
  Footer,
  MIN_CLASS_SIZE,
  Stats,
  button,
  navButton,
  shortClass,
} from "@/app/board";
import { Calculator } from "@/app/calculator";
import { SignInForm } from "@/app/sign-in";

type Params = Promise<{ slug: string }>;

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { slug } = await params;
  const college = await getCollegeBySlug(slug).catch(() => null);
  if (!college) return { title: "Gym Rank" };
  const title = `${college.shortName} — Gym Rank`;
  const description = `The ${college.shortName} gym leaderboard, every score adjusted for bodyweight.`;
  return {
    title,
    description,
    openGraph: { title, description },
    twitter: { title, description },
  };
}

/*
  One college's board — the page the project started as. Everything on it
  is scoped to the college in the URL: the ranks, the class boards, the
  calculator's projected rank, and where "Add yours" sends you.
*/
// `params` is awaited inside the Suspense boundary, not here: with Cache
// Components, reading it in the page shell blocks prerendering of the shell.
export default function CollegePage({ params }: { params: Params }) {
  return (
    <main className="mx-auto w-full max-w-md px-5 pb-16 pt-10">
      <Suspense
        fallback={<p className="pt-2 text-sm text-chalk-faint">Loading board</p>}
      >
        <CollegeBoard params={params} />
      </Suspense>
      <Footer />
    </main>
  );
}

async function CollegeBoard({ params }: { params: Params }) {
  await connection();
  const { slug } = await params;
  const college = await getCollegeBySlug(slug).catch(() => null);
  if (!college) notFound();

  const [rows, session] = await Promise.all([
    getLeaderboard({ collegeId: college.id }),
    auth(),
  ]);

  // Which row is yours. On a board of forty names, finding yourself is the
  // thing people do first and it should not require reading.
  const viewer = session?.user?.email
    ? await getLifterByEmail(session.user.email).catch(() => null)
    : null;

  // Sign-in from this page lands on /me with this college preselected, so
  // a friend who was sent the IIT Delhi link ends up on IIT Delhi's board.
  const redirectTo = `/me?college=${college.slug}`;
  const accountLink = session?.user ? (
    <Link href="/me" className={button}>
      Your lifts
    </Link>
  ) : (
    <SignInForm redirectTo={redirectTo} label="Add yours" className={button} />
  );

  const calculator = session?.user ? null : (
    <Calculator
      boardDots={rows.map((r) => r.dots)}
      signInForm={
        <SignInForm redirectTo={redirectTo} label="Save it" className={button} />
      }
    />
  );

  return (
    <div>
      <Header college={college} accountLink={accountLink} />

      {rows.length === 0 ? (
        <section className="rise pt-8" style={{ "--i": 1 } as React.CSSProperties}>
          <p className="text-[15px] font-medium">
            Nobody at {college.shortName} is on the board yet.
          </p>
          <p className="mt-1.5 text-[13px] leading-relaxed text-chalk-dim">
            A score needs a squat, a bench and a deadlift. Enter all three and
            you are first by default — then send the link to the gym group.
          </p>
          {calculator}
        </section>
      ) : (
        <div className="pt-6">
          <div className="rise mb-6" style={{ "--i": 1 } as React.CSSProperties}>
            <Stats rows={rows} />
          </div>

          <div className="rise" style={{ "--i": 2 } as React.CSSProperties}>
            <Board
              heading="Everyone"
              rows={rows}
              rankOf={(r) => r.overallRank}
              viewerId={viewer?.id ?? null}
              medals
            />
          </div>

          <div className="rise" style={{ "--i": 3 } as React.CSSProperties}>
            {calculator}
          </div>

          <div className="mt-10 flex flex-col gap-8">
            {WEIGHT_CLASSES.map((weightClass, i) => {
              const inClass = rows.filter(
                (r) => r.weightClass === weightClass.label,
              );
              if (inClass.length < MIN_CLASS_SIZE) return null;
              return (
                <div
                  key={weightClass.label}
                  className="rise"
                  style={{ "--i": 4 + i } as React.CSSProperties}
                >
                  <Board
                    heading={weightClass.label}
                    plate={plateFor(weightClass.label)}
                    rows={inClass}
                    rankOf={(r) => r.classRank}
                    viewerId={viewer?.id ?? null}
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function Header({
  college,
  accountLink,
}: {
  college: College;
  accountLink: React.ReactNode;
}) {
  return (
    <header className="rise pb-5" style={{ "--i": 0 } as React.CSSProperties}>
      <Link href="/" className={navButton}>
        <ChevronLeft />
        All colleges
      </Link>
      <div className="mt-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[2.25rem] font-extrabold leading-[0.9] tracking-[-0.04em]">
            {college.shortName}
          </h1>
          <p className="mt-2.5 text-[16px] font-bold leading-none tracking-[-0.02em]">
            Pound for pound.
          </p>
          <p className="mt-2 text-[13px] leading-snug text-chalk-dim">
            {college.city} · every score adjusted for bodyweight
          </p>
        </div>
        {accountLink}
      </div>

      {/*
        The weight classes, each in its plate colour. The same colour
        marks every lifter's row below, so this is the legend for the
        whole board rather than a rule.
      */}
      <ul className="mt-5 flex gap-1.5 text-[11px] font-medium text-chalk-dim">
        {WEIGHT_CLASSES.map((weightClass) => (
          <li key={weightClass.label} className="flex flex-1 flex-col gap-1.5">
            <span
              aria-hidden
              className="h-1 rounded-full"
              style={{ background: plateFor(weightClass.label) }}
            />
            <span className="tnum whitespace-nowrap">
              {shortClass(weightClass.label)}
            </span>
          </li>
        ))}
      </ul>
    </header>
  );
}
