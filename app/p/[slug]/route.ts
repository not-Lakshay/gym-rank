import { redirect } from "next/navigation";
import { recordEvent } from "@/lib/lifters";

/*
  Where the printed poster's QR code points (app/poster). Counts the scan,
  then sends the phone to that college's board. A route of its own, not a
  ?ref= on the board, so the board stays cacheable and the code stays short
  (fewer modules, easier to scan from a distance).
*/
export async function GET(_req: Request, { params }: RouteContext<"/p/[slug]">) {
  const { slug } = await params;
  const safe = /^[a-z0-9-]{1,40}$/.test(slug) ? slug : "";
  if (safe) await recordEvent(`poster_scan:${safe}`);
  redirect(safe ? `/c/${safe}` : "/");
}
