import Image from "next/image";
import { avatarSrc } from "@/lib/avatars";
import { initials } from "@/lib/format";

/*
  A lifter's disc, ringed in a colour: their weight-class plate on rows and
  pages, a medal on the podium. Inside, the cartoon avatar they picked
  (lib/avatars.ts), or their initials. Never a photo, so nobody's face is
  on a board they didn't choose. Decorative — the name always sits next
  to it.
*/
export function Avatar({
  name,
  ring,
  size = 36,
  avatar = null,
}: {
  name: string;
  ring: string;
  size?: number;
  avatar?: string | null;
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
      {avatar ? (
        // Small static SVGs: nothing for the image optimiser to do. The big
        // ones (podium, profile header) are above the fold; rows load lazily.
        <Image
          src={avatarSrc(avatar)}
          alt=""
          width={size}
          height={size}
          loading={size >= 48 ? "eager" : "lazy"}
          unoptimized
        />
      ) : (
        initials(name)
      )}
    </span>
  );
}
