-- Table Plan — initial schema (DRAFT for M0).
-- Apply once the Supabase project is connected. Refined in M1 (auth/persistence)
-- and M2 (recipe bank → DB). UK-only; prices in PENCE (integer); GBP.
-- RLS is enabled on every user-owned table; policies scope rows to auth.uid().

create extension if not exists "pgcrypto";

-- ---------- enums ----------
create type goal as enum ('lose', 'maintain', 'gain');
create type course as enum ('breakfast', 'lunch', 'snack', 'dinner');
create type week_status as enum (
  'locked', 'to_plan', 'in_progress', 'planned', 'shopped', 'active', 'done', 'skipped', 'missed'
);
create type plan_mode as enum ('plan', 'macros_only'); -- per meal time

-- ---------- catalogue (shared, read-only to clients) ----------
create table products (
  id            text primary key,          -- e.g. 'breast'
  name          text not null,             -- shelf name
  price_pence   integer not null,
  pack          numeric not null,
  unit          text not null,             -- g, ml, eggs, wraps, …
  slug          text not null,             -- Morrisons …/<slug>/<id>
  retailer      text not null default 'morrisons',
  last_checked  timestamptz,               -- drives the "≈ dated" honesty UI
  created_at    timestamptz not null default now()
);

create table recipes (
  id         text primary key,             -- e.g. 'DSB'
  course     course not null,
  emoji      text not null,
  name       text not null,
  protein_g  integer not null,             -- per portion
  kcal       integer not null,             -- per portion
  serves     integer not null default 1,
  method     jsonb not null default '[]',  -- string[]
  allergens  text[] not null default '{}', -- UK 14 major allergens, hard-excluded
  macros_verified boolean not null default false, -- CoFID-checked (M2)
  created_at timestamptz not null default now()
);

create table recipe_ingredients (
  recipe_id  text not null references recipes(id) on delete cascade,
  product_id text not null references products(id),
  qty        numeric not null,             -- for the recipe's stated serves
  primary key (recipe_id, product_id)
);

-- ---------- per-user ----------
create table profiles (
  id                   uuid primary key references auth.users(id) on delete cascade,
  goal                 goal not null default 'lose',
  -- optional stats (UK-GDPR special category — nullable by design)
  sex                  text, age integer, height_cm integer, weight_kg numeric, activity numeric,
  target_kcal          integer, band_lo integer, band_hi integer, protein_floor integer,
  meals_to_plan        jsonb not null default '{"breakfast":"plan","lunch":"plan","dinner":"plan"}',
  servings             jsonb not null default '{}',   -- per meal time
  days_to_plan         text[] not null default '{Mon,Tue,Wed,Thu,Fri}',
  household_allergies  text[] not null default '{}',
  dislikes             text[] not null default '{}',
  budget_tier          text not null default 'medium',
  preferred_supermarket text not null default 'morrisons',
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create table taste_profile (
  user_id    uuid not null references auth.users(id) on delete cascade,
  recipe_id  text not null references recipes(id) on delete cascade,
  liked      boolean not null default true,
  never      boolean not null default false,     -- "never suggest this again"
  updated_at timestamptz not null default now(),
  primary key (user_id, recipe_id)
);

create table weeks (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  monday     date not null,                       -- the week's Monday
  status     week_status not null default 'to_plan',
  days_off   text[] not null default '{Sat,Sun}',
  checkout   text,                                -- 'notes' | 'basket:<store>'
  created_at timestamptz not null default now(),
  unique (user_id, monday)
);

create table week_days (
  week_id    uuid not null references weeks(id) on delete cascade,
  dow        smallint not null,                   -- 0=Mon … 4=Fri
  breakfast  text references recipes(id),
  lunch      text references recipes(id),
  snack      text references recipes(id),
  dinner     text references recipes(id),
  topup      jsonb,                               -- {n,p,k,prod,qty} | null
  protein_g  integer, kcal integer,
  out_of_band boolean not null default false,
  primary key (week_id, dow)
);

create table week_items (
  week_id        uuid not null references weeks(id) on delete cascade,
  product_id     text not null references products(id),
  qty            numeric not null,
  packs          integer not null,
  est_price_pence integer not null,
  used_for       text,
  ticked         boolean not null default true,   -- untick what you already have
  primary key (week_id, product_id)
);

-- offline-first meal ticks (localStorage/IndexedDB on device, synced here)
create table ticks (
  user_id   uuid not null references auth.users(id) on delete cascade,
  on_date   date not null,
  slot      text not null,                        -- breakfast|lunch|snack|dinner|topup
  ticked    boolean not null default true,
  primary key (user_id, on_date, slot)
);

-- ---------- RLS ----------
alter table profiles      enable row level security;
alter table taste_profile enable row level security;
alter table weeks         enable row level security;
alter table week_days     enable row level security;
alter table week_items    enable row level security;
alter table ticks         enable row level security;

create policy own_profile      on profiles      using (id = auth.uid()) with check (id = auth.uid());
create policy own_taste        on taste_profile using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy own_weeks        on weeks         using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy own_ticks        on ticks         using (user_id = auth.uid()) with check (user_id = auth.uid());
-- week_days / week_items are reached via their parent week:
create policy own_week_days    on week_days
  using (exists (select 1 from weeks w where w.id = week_id and w.user_id = auth.uid()))
  with check (exists (select 1 from weeks w where w.id = week_id and w.user_id = auth.uid()));
create policy own_week_items   on week_items
  using (exists (select 1 from weeks w where w.id = week_id and w.user_id = auth.uid()))
  with check (exists (select 1 from weeks w where w.id = week_id and w.user_id = auth.uid()));

-- products & recipes are shared catalogue: RLS stays off (read-only to clients via anon key;
-- writes happen server-side with the service role during seeding/pricing jobs).

create index weeks_user_monday_idx on weeks (user_id, monday desc);
create index recipes_course_idx on recipes (course);
