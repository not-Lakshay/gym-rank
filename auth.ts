import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

// Reads AUTH_SECRET, AUTH_GOOGLE_ID and AUTH_GOOGLE_SECRET from the
// environment automatically — no need to pass them here.
export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [Google],
});
