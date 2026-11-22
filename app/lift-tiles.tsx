import { PLATES, platesPerSide } from "@/lib/plates";
import { TOTAL_MOVEMENTS, type Movement } from "@/lib/movements";
import { Roll } from "@/app/roll";

/*
  Squat, bench and deadlift at a glance, two ways. Each lift has its own
  colour (--lift-* in globals.css), the same on every page; gold marks a
  #1 title. CSS only, no client JavaScript.

  LiftTiles, on someone's profile: what they lifted. Breathing glow, a
  light sweep, the number rolls in, one side's plates stack up.

  GoalTiles, on your own page: how far you are. Each tile fills like a
  tank toward a bodyweight goal, with a slow wave on top.
*/

const LABEL: Record<Movement, string> = {
  squat: "Squat",
  bench: "Bench",
  deadlift: "Deadlift",
  overhead_press: "OHP",
  pullups: "Pull-ups",
};

const color = (m: Movement) => `var(--lift-${m})`;

type Lift = { weightKg: number | null; reps: number; est1rmKg?: number | null };

function TitleMark() {
  return <span className="font-extrabold text-[var(--gold)]">#1</span>;
}

export function LiftTiles({
  lifts,
  titles,
}: {
  lifts: Map<string, Lift>;
  titles: Movement[];
}) {
  if (!TOTAL_MOVEMENTS.some((m) => lifts.get(m)?.weightKg)) return null;
  return (
    <div className="grid grid-cols-3 gap-2">
      {TOTAL_MOVEMENTS.map((m, i) => {
        const lift = lifts.get(m);
        const kg = lift?.weightKg ?? null;
        const plates = kg === null ? [] : platesPerSide(kg).slice(0, 8);
        const isTitle = titles.includes(m);
        return (
          <div
            key={m}
            className={`lift-tile rounded-sm bg-iron-raised px-2 pt-3 pb-2.5 text-center ${isTitle ? "is-title" : ""}`}
            style={{ "--tile": color(m), "--d": `${i * 1.3}s` } as React.CSSProperties}
          >
            <p className="caption flex items-center justify-center gap-1">
              {LABEL[m]}
              {isTitle && <TitleMark />}
            </p>
            <p className="tnum mt-1.5 text-[2rem] font-extrabold leading-none tracking-[-0.04em] text-chalk">
              {kg === null ? "—" : <Roll value={kg} decimals={Number.isInteger(kg) ? 0 : 1} delayMs={i * 150} />}
            </p>
            <p className="tnum mt-1 text-[12px] text-chalk-dim">
              {lift && kg !== null ? `kg × ${lift.reps}` : "not entered"}
            </p>
            <span aria-hidden className="mt-2 flex h-4 items-end justify-center gap-[2px]">
              {plates.map((weight, j) => {
                const spec = PLATES.find((p) => p.kg === weight)!;
                return (
                  <span
                    key={j}
                    className="tile-plate"
                    style={{
                      width: spec.width - 1,
                      height: `${spec.height * 100}%`,
                      background: spec.color,
                      animationDelay: `${300 + i * 150 + j * 80}ms`,
                    }}
                  />
                );
              })}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/**
 * Bodyweight multiples for a 1RM that's strong for a college lifter: a
 * target to fill toward, not a judgement. shortcut: one set for everyone,
 * not split by sex; split it if the tiles start to feel unfair.
 */
export const GOAL_X_BW: Partial<Record<Movement, number>> = {
  squat: 2,
  bench: 1.5,
  deadlift: 2.5,
};

export function GoalTiles({
  lifts,
  titles,
  bodyweightKg,
}: {
  lifts: Map<string, Lift>;
  titles: Movement[];
  bodyweightKg: number;
}) {
  if (!TOTAL_MOVEMENTS.some((m) => lifts.get(m)?.est1rmKg)) return null;
  return (
    <div className="grid grid-cols-3 gap-2">
      {TOTAL_MOVEMENTS.map((m, i) => {
        const est = lifts.get(m)?.est1rmKg ?? null;
        const goal = GOAL_X_BW[m]!;
        const ratio = est === null ? 0 : est / bodyweightKg;
        const fill = Math.min(ratio / goal, 1);
        const isTitle = titles.includes(m);
        return (
          <div
            key={m}
            className={`goal-tile rounded-sm bg-iron-raised px-2 pt-3 pb-2.5 text-center ${isTitle ? "is-title" : ""}`}
            style={
              { "--tile": color(m), "--fill": fill, "--d": `${i * 160}ms` } as React.CSSProperties
            }
          >
            <span aria-hidden className="goal-fill">
              <svg className="goal-wave" viewBox="0 0 200 10" preserveAspectRatio="none">
                <path d="M0 5 Q25 0 50 5 T100 5 T150 5 T200 5 V10 H0Z" />
              </svg>
            </span>
            <p className="caption relative flex items-center justify-center gap-1">
              {LABEL[m]}
              {isTitle && <TitleMark />}
            </p>
            <p className="goal-num tnum relative mt-1.5 text-[2rem] font-extrabold leading-none tracking-[-0.04em] text-chalk">
              {est === null ? "—" : Number(est.toFixed(1))}
            </p>
            <p className="tnum relative mt-1 text-[12px] text-chalk-dim">
              {est === null ? "not entered" : "kg est. 1RM"}
            </p>
            <p className="tnum relative mt-1.5 text-[10px] font-bold text-chalk">
              {est === null ? "" : `${ratio.toFixed(2)}× / ${goal}× BW${fill >= 1 ? " ✓" : ""}`}
            </p>
          </div>
        );
      })}
    </div>
  );
}
