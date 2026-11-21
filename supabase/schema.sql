-- =============================================================================
-- Dawai Dost: database schema and security rules
-- Supabase project ref: fkyozmweopldnopwdylm (Postgres, ap-south-1 / Mumbai)
--
-- This file is the readable source of truth. It is applied through the Supabase
-- MCP (apply_migration) and followed by a security advisor run (get_advisors).
--
-- Security model
--   * No login wall: each browser silently gets a Supabase *anonymous* account.
--     Those users run as the `authenticated` role with their own auth.uid().
--   * RLS is on for every table. Each row carries user_id and every policy is
--     "only your own rows". Inserts/updates also prove that the parent row
--     (profile / medicine) belongs to the same user, so nobody can attach data
--     to someone else's profile by guessing an id.
--   * The `anon` role (publishable key, no session) gets no table access at all.
--   * /api/caregiver uses the SECRET key server-side to read a single profile's
--     summary after verifying a hashed share token. Raw tokens are never stored.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- profiles: the people whose medicines are tracked (e.g. "Dadi", "Nanaji")
-- ---------------------------------------------------------------------------
create table public.profiles (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name            text not null check (char_length(name) between 1 and 40),
  age             smallint check (age between 0 and 120),
  language        text not null default 'en' check (language in ('en', 'hi')),
  blood_group     text check (blood_group in ('A+','A-','B+','B-','AB+','AB-','O+','O-')),
  allergies       text check (char_length(allergies) <= 200),
  conditions      text check (char_length(conditions) <= 200),
  emergency_name  text check (char_length(emergency_name) <= 40),
  emergency_phone text check (emergency_phone ~ '^[0-9+ -]{0,20}$'),
  created_at      timestamptz not null default now()
);
create index profiles_user_id_idx on public.profiles (user_id);

-- ---------------------------------------------------------------------------
-- medicines: what to take, how much, when, and how it looks
-- ---------------------------------------------------------------------------
create table public.medicines (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  profile_id   uuid not null references public.profiles (id) on delete cascade,
  name         text not null check (char_length(name) between 1 and 80),
  generic_name text check (char_length(generic_name) <= 80),
  dosage       text check (char_length(dosage) <= 40),
  form         text not null default 'tablet'
               check (form in ('tablet','capsule','syrup','injection','drops','inhaler','other')),
  color        text not null default 'white'
               check (color in ('white','yellow','orange','pink','red','blue','green','brown')),
  shape        text not null default 'round'
               check (shape in ('round','oval','capsule','liquid','other')),
  meal         text not null default 'any' check (meal in ('before','after','with','any')),
  times        time[] not null check (cardinality(times) between 1 and 6),
  days         smallint[] not null default '{0,1,2,3,4,5,6}'
               check (cardinality(days) between 1 and 7 and days <@ '{0,1,2,3,4,5,6}'::smallint[]),
  dose_qty     numeric(4,1) not null default 1 check (dose_qty > 0 and dose_qty <= 20),
  stock        numeric(7,1) check (stock between 0 and 10000),
  refill_at    smallint not null default 5 check (refill_at between 0 and 60), -- warn when this many days are left
  start_date   date not null default current_date,
  end_date     date check (end_date is null or end_date >= start_date),
  active       boolean not null default true,
  notes        text check (char_length(notes) <= 200),
  created_at   timestamptz not null default now()
);
create index medicines_user_id_idx on public.medicines (user_id);
create index medicines_profile_id_idx on public.medicines (profile_id);

-- ---------------------------------------------------------------------------
-- dose_logs: one row per scheduled dose that was taken or skipped.
-- The UNIQUE constraint is the database-level double-dose guard: the same
-- scheduled dose can never be logged twice, even from two devices.
-- ---------------------------------------------------------------------------
create table public.dose_logs (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  medicine_id   uuid not null references public.medicines (id) on delete cascade,
  scheduled_for timestamptz not null,
  status        text not null check (status in ('taken', 'skipped')),
  logged_at     timestamptz not null default now(),
  unique (medicine_id, scheduled_for)
);
create index dose_logs_user_id_idx on public.dose_logs (user_id);

-- ---------------------------------------------------------------------------
-- caregiver_links: revocable read-only share links. Only a SHA-256 hash of
-- the token is stored; the raw token is shown to the owner exactly once.
-- ---------------------------------------------------------------------------
create table public.caregiver_links (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  label      text check (char_length(label) <= 40),
  expires_at timestamptz not null default (now() + interval '30 days'),
  revoked    boolean not null default false,
  created_at timestamptz not null default now()
);
create index caregiver_links_user_id_idx on public.caregiver_links (user_id);
create index caregiver_links_profile_id_idx on public.caregiver_links (profile_id);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.profiles        enable row level security;
alter table public.medicines       enable row level security;
alter table public.dose_logs       enable row level security;
alter table public.caregiver_links enable row level security;

-- Defence in depth: the sessionless `anon` role cannot touch these tables at all.
revoke all on public.profiles, public.medicines, public.dose_logs, public.caregiver_links from anon;

-- profiles: own rows only
create policy "profiles: read own"   on public.profiles for select to authenticated
  using (user_id = (select auth.uid()));
create policy "profiles: insert own" on public.profiles for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "profiles: update own" on public.profiles for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "profiles: delete own" on public.profiles for delete to authenticated
  using (user_id = (select auth.uid()));

-- medicines: own rows only, and the profile must be yours too
create policy "medicines: read own"   on public.medicines for select to authenticated
  using (user_id = (select auth.uid()));
create policy "medicines: insert own" on public.medicines for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.profiles p where p.id = profile_id and p.user_id = (select auth.uid()))
  );
create policy "medicines: update own" on public.medicines for update to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.profiles p where p.id = profile_id and p.user_id = (select auth.uid()))
  );
create policy "medicines: delete own" on public.medicines for delete to authenticated
  using (user_id = (select auth.uid()));

-- dose_logs: own rows only, and the medicine must be yours too
create policy "dose_logs: read own"   on public.dose_logs for select to authenticated
  using (user_id = (select auth.uid()));
create policy "dose_logs: insert own" on public.dose_logs for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.medicines m where m.id = medicine_id and m.user_id = (select auth.uid()))
  );
create policy "dose_logs: update own" on public.dose_logs for update to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.medicines m where m.id = medicine_id and m.user_id = (select auth.uid()))
  );
create policy "dose_logs: delete own" on public.dose_logs for delete to authenticated
  using (user_id = (select auth.uid()));

-- caregiver_links: own rows only, and the profile must be yours too
create policy "caregiver_links: read own"   on public.caregiver_links for select to authenticated
  using (user_id = (select auth.uid()));
create policy "caregiver_links: insert own" on public.caregiver_links for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.profiles p where p.id = profile_id and p.user_id = (select auth.uid()))
  );
create policy "caregiver_links: update own" on public.caregiver_links for update to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.profiles p where p.id = profile_id and p.user_id = (select auth.uid()))
  );
create policy "caregiver_links: delete own" on public.caregiver_links for delete to authenticated
  using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Migration: routine_slots_and_place_cue
-- Routine-based reminders (research: people remember medicines through daily
-- routines and place cues, and two cues beat one; Stawarz et al. 2014/2016).
-- Each person has routine times; a medicine dose can be anchored to a routine
-- slot ("after breakfast") and moves when the routine changes. `times` stays
-- the materialised clock time so schedules, alarms and calendar export are simple.
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column wake_time      time not null default '07:00',
  add column breakfast_time time not null default '08:30',
  add column lunch_time     time not null default '13:30',
  add column dinner_time    time not null default '20:30',
  add column bed_time       time not null default '22:00';

alter table public.medicines
  add column slots   text[] check (slots is null or (cardinality(slots) between 1 and 6 and slots <@ '{wake,breakfast,lunch,dinner,bed,custom}'::text[])),
  add column kept_at text check (char_length(kept_at) <= 60);   -- place cue, e.g. "blue box, dining table"

alter table public.medicines
  add constraint medicines_slots_match_times check (slots is null or cardinality(slots) = cardinality(times));

-- ---------------------------------------------------------------------------
-- Migration: medicine_doctor_and_photo
-- Prescribing doctor, and a small compressed photo of the medicine/strip
-- (data URL, ~25 KB) so elders can recognise it. Format and size are enforced
-- here as well as in the browser.
-- ---------------------------------------------------------------------------
alter table public.medicines
  add column doctor text check (char_length(doctor) <= 60),
  add column photo  text check (photo is null or (char_length(photo) <= 90000 and photo ~ '^data:image/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$'));

-- ---------------------------------------------------------------------------
-- Migration: allow_bundled_sample_photos
-- New accounts start with a sample family whose medicine photos are bundled
-- same-origin files (/demo/<name>.jpg), so the photo check accepts that exact
-- path shape as well as small data URLs.
-- ---------------------------------------------------------------------------
alter table public.medicines drop constraint medicines_photo_check;
alter table public.medicines add constraint medicines_photo_check check (
  photo is null
  or photo ~ '^/demo/[a-z0-9-]{1,40}\.jpg$'
  or (char_length(photo) <= 90000 and photo ~ '^data:image/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$')
);
