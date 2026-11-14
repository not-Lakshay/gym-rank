# Gym Rank

A bodyweight-adjusted lifting leaderboard for the LNMIIT Jaipur campus gym.

**Live:** https://lnmgymrank.vercel.app

Lifters enter a working set for each of five movements. The app estimates a
one-rep max, adjusts the squat/bench/deadlift total for bodyweight using
DOTS, and ranks everyone — overall and within weight classes — so a 60kg
lifter and a 90kg lifter can be compared fairly.

Built as a student project. Not affiliated with or endorsed by LNMIIT.

---

## Why it exists

Gym leaderboards are usually raw totals, which means the heaviest person
always wins and everyone else stops caring. The interesting question in a
college gym isn't who lifts the most — it's who is strongest *for their
size*. That's a scoring problem, and it's the core of the app.

---

## Stack

| | |
|---|---|
| Framework | Next.js 16 (App Router, Cache Components) |
| Language | TypeScript |
| Database | Postgres (Neon, serverless driver over HTTP) |
| Auth | Auth.js v5, Google OAuth |
| Styling | Tailwind CSS v4 |
| Hosting | Vercel, continuous deployment from `main` |

---

## Decisions worth explaining

### Postgres, not MongoDB

I'm more comfortable with Mongo, but the core feature is ranking — ordering,
partitioning by weight class, percentile position. That's one SQL query with
window functions and an awkward application-level sort in Mongo.

```sql
rank() over (order by dots desc)                            as overall_rank,
rank() over (partition by weight_class order by dots desc)  as class_rank
```

One query returns every lifter with both their overall standing and their
standing within their class.

### DOTS, not raw totals or Wilks

DOTS is the bodyweight-adjustment formula powerlifting federations moved to
after Wilks, which was shown to drift at the extremes. The published
coefficients are verified in `lib/scoring.test.ts` against worked examples
from outside this codebase — a test that only checks the code agrees with
itself proves nothing.

The formula lives in two places: TypeScript for display, SQL for ranking.
Two copies of a formula drift, so `scripts/check-scoring-parity.mjs` asserts
they agree to within 1e-9, including at the bodyweight clamp boundaries.

### Weight × reps, not a one-rep max

Almost nobody in a college gym has tested a true single, and the ones who
guess, guess high. The app asks for a real working set and estimates the 1RM
with Epley, capping at 12 reps because past that a set measures conditioning
rather than maximal strength. A 1-rep entry is special-cased — Epley would
otherwise inflate a true single by 3.3%.

### Five movements, not eleven

Machine lifts (lat pulldown, chest fly) aren't comparable between gyms or
even between machines, and there's no reference data to normalise them
against. Every additional field also adds signup friction, which is the
largest drop-off point in the funnel. Squat, bench, deadlift, overhead press
and pull-ups.

### Bodyweight is snapshotted per lift

Stored on each `lifts` row rather than read from the lifter's current
profile, so someone cutting from 90kg to 80kg doesn't retroactively rewrite
their old scores.

### Verification is a column, not a feature

Every number is self-reported, and a leaderboard nobody believes is a
leaderboard nobody opens twice. `lifts.verified_by` is nullable: null means
unverified, a lifter id means someone co-signed it. Editing a lift clears
it — a changed number is a new claim.

### Bodyweight is never shown

It's needed to score and nothing else, so only the weight class band is
displayed. The palette follows from this: weight classes take their Olympic
plate colour (10kg green, 15kg yellow, 20kg blue, 25kg red), ascending the
way a loaded bar reads, so the colour carries information instead of
decorating.

### Deployed before it did anything

The first thing built was an empty page on a live URL with continuous
deployment wired up. Environment variables, OAuth redirect URIs and build
configuration only misbehave in production — deploying an empty app first
means every later failure is caused by the one thing that just changed.
That decision caught a build error twelve days before launch that would
otherwise have surfaced with people waiting to sign up.

---

## Architecture

```
app/
  page.tsx                  public leaderboard (no sign-in required)
  me/page.tsx               profile and lift entry
  actions.ts                server actions, validation, plausibility caps
  api/auth/[...nextauth]/   Auth.js route handler
  privacy, terms
lib/
  scoring.ts                Epley 1RM, DOTS, weight classes
  scoring.test.ts           tested against published DOTS results
  leaderboard.ts            ranking query (window functions)
  lifters.ts                data access
  db.ts                     Neon client
db/schema.sql               lifters, lifts, events
scripts/
  migrate.mjs
  check-scoring-parity.mjs  asserts SQL and TypeScript agree
```

Session reads sit behind `<Suspense>` boundaries: with Cache Components
enabled, reading `cookies()` outside one is a build error.

---

## What broke

- **Three production builds failed while localhost was fine.** `next dev`
  only compiles what you visit; `next build` type-checks everything,
  including a test file Next never bundles.
- **The first outside user couldn't sign in.** The link shared was Vercel's
  per-deployment URL rather than the stable domain, so Google rejected the
  callback. Changing the domain afterwards broke it again until all four
  places in the OAuth config were updated.
- **Publishing the OAuth app required a privacy policy**, which turned a
  back-of-the-list item into a launch blocker.
- **The whole app rendered in Arial for two days.** `create-next-app` loads
  a font into a CSS variable and then sets `body { font-family: Arial }`.

---

## Results

_To be filled at the end of the run. Metrics tracked in the `events` table:
signups, profile completion, lift entries, return visits._

| Metric | Count |
|---|---|
| Signups | |
| Entered at least one lift | |
| Completed all five | |
| Returned after the first session | |

---

## Running locally

```bash
npm install
cp .env.example .env.local     # DATABASE_URL, AUTH_SECRET, AUTH_GOOGLE_ID, AUTH_GOOGLE_SECRET
node --env-file=.env.local scripts/migrate.mjs
node lib/scoring.test.ts
npm run dev
```

---

## Privacy

Bodyweight and email address are never shown publicly. Data is deleted on
request. See [/privacy](https://lnmgymrank.vercel.app/privacy).
