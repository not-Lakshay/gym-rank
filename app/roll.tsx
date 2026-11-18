/*
  A number that rolls into place like a scoreboard: each digit spins up
  through the reel and settles, left to right.

  CSS only, no client JavaScript. The real digits stay in the markup with a
  transparent fill, so they set the width and baseline and are what copy,
  paste and screen readers get; a reel of digits slides over each one
  (.roll-d in globals.css). Keyed by the text, so a new value — a save on
  /me — remounts it and rolls again.
*/
export function Roll({
  value,
  decimals = 1,
  delayMs = 0,
}: {
  value: number;
  decimals?: number;
  /** Stagger down a list. */
  delayMs?: number;
}) {
  const text = value.toFixed(decimals);
  return (
    <span key={text}>
      {Array.from(text).map((ch, i) =>
        /\d/.test(ch) ? (
          <span
            key={i}
            className="roll-d"
            style={
              { "--n": Number(ch), "--k": i, "--delay": `${delayMs}ms` } as React.CSSProperties
            }
          >
            {ch}
          </span>
        ) : (
          ch
        ),
      )}
    </span>
  );
}
