# Build notes — Gym Rank

Running log of things that cost me time or surprised me while building this.
Source material for the README case study at the end.

Rules for this file:
- Log what cost time or was unexpected — not syntax I can look up.
- Never put secrets here (connection strings, API keys, OAuth secrets).
  Those live in `.env` only, which `.gitignore` excludes.

---

## 2026-11-14 — CP1: project setup + deployment pipeline

**Goal:** a live URL that does nothing but prove the pipeline works.
Done: Next.js project → GitHub → Vercel, auto-deploying on every push.

- `Ctrl+Shift+R` = hard refresh (bypasses the browser cache). A normal
  refresh can serve stale files and make a working deploy look broken.
- React hydration mismatch errors can come from a **Chrome extension**
  injecting attributes into `<html>`, not from my code. The `-` lines in
  the error show server HTML vs browser HTML — read that diff first.
  Confirm by loading the page in incognito (extensions off by default).
- **Deploy to production before writing any features.** Env vars, build
  config and OAuth redirect URLs only misbehave in production, never on
  localhost. Deploying an empty app first means every later failure is
  caused by the one thing I just changed.
- When testing a change, make it **unmistakable** (`TEST 123` replacing a
  whole line), not a few words inserted mid-sentence. Cost me 10 minutes
  thinking a working deploy was broken.
- `gh` CLI is not installed by default on Windows. Plain `git` plus
  creating the repo on github.com works fine:
  `git remote add origin <url>` then `git push -u origin main`.
- When creating the GitHub repo, leave README / .gitignore / license
  **unticked**. Otherwise the remote gets its own first commit with no
  shared history and the push fails with "refusing to merge unrelated
  histories".
- `create-next-app` defaults the branch to `master`; `git branch -M main`
  renames it.
- The terminal running `npm run dev` is occupied. Open a second tab for
  git commands instead of killing the server.

**Decision:** Postgres, not MongoDB (which I know better). The core
feature is ranking — ordering, partitioning by weight class, percentiles
— which SQL window functions do in one query and Mongo makes awkward.

---

## 2026-11-14 — CP1 cont.: Neon Postgres wired up

**Done:** Neon Postgres (Singapore) connected from both localhost and
production, verified by a temporary `/api/db-test` endpoint.

- **Env files are only read when the dev server starts.** Editing
  `.env.local` while `npm run dev` is running changes nothing until you
  stop and restart it.
- **Vercel env vars only apply to deployments created after you add
  them.** Add the variable first, then push. Push first and you have to
  go back and redeploy manually.
- **A 404 immediately after pushing usually means the build is still
  running**, not that something is broken. Vercel takes 60-90s from push
  to live. Check GitHub first: if the commit is there, just wait.
- Used the **pooled** Neon connection string (hostname contains
  `-pooler`) with `@neondatabase/serverless`, which talks over HTTP
  instead of holding a TCP connection. On Vercel every request is a
  separate short-lived function, so the normal `pg` driver would open a
  connection per invocation and exhaust the connection limit.
- **Database region matters.** Picked AWS Asia Pacific 1 (Singapore),
  ~60-80ms from India. The default US West would have added 250ms+ to
  every single query, and the leaderboard page will make several.
- Windows: **Notepad silently appends `.txt` to new files**, so
  `.env.local` created that way becomes `.env.local.txt` and Next.js
  ignores it. Create the file with `New-Item` first, then open it.
- Don't type a secret into a shell command — PowerShell saves command
  history to disk. Paste it into the file in an editor instead.
- Verified `.gitignore` covers `.env*` by checking `git status` doesn't
  list `.env.local`. Worth doing before the first push, not after.

**TODO before launch:** delete `app/api/db-test/`. It publicly reports
the Postgres version, which is free reconnaissance for anyone probing
the site.

---
