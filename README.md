# Gym Rank

Bodyweight-adjusted lifting leaderboards for college gyms in India — one
board per college, and a global board for lifters whose numbers have a
witness.

**Live:** https://getgymrank.vercel.app

Lifters pick their college (or it's read from their institute email), enter
a working set for each of five movements, and the app estimates a one-rep
max, adjusts the squat/bench/deadlift total for bodyweight using DOTS, and
ranks everyone — overall and within weight classes — so a 60kg lifter and a
90kg lifter can be compared fairly.

It started as the board for one gym (LNMIIT Jaipur). Built as a student
project; not affiliated with or endorsed by any college.

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

So each lifter has a public page (`/u/<username>`) listing the sets behind
their score, and any *other* signed-in lifter can tap "I saw this" on a set
they watched. That adds a row to `lift_cosigns`, and their name shows next
to the lift. Any number of people can co-sign one set, each once. The owner
can't co-sign their own sets — the server checks, not just the UI — and
editing a lift clears its co-signs, because a changed number is a new claim.

Once squat, bench and deadlift are all co-signed, the lifter is *fully*
co-signed if one person witnessed all three, and *partially* co-signed if it
took several people (`lib/cosign.ts`). Either way they qualify for the global
board; the board and their page say which.

Whether people actually bother to co-sign is an open question; the
`lift_cosigned` event will answer it.

### One board per college, and a global one that costs something

A board only works when the people on it know each other: a campus board
polices itself because everyone knows who actually squats 200. So the unit
is the college. `lifters.college_id` scopes every query, co-signing is
restricted to lifters at the same college (a co-sign means "I was in the
room"), and a college's board lives at `/c/<slug>`.

The college comes from the sign-in email when it can — `@iitd.ac.in` is IIT
Delhi, matched on domain suffix so `student.iitd.ac.in` works too — and the
profile form locks it when it does. That's the only verification the app
has that someone is where they say. Gmail sign-ins pick from the list in
`db/colleges.json`, which is seeded on migrate; adding a college is a line
of JSON.

The global board (`/global`) is every college together, but it admits only
lifters whose three lifts are all co-signed. A global board of strangers'
self-reported numbers becomes a liars' board within a week; this one is
the reward for getting co-signed, and the one board where every number has
a witness.

### Notifications are rows, not emails

`/me` shows what happened while you were away: who co-signed a set, who
passed your score. "Passed" isn't stored anywhere as a rank — the board
computes ranks on every read — so it's detected at save time by comparing
DOTS before and after: anyone on the same board whose score sits in
`(before, after]` was just passed. A unique index on (recipient, actor,
kind, movement, day) means re-saving a lift five times doesn't notify the
same person five times. Email is a delivery mechanism and can come later;
the fact being delivered lives here.

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
  page.tsx                  landing: college search + global preview
  c/[slug]/page.tsx         one college's board + try-it calculator
  global/page.tsx           every college, co-signed lifters only
  board.tsx                 the board component, stats strip, shared chrome
  college-picker.tsx        college search (landing links / profile field)
  calculator.tsx            client-side DOTS + projected rank, nothing saved
  me/page.tsx               profile, lift entry, notifications
  lifter/[id]/page.tsx      a lifter's public page; co-signing happens here
  forms.tsx                 client forms (useActionState for inline errors)
  actions.ts                server actions, validation, notifications
  api/og/route.tsx          the share card, as a PNG
  api/auth/[...nextauth]/   Auth.js route handler
  privacy, terms, scoring
lib/
  scoring.ts                Epley 1RM, DOTS, weight classes
  scoring.test.ts           tested against published DOTS results
  leaderboard.ts            ranking query (window functions), college/global scope
  colleges.ts               college lookup, email-domain detection
  notifications.ts          co-sign and passed-you rows
  lifters.ts                data access
  movements.ts              the five movements (no db import; shared with client)
  db.ts                     Neon client
db/
  schema.sql                colleges, lifters, lifts, lift_history, events, notifications
  colleges.json             the seed list: slug, names, city, email domains
scripts/
  migrate.mjs               applies schema.sql, seeds colleges
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

## Keeping the database awake

Neon's free plan suspends the database after five idle minutes, and the
next visitor pays a multi-second wake-up. A cron-job.org job hits
`/api/health` (which runs `select 1`) every four minutes during gym
hours. The hours are limited on purpose: the free plan has 100
compute-hours a month, and running out suspends the database outright.
At the smallest size (0.25 CU) each awake hour costs 0.25, so always-on
is ~186 a month and 18 hours a day is ~140, both over the limit. Keep
the window to about 10 hours a day (~78 a month). Since boards and
profiles are cached, a sleeping database only slows `/me` and saving,
by about a second.

---

## Adding a college

Add an entry to `db/colleges.json` — slug, full name, short name, city,
state, and the email domains the college issues — and re-run the migrate
script. It upserts on slug, so renames and extra domains go the same way.

---

## Privacy

Bodyweight and email address are never shown publicly. Data is deleted on
request. See [/privacy](https://getgymrank.vercel.app/privacy).
