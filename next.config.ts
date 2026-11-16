import type { NextConfig } from "next";

/*
  Hardening headers on every response. Vercel already sends HSTS. These
  stop the page being framed (clickjacking), stop MIME sniffing, keep the
  referrer to the origin, and switch off browser features the app never
  uses. A full Content-Security-Policy is deliberately not here: Next's
  streaming inserts inline scripts that need a per-request nonce, which
  is a project of its own; frame-ancestors is the one CSP directive that
  matters here and is safe to set alone.
*/
const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  },
];

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  poweredByHeader: false,
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
