import { auth } from "@/auth";

/*
  Who may open /admin.

  There is no admin password. Admin is "signed in with Google, and the
  email is on ADMIN_EMAILS" — a comma-separated env var on Vercel. That
  reuses Google's sign-in and 2FA instead of adding a second login to
  defend, and adding a co-admin is adding an email. Unset, nobody is
  admin, which is the safe failure.
*/
export function adminEmails(): Set<string> {
  return new Set(
    (process.env.ADMIN_EMAILS ?? "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  );
}

export function isAdminEmail(email: string | null | undefined): boolean {
  return !!email && adminEmails().has(email.toLowerCase());
}

/** The signed-in admin's email, or null. Every admin action starts here. */
export async function currentAdmin(): Promise<string | null> {
  const session = await auth();
  const email = session?.user?.email ?? null;
  return isAdminEmail(email) ? email : null;
}
