-- Gym Rank schema.
-- Run with:  node --env-file=.env.local scripts/migrate.mjs
--
-- The migrate script also seeds `colleges` from db/colleges.json and moves
-- any lifter without a college onto the original one (LNMIIT).

-- One row per college. A board is scoped to a college; the global board is
-- the union. `domains` are the email domains the college issues, so a
-- sign-in from an institute address lands on the right board without a
-- picker, and is light proof the person belongs there.
create table if not exists colleges (
  id          serial primary key,
  slug        text not null unique,
  name        text not null,
  short_name  text not null,
  city        text not null,
  state       text not null,
  domains     text[] not null default '{}',
  created_at  timestamptz not null default now()
);

create table if not exists lifters (
  id            uuid primary key default gen_random_uuid(),
  email         text not null unique,
  display_name  text not null,
  bodyweight_kg numeric(5,2) not null check (bodyweight_kg between 30 and 250),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Nullable only so the column can be added to an existing table; the app
-- treats a null as "hasn't picked a college yet" and asks.
alter table lifters add column if not exists college_id int references colleges(id);
create index if not exists lifters_college_idx on lifters (college_id);

-- The handle: what URLs and @mentions key on. Display names stay free-form
-- and can repeat; this cannot. Stored lowercase, unique case-insensitively
-- anyway so a race between two casings can't produce a pair. Nullable at
-- creation only so the migrate script can backfill before it's required.
alter table lifters add column if not exists username text;
create unique index if not exists lifters_username_idx on lifters (lower(username));

-- LNMIIT only: the year someone joined (2024 = the Y24 batch). Null for
-- everyone else and for anyone who'd rather not say. lib/batch.ts.
alter table lifters add column if not exists batch_year smallint
  check (batch_year between 2000 and 2100);

-- A cartoon avatar picked instead of initials: an id from lib/avatars.ts,
-- checked there before it's saved. Null means initials.
alter table lifters add column if not exists avatar text;

create table if not exists lifts (
  id            uuid primary key default gen_random_uuid(),
  lifter_id     uuid not null references lifters(id) on delete cascade,
  movement      text not null check (movement in
                  ('squat','bench','deadlift','overhead_press','pullups')),

  -- weight_kg and est_1rm_kg are null for pullups, which are bodyweight-only
  weight_kg     numeric(5,2),
  reps          int not null check (reps between 1 and 100),
  est_1rm_kg    numeric(6,2),

  -- snapshot of the lifter's bodyweight when this lift was entered, so a
  -- later cut or bulk doesn't retroactively rewrite old scores
  bodyweight_kg numeric(5,2) not null check (bodyweight_kg between 30 and 250),

  recorded_at   timestamptz not null default now(),

  unique (lifter_id, movement),

  constraint pullups_carry_no_load check (
    (movement = 'pullups'  and weight_kg is null     and est_1rm_kg is null)
    or
    (movement <> 'pullups' and weight_kg is not null and est_1rm_kg is not null)
  )
);

-- Who co-signed which lift: any number of witnesses per lift, one row
-- each. A lift counts as co-signed when it has at least one row here.
-- Re-saving a lift deletes its rows.
create table if not exists lift_cosigns (
  lift_id    uuid not null references lifts(id) on delete cascade,
  witness_id uuid not null references lifters(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (lift_id, witness_id)
);

create index if not exists lift_cosigns_witness_idx on lift_cosigns (witness_id);

-- The old single-witness column. Its co-signs were copied into
-- lift_cosigns on 2026-11-17, and nothing reads or writes it now.
alter table lifts drop column if exists verified_by;

create index if not exists lifts_movement_idx on lifts (movement);
create index if not exists lifts_lifter_idx   on lifts (lifter_id);

-- Append-only log of every lift ever saved. `lifts` is current state (one
-- row per lifter per movement, overwritten on save); this table is never
-- updated or deleted from. It is what makes "since last entry" deltas and
-- any future progression view possible — without it, every save erases the
-- number it replaced.
create table if not exists lift_history (
  id            bigserial primary key,
  lifter_id     uuid not null references lifters(id) on delete cascade,
  movement      text not null,
  weight_kg     numeric(5,2),
  reps          int not null,
  est_1rm_kg    numeric(6,2),
  bodyweight_kg numeric(5,2) not null,
  recorded_at   timestamptz not null default now()
);

create index if not exists lift_history_lifter_movement_idx
  on lift_history (lifter_id, movement, recorded_at desc);

-- Usage events. This is how the signup/entry/return numbers get reported
-- at the end of the project; without it there is nothing to measure.
create table if not exists events (
  id         bigserial primary key,
  lifter_id  uuid references lifters(id) on delete set null,
  name       text not null,
  created_at timestamptz not null default now()
);

create index if not exists events_name_created_idx on events (name, created_at);

-- Things that happened to a lifter while they were away: someone co-signed
-- a set, someone passed them on the board. Shown on /me, marked seen once
-- rendered. `actor_id` is who did it; `movement` is set for co-signs only.
create table if not exists notifications (
  id         bigserial primary key,
  lifter_id  uuid not null references lifters(id) on delete cascade,
  actor_id   uuid references lifters(id) on delete cascade,
  kind       text not null check (kind in ('cosign', 'passed')),
  movement   text,
  created_at timestamptz not null default now(),
  seen_at    timestamptz
);

create index if not exists notifications_lifter_created_idx
  on notifications (lifter_id, created_at desc);

-- Someone re-saving a lift five times in a minute passes the same person
-- five times. One notice per actor, per kind, per movement, per day.
create unique index if not exists notifications_daily_dedupe_idx
  on notifications (
    lifter_id, actor_id, kind, coalesce(movement, ''),
    ((created_at at time zone 'utc')::date)
  );
