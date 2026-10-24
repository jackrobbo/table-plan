-- Table Plan M0/M1 schema. Prices in pence. RLS on everything user-owned.

create table public.ingredients (
  slug        text primary key,
  name        text not null,
  unit        text not null,
  cupboard    boolean not null default false,
  note        text,
  allergens   text[] not null default '{}',
  -- CoFID per 100 g/ml; null until verified (scraped/imported later)
  kcal_100    numeric, protein_100 numeric, carbs_100 numeric, fat_100 numeric,
  cofid_code  text,
  cofid_verified boolean not null default false
);

-- Retailer mapping, one product per ingredient per retailer (Morrisons-only at launch).
create table public.products (
  ingredient_slug text not null references public.ingredients(slug) on delete cascade,
  retailer        text not null default 'morrisons',
  name            text not null,
  price_pence     integer not null check (price_pence >= 0),
  pack_size       numeric not null check (pack_size > 0),
  slug            text not null,
  updated_at      timestamptz not null default now(),
  primary key (ingredient_slug, retailer)
);

create table public.recipes (
  slug         text primary key,
  name         text not null,
  course       text not null check (course in ('breakfast','lunch','snack','dinner')),
  emoji        text,
  serves       integer not null default 1 check (serves >= 1),
  -- per portion
  kcal         integer not null, protein_g numeric not null, carbs_g numeric, fat_g numeric,
  method       text[] not null default '{}',
  allergens    text[] not null default '{}',   -- derived from ingredients by the importer
  status       text not null default 'draft' check (status in ('draft','verified','live')),
  source       text,
  macros_only  boolean not null default false,
  version      integer not null default 1,
  content_hash text,
  updated_at   timestamptz not null default now()
);

create table public.recipe_ingredients (
  recipe_slug     text not null references public.recipes(slug) on delete cascade,
  ingredient_slug text not null references public.ingredients(slug),
  qty             numeric not null,
  cupboard        boolean not null default false,
  primary key (recipe_slug, ingredient_slug)
);

-- Edits snapshot the previous row, so saved plans can pin the version they used.
create table public.recipe_versions (
  recipe_slug text not null,
  version     integer not null,
  snapshot    jsonb not null,
  primary key (recipe_slug, version)
);

create or replace function public.snapshot_recipe() returns trigger language plpgsql as $$
begin
  insert into public.recipe_versions (recipe_slug, version, snapshot) values (old.slug, old.version, to_jsonb(old))
    on conflict do nothing;
  new.version = old.version + 1;
  new.updated_at = now();
  return new;
end $$;
create trigger recipes_snapshot before update on public.recipes
  for each row execute function public.snapshot_recipe();

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

-- Catalogue tables: world-readable (live recipes only), writable only by the service role.
alter table public.ingredients enable row level security;
alter table public.products enable row level security;
alter table public.recipes enable row level security;
alter table public.recipe_ingredients enable row level security;
alter table public.recipe_versions enable row level security;
create policy "catalogue read" on public.ingredients for select using (true);
create policy "catalogue read" on public.products for select using (true);
create policy "live recipes read" on public.recipes for select using (status = 'live');
create policy "live recipe lines read" on public.recipe_ingredients for select
  using (exists (select 1 from public.recipes r where r.slug = recipe_slug and r.status = 'live'));

create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();
