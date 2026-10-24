-- Table Plan M0/M1 schema. Prices in pence. RLS on everything user-owned.

create table public.products (
  key         text primary key,
  name        text not null,
  price_pence integer not null check (price_pence >= 0),
  pack_size   numeric not null check (pack_size > 0),
  unit        text not null,
  retailer    text not null default 'morrisons',
  slug        text not null,
  updated_at  timestamptz not null default now()
);

create table public.cupboard_items (
  key  text primary key,
  info text not null
);

create table public.recipes (
  id          text primary key,
  course      text not null check (course in ('breakfast','lunch','snack','dinner')),
  emoji       text,
  name        text not null,
  protein_g   integer not null,
  kcal        integer not null,
  serves      integer not null default 1,
  method      text[] not null default '{}',
  cupboard    text[] not null default '{}',
  allergens   text[] not null default '{}',   -- provisional until M2 verification
  macros_only boolean not null default false
);

create table public.recipe_ingredients (
  recipe_id   text not null references public.recipes(id) on delete cascade,
  product_key text not null references public.products(key),
  qty         numeric not null,
  primary key (recipe_id, product_key)
);

-- One row per user; stats are optional (special-category health data).
create table public.profiles (
  user_id         uuid primary key references auth.users(id) on delete cascade,
  goal            text check (goal in ('lose','maintain','gain')),
  height_unit     text not null default 'cm' check (height_unit in ('cm','ftin')),
  weight_unit     text not null default 'kg' check (weight_unit in ('kg','stlb','lb')),
  height_cm       numeric,
  weight_kg       numeric,
  age             integer,
  sex             text check (sex in ('f','m')),
  activity        numeric not null default 1.375,
  skipped_stats   text[] not null default '{}',
  meals           jsonb not null,
  allergies       text[] not null default '{}',
  no_allergies    boolean not null default false,
  dislikes        text[] not null default '{}',
  liked_recipes   text[] not null default '{}',
  skipped_recipes text[] not null default '{}',
  onboarding_step text not null default 'goal',
  completed       boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

alter table public.profiles enable row level security;
create policy "own profile read"   on public.profiles for select using (auth.uid() = user_id);
create policy "own profile insert" on public.profiles for insert with check (auth.uid() = user_id);
create policy "own profile update" on public.profiles for update using (auth.uid() = user_id);
create policy "own profile delete" on public.profiles for delete using (auth.uid() = user_id);

-- Catalogue tables: world-readable, writable only by the service role.
alter table public.products enable row level security;
alter table public.cupboard_items enable row level security;
alter table public.recipes enable row level security;
alter table public.recipe_ingredients enable row level security;
create policy "catalogue read" on public.products for select using (true);
create policy "catalogue read" on public.cupboard_items for select using (true);
create policy "catalogue read" on public.recipes for select using (true);
create policy "catalogue read" on public.recipe_ingredients for select using (true);

create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();
