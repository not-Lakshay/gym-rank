import { PLATES, platesPerSide } from "@/lib/plates";

/*
  The set as it was loaded: a 20 kg bar with the plates for one side drawn
  on both, in their competition colours. They slide on innermost first,
  the way you'd load it. A sleeve holds about eight plates; anything
  heavier is drawn with eight.
*/
export function Barbell({ kg, delayMs = 0 }: { kg: number; delayMs?: number }) {
  const plates = platesPerSide(kg)
    .slice(0, 8)
    .map((weight, i) => {
      const spec = PLATES.find((p) => p.kg === weight)!;
      return (
        <span
          key={i}
          className="plate"
          style={{
            width: spec.width,
            height: `${spec.height * 100}%`,
            background: spec.color,
            color: spec.color, // the glow's colour (.plate)
            animationDelay: `${delayMs + i * 90}ms`,
          }}
        />
      );
    });

  return (
    <span role="img" aria-label={`${kg} kg on the bar`} className="barbell">
      <span className="barbell-end" />
      <span className="barbell-side barbell-left">{plates}</span>
      <span className="barbell-collar" />
      <span className="barbell-shaft" />
      <span className="barbell-collar" />
      <span className="barbell-side barbell-right">{plates}</span>
      <span className="barbell-end" />
    </span>
  );
}
