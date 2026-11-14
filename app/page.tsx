import { Suspense } from "react";
import { auth, signIn, signOut } from "@/auth";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-full w-full max-w-md flex-col gap-8 px-6 py-16">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight">Gym Rank</h1>
        <p className="text-sm text-black/60 dark:text-white/60">
          Bodyweight-adjusted lifting leaderboard for the LNMIIT gym.
        </p>
      </header>

      {/* Reads the session cookie, so it must sit behind a Suspense
          boundary — with cacheComponents enabled, reading cookies()
          outside one is a build error. */}
      <Suspense fallback={<p className="text-sm text-black/50">Checking sign-in…</p>}>
        <AuthPanel />
      </Suspense>
    </main>
  );
}

async function AuthPanel() {
  const session = await auth();

  if (!session?.user) {
    return (
      <form
        action={async () => {
          "use server";
          await signIn("google", { redirectTo: "/" });
        }}
      >
        <button
          type="submit"
          className="rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-opacity hover:opacity-85"
        >
          Sign in with Google
        </button>
      </form>
    );
  }

  return (
    <div className="flex flex-col items-start gap-4">
      <p className="text-sm">
        Signed in as <span className="font-medium">{session.user.email}</span>
      </p>
      <form
        action={async () => {
          "use server";
          await signOut({ redirectTo: "/" });
        }}
      >
        <button
          type="submit"
          className="rounded-full border border-black/15 px-5 py-2.5 text-sm font-medium transition-colors hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10"
        >
          Sign out
        </button>
      </form>
    </div>
  );
}
