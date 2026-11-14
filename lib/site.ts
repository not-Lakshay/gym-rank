/**
 * The canonical origin, used for metadataBase and for any link that has to
 * work after it leaves the app (a shared URL, an OG image reference).
 *
 * Relative URLs are fine inside the app but useless in a WhatsApp message,
 * so share links are built absolute from here. Override in .env.local when
 * the deployment domain changes.
 */
export const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://lnmgymrank.vercel.app";

/** The same origin without the scheme — for printing on the card itself. */
export const siteLabel = siteUrl.replace(/^https?:\/\//, "");
