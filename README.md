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
against. Every additional field is also one more chance to abandon signup —
a hypothesis the `events` table is there to test (profile created vs. first
lift saved vs. all three saved). Squat, bench, deadlift, overhead press and
pull-ups.

### Bodyweight is snapshotted per lift

Stored on each `lifts` row rather than read from the lifter's current
profile, so someone cutting from 90kg to 80kg doesn't retroactively rewrite
their old scores.

### Current state and history are separate tables

`lifts` holds one row per lifter per movement and is overwritten on save —
that's what the board ranks. `lift_history` is append-only and gets a row on
every save. Without it, each save erased the number it replaced and there
was nothing to come back for; with it, the profile page shows "+5.0 kg since
last entry", and a progression view is a query away rather than a schema
change. The two writes aren't in one transaction (the Neon HTTP driver
doesn't offer one here); a failure between them loses a history row, not
the lift, which is the right direction to fail in.

### Co-signing, by someone else

Every number is self-reported, and a leaderboard nobody believes is a
leaderboard nobody opens twice. The plausibility caps (400/300/450 kg)
stop joke entries; they do nothing about a plausible lie, and one plausible
lie at the top kills the board.

So each lifter has a public page (`/lifter/<id>`) listing the sets behind
their score, and any *other* signed-in lifter can tap "I saw this" on a set
they watched. That writes their id into `lifts.verified_by`, and their name
shows next to the lift. The owner can't co-sign their own sets — the server
checks, not just the UI — and editing a lift clears the co-sign, because a
changed number is a new claim. The board shows how many of the three total
lifts are co-signed.

Whether people actually bother to co-sign is an open question; the
`lift_cosigned` event will answer it.

### Try it before you sign in

Handing over a Google account before you know whether the number is worth
having is the biggest ask in the funnel. The scoring is pure arithmetic that
already runs on the server, so the homepage runs it in the browser too:
bodyweight plus three working sets gives a score and a projected rank
against the live board, with nothing saved. Sign-in is the step *after* you
have seen your number.

### Errors are returned, not thrown

A server action that throws renders Next's error boundary — a crash screen —
which is the wrong answer to someone typing 500 in a kilo box. Actions return
`{ error }` and the forms show it under the field via `useActionState`.

### Bodyweight is never shown

It's needed to score and nothing else, so only the weight class band is
displayed. Class boards appear once a class has three lifters; below that
they are a repeat of the overall board, not a ranking. The palette follows from this: weight classes take their Olympic
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
  page.tsx                  public leaderboard + try-it calculator
  calculator.tsx            client-side DOTS + projected rank, nothing saved
  me/page.tsx               profile and lift entry
  lifter/[id]/page.tsx      a lifter's public page; co-signing happens here
  forms.tsx                 client forms (useActionState for inline errors)
  actions.ts                server actions, validation, plausibility caps
  api/auth/[...nextauth]/   Auth.js route handler
  privacy, terms
lib/
  scoring.ts                Epley 1RM, DOTS, weight classes
  scoring.test.ts           tested against published DOTS results
  leaderboard.ts            ranking query (window functions)
  lifters.ts                data access
  movements.ts              the five movements (no db import; shared with client)
  db.ts                     Neon client
db/schema.sql               lifters, lifts, lift_history, events
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
| Completed squat, bench and deadlift | |
| Had at least one lift co-signed | |
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
