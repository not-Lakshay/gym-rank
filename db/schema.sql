-- Gym Rank schema.
-- Run with:  node --env-file=.env.local scripts/migrate.mjs

create table if not exists lifters (
  id            uuid primary key default gen_random_uuid(),
  email         text not null unique,
  display_name  text not null,
  bodyweight_kg numeric(5,2) not null check (bodyweight_kg between 30 and 250),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

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

  -- null = unverified. A lifter id means someone else co-signed it.
  verified_by   uuid references lifters(id),

  recorded_at   timestamptz not null default now(),

  unique (lifter_id, movement),

  constraint pullups_carry_no_load check (
    (movement = 'pullups'  and weight_kg is null     and est_1rm_kg is null)
    or
    (movement <> 'pullups' and weight_kg is not null and est_1rm_kg is not null)
  )
);

create index if not exists lifts_movement_idx on lifts (movement);
create index if not exists lifts_lifter_idx   on lifts (lifter_id);

-- Usage events. This is how the signup/entry/return numbers get reported
-- at the end of the project; without it there is nothing to measure.
create table if not exists events (
  id         bigserial primary key,
  lifter_id  uuid references lifters(id) on delete set null,
  name       text not null,
  created_at timestamptz not null default now()
);

create index if not exists events_name_created_idx on events (name, created_at);
