import { ChevronLeft, Footer, navButton } from "@/app/board";
import { BackButton } from "@/app/back-button";
import { TrustLevels } from "@/app/help";
import { TabBar } from "@/app/tab-bar";

export const metadata = {
  title: "How scoring works — Gym Rank",
  description:
    "DOTS, Epley one-rep max estimation, and why raw totals are not comparable across bodyweights.",
};

/*
  The one page on the site that explains itself. People distrust a number
  they can't reconstruct, and a leaderboard nobody trusts is just a list —
  so the formula, the fitted range and the exclusions are all stated rather
  than hidden behind "score".
*/
export default function ScoringPage() {
  return (
    <>
    <main className="mx-auto w-full max-w-md px-5 pb-16 pt-10">

      <BackButton className={`${navButton} w-fit`}>
        <ChevronLeft />
        Back
      </BackButton>

      <h1 className="pt-8 text-[1.75rem] font-extrabold leading-none tracking-[-0.03em]">
        How scoring works
      </h1>
      <p className="mt-3 text-[13px] leading-relaxed text-chalk-dim">
        If you weigh more, you lift more. Raw totals can&rsquo;t be compared
        across people, so the board scores on DOTS.
      </p>

      <Section title="From reps to a one-rep max">
        <p className={body}>
          Each entry is converted to an estimated one-rep max with the Epley
          formula.
        </p>
        <Formula>1RM = w &times; (1 + r / 30)</Formula>
        <p className={body}>
          <span className="text-chalk">w</span> is the weight lifted in kg,{" "}
          <span className="text-chalk">r</span> is the reps completed. 100 kg
          for 5 gives an estimated single of 116.7 kg.
        </p>
        <p className={body}>
          A true single is taken as entered. Epley is fitted to multi-rep sets
          and would inflate a genuine single by about 3%.
        </p>
      </Section>

      <Section title="From a total to a score">
        <p className={body}>
          Squat, bench and deadlift one-rep maxes are summed into a total.
          DOTS divides that total by a fourth-order polynomial in bodyweight,
          fitted to competition results, which estimates what a typical lifter
          of that size totals.
        </p>
        <Formula>
          DOTS = total &times; 500 / (a + bx + cx&sup2; + dx&sup3; +
          ex&#8308;)
          <span className="mt-1 block text-chalk-faint">
            x = bodyweight in kg
          </span>
        </Formula>
        <p className={body}>
          <span className="text-chalk">a</span> to{" "}
          <span className="text-chalk">e</span> are fixed constants, the same
          for every lifter — the coefficients that make the curve pass through
          the middle of real competition results. These are the men&rsquo;s
          values, which is what this board uses.
        </p>
        <Formula>
          a = &minus;307.75076
          <span className="block">b = 24.0900756</span>
          <span className="block">c = &minus;0.1918759221</span>
          <span className="block">d = 0.0007391293</span>
          <span className="block">e = &minus;0.000001093</span>
        </Formula>
        <p className={body}>
          So your score is your total as a proportion of expectation.
          Bodyweight is clamped to 40&ndash;201.9 kg, the range the curve was
          fitted over; outside it the polynomial stops behaving.
        </p>
      </Section>

      <Section title="What the number means">
        <p className={body}>
          Two lifters with equal DOTS are equally strong for their size.
        </p>
        <div className="mt-3 border-y border-rule">
          <Example total="400 kg" bodyweight="60 kg" dots="337.6" />
          <Example total="550 kg" bodyweight="100 kg" dots="338.5" />
        </div>
        <p className={body}>
          150 kg apart on the bar, level once size is accounted for.
        </p>
      </Section>

      <Section title="What doesn't count">
        <p className={body}>
          Overhead press and pull-ups are shown on your page but don&rsquo;t
          enter the score. DOTS is defined on the big three only.
        </p>
        <p className={body}>
          Numbers are self-reported. &ldquo;Co-signed&rdquo; means another
          lifter on the board watched the set and vouched for it from your
          page.
        </p>
      </Section>

      <Section title="Trust badges">
        <p className={body}>
          <TrustLevels />
        </p>
      </Section>

      <Section title="Why DOTS">
        <p className={body}>
          DOTS is a 2019 refit of the older Wilks formula, which skewed
          against the lightest and heaviest lifters. Dividing a total by
          bodyweight instead would over-correct in the other direction, since
          strength scales slower than mass.
        </p>
      </Section>
      <Footer />
    </main>
    <TabBar />
    </>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="pt-10">
      <h2 className="border-b border-rule pb-2 caption">
        {title}
      </h2>
      <div className="pt-3">{children}</div>
    </section>
  );
}

function Formula({ children }: { children: React.ReactNode }) {
  return (
    <p className="tnum my-3 rounded-sm border border-rule bg-iron-raised px-4 py-3 font-mono text-[12px] leading-relaxed text-chalk">
      {children}
    </p>
  );
}

function Example({
  total,
  bodyweight,
  dots,
}: {
  total: string;
  bodyweight: string;
  dots: string;
}) {
  return (
    <div className="flex items-baseline justify-between py-2.5 [&+&]:border-t [&+&]:border-rule">
      <p className="tnum text-[13px] text-chalk-dim">
        <span className="font-medium text-chalk">{total}</span> at {bodyweight}
      </p>
      <p className="tnum text-[15px] font-bold">{dots}</p>
    </div>
  );
}

const body = "mt-3 text-[13px] leading-relaxed text-chalk-dim first:mt-0";


