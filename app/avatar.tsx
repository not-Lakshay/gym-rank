import { initials } from "@/lib/format";

/*
  A lifter's initials in a disc, ringed in a colour: their weight-class
  plate on rows and pages, a medal on the podium. Initials rather than
  photos, so nobody's face is on a board they didn't choose. Decorative —
  the name always sits next to it.
*/
export function Avatar({
  name,
  ring,
  size = 36,
}: {
  name: string;
  ring: string;
  size?: number;
}) {
  return (
    <span
      aria-hidden
      className="avatar"
      // --ring drives the border and its neon glow (.avatar in globals.css).
      style={
        {
          width: size,
          height: size,
          fontSize: Math.round(size * 0.36),
          "--ring": ring,
          borderWidth: size >= 48 ? 3 : 2,
        } as React.CSSProperties
      }
    >
      {initials(name)}
    </span>
  );
}
