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

## 2026-11-14 (evening) — CP2 + CP3: schema, scoring, leaderboard, launch prep

**Done:** schema and migrations, DOTS scoring with tests, profile and lift
entry, public leaderboard with SQL ranking, privacy/terms, Google OAuth
published. Build finished 10 days ahead of schedule.

### Build and deploy

- **`next dev` does not type-check the project. `next build` does.** Dev
  compiles only what you visit. Run `npm run build` before every push —
  three deploys failed in a row while localhost looked perfect.
- **A `0 / 1` next to a commit on GitHub means the deployment check
  failed.** The push succeeded, the build didn't, and the live site stays
  frozen on the last good build. Check it after pushing.
- `tsconfig`'s `include: ["**/*.ts"]` means `next build` type-checks files
  Next never bundles, like test scripts. Importing with an explicit `.ts`
  extension (which Node needs to run the file directly) requires
  `"allowImportingTsExtensions": true`.
- **Vercel shows two different URLs.** *Deployment* is unique per build and
  changes every push. *Domains* is the stable one. Only ever share the
  Domains URL — a friend got `redirect_uri_mismatch` from the other one.
- **Changing the site URL means updating Google in four places:**
  authorized JavaScript origins, authorized redirect URI, authorized
  domains, and the three Branding links. Miss one and sign-in breaks for
  everyone except you on localhost.
- Google OAuth settings take 5 minutes to a few hours to propagate. A
  `redirect_uri_mismatch` straight after a change is often just that —
  wait before changing anything else.

### Google OAuth publishing

- A Testing-mode app only lets manually-listed test users sign in. To go to
  Production, the Branding page needs a home page URL, a privacy policy URL,
  a terms URL and an authorized domain. **No privacy page means no public
  sign-in** — it's a blocker, not paperwork.
- `vercel.app` is rejected as an authorized domain: "must be a top private
  domain", because it's shared across everyone's projects. The full
  subdomain `<project>.vercel.app` is accepted. No custom domain needed.

### Code

- `create-next-app` sets `body { font-family: Arial }` while loading the
  real font into a CSS variable nothing uses. The whole app rendered in
  Arial for two days. Check the font you installed is actually applied.
- Tailwind has no `font-800` utility — weights are named (`font-extrabold`).
  A wrong utility class fails silently, which is worse than an error.
- **Postgres returns `numeric` columns as strings** to avoid float precision
  loss. `"110" + "90"` is `"11090"`. Every numeric read goes through a
  conversion helper.
- Next 16 server actions: `refresh()` from `next/cache` updates uncached
  data after a mutation. `revalidatePath` is for *cached* data — using it
  here would silently do nothing.
- The DOTS polynomial exists in both SQL (for ranking) and TypeScript (for
  display). Two copies of a formula drift, so
  `scripts/check-scoring-parity.mjs` asserts they agree.
- Tests assert against *published* DOTS results, not numbers this code
  produced. A test that only checks the code agrees with itself proves
  nothing. It caught Epley inflating a true 1-rep max by 3.3%.

### Decisions

- **Five ranked lifts, not eleven.** Machine lifts (lat pulldown, chest fly)
  aren't comparable between gyms or even between machines, and there's no
  normalization data to rank them against. Every extra lift also adds
  signup friction, which is the biggest drop-off point.
- **Weight class takes its Olympic plate colour** (10kg green, 15kg yellow,
  20kg blue, 25kg red), ascending the way a loaded bar reads. The colour
  carries information rather than decorating.
- Editing a lift clears its verification. A changed number is a new claim.
- Bodyweight is snapshotted onto each lift, so cutting or bulking later
  doesn't retroactively rewrite old scores.

### What this cost in time

The app was never the hard part. The build finished 10 days early; what
remains is getting real people to use it.

---

## 2026-11-14 (late) — design pass, first outside user

### Mobile

- **Touch targets need ~44px.** Plain text links read fine with a mouse and
  are fiddly with a thumb. Found this by opening the app on a phone, which
  is the only way it shows up.
- **iOS Safari zooms the whole page when you focus an input with a font
  size under 16px.** Every form field on a mobile-first app should be 16px.
- Text alone does not read as tappable on a phone. Navigation and account
  controls need a visible boundary — but not all the same weight, or you
  lose the hierarchy that marks the primary action.

### Verifying work

- **A tool reporting success is a claim, not evidence.** Three file writes
  this session reported "written" and didn't land. Each time the symptom
  looked like a deployment problem, and each time the change had never
  reached the disk. Check the file first, then the deploy.
- `git status` is the cheapest truth: if a change were really on disk there
  would be something to commit.
- `npm run build && git add -A && git commit -m "..." && git push` — the
  `&&` chain means a failing build can't be pushed.

### First outside user

Sarthak signed up and entered his lifts, and immediately exposed two things
being the only user had hidden:

1. The link shared was Vercel's *Deployment* URL, not the *Domains* URL, so
   Google returned `redirect_uri_mismatch`.
2. Changing the domain afterwards broke sign-in again until all four places
   in the Google config were updated.

He also beat me on the board with a total 57kg lighter than mine, which is
the bodyweight normalisation working exactly as intended — a raw-total board
would have told him the app wasn't for him.

**Lesson: every user before the first stranger is free debugging.**

---
