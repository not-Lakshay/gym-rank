import { Suspense } from "react";
import { notFound, permanentRedirect } from "next/navigation";
import { connection } from "next/server";
import { getLifterById } from "@/lib/lifters";

/*
  The old address of a lifter's page. Every link shared before usernames
  existed points here, and a link in a WhatsApp group from last month must
  keep working — so this resolves the id and sends the browser (and the
  link previewers) to /u/<username> for good.
*/
// The lookup sits inside Suspense, as on every other page: with Cache
// Components the page shell has to prerender without touching the request.
export default function LegacyLifterPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense fallback={null}>
      <Redirector params={params} />
    </Suspense>
  );
}

// Explicitly a component: the body never returns, so TS would otherwise
// infer Promise<never> and refuse to render it as JSX.
async function Redirector({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<React.ReactNode> {
  await connection();
  const { id } = await params;
  const lifter = await getLifterById(id).catch(() => null);
  if (!lifter) notFound();
  permanentRedirect(`/u/${lifter.username}`);
}
