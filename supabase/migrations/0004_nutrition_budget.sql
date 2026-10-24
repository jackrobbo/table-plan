-- Computed nutrition + budget tiers (100-meal bank).
-- Ingredients: how each per-100 value was sourced, unit weights, and cupboard pricing.
alter table public.ingredients
  add column if not exists grams_per_unit numeric,
  add column if not exists negligible boolean not null default false,
  add column if not exists cupboard_price_pence integer,
  add column if not exists cupboard_price_grams numeric,
  add column if not exists nutrition_basis text check (nutrition_basis in ('cofid', 'label')),
  add column if not exists nutrition_note text;

-- Recipes: marginal cost per portion (pence) and its low/medium/high tier, computed by the importer.
alter table public.recipes
  add column if not exists cost_pence integer,
  add column if not exists budget text check (budget in ('low', 'medium', 'high'));

-- Profiles: the person's spend preference for planning ('any' = no preference).
alter table public.profiles
  add column if not exists budget text not null default 'any' check (budget in ('any', 'low', 'medium', 'high'));
