import { PLATES, platesPerSide } from "@/lib/plates";
import { TOTAL_MOVEMENTS, type Movement } from "@/lib/movements";
import { Roll } from "@/app/roll";

/*
  Squat, bench and deadlift at a glance, above the lift rows. Each tile is
  lit in the colour of the heaviest plate on the bar, breathes slowly, and
  catches a light sweep now and then; the number rolls in and one side's
  plates stack up underneath. CSS only (.lift-tile in globals.css).
*/

const LABEL: Record<Movement, string> = {
  squat: "Squat",
  bench: "Bench",
  deadlift: "Deadlift",
  overhead_press: "OHP",
  pullups: "Pull-ups",
};

type Lift = { weightKg: number | null; reps: number };

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
        const top = PLATES.find((p) => p.kg === plates[0]);
        const isTitle = titles.includes(m);
        const tile = isTitle ? "var(--gold)" : (top?.color ?? "var(--chalk-faint)");
        return (
          <div
            key={m}
            className="lift-tile rounded-sm bg-iron-raised px-2 pt-3 pb-2.5 text-center"
            style={{ "--tile": tile, "--d": `${i * 1.3}s` } as React.CSSProperties}
          >
            <p className="caption flex items-center justify-center gap-1">
              {LABEL[m]}
              {isTitle && <span className="font-extrabold text-[var(--gold)]">#1</span>}
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
