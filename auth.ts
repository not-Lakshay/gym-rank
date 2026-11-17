import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

// Reads AUTH_SECRET, AUTH_GOOGLE_ID and AUTH_GOOGLE_SECRET from the
// environment automatically — no need to pass them here.
export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [Google],
  // The built-in error page says "Server error" for any failed callback.
  // The usual one is harmless: a phone or in-app browser loading Google's
  // one-time return link twice, after the first load already signed them
  // in. /me shows the dashboard if they're in, or the button and a retry
  // note if not. Real misconfigurations still log as [auth][error].
  pages: { error: "/me" },
});
