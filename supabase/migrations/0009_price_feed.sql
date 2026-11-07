-- Supermarket price feed (stage 2). See design/architecture.md section 6 and design/feed-test-results.md.
--
-- Prices are fast-changing operational data, so they live here and are written by a scheduled job, never by a code release.
-- The app never calls the price vendor: it reads the latest dated snapshot. If a run fails or is held, the previous snapshot
-- keeps being served and the app shows its date.
--
-- Licence: the vendor allows display and about a week's caching but not resale or bulk redistribution. So these tables are
-- NOT readable by browsers (RLS on, no policies, grants revoked): only server code using the service role reads them, and it
-- returns just the fields a signed-in person needs for their own store.

-- One row per fetch of the feed: what was asked, what came back, what was held back.
create table public.price_runs (
  id             uuid primary key default gen_random_uuid(),
  source         text not null,                       -- 'yappman'
  started_at     timestamptz not null default now(),
  finished_at    timestamptz,
  status         text not null default 'running' check (status in ('running', 'ok', 'partial', 'failed')),
  stores         text[] not null default '{}',
  rows_expected  integer,
  rows_received  integer,
  rows_held      integer not null default 0,          -- rows that failed a check and are not served (e.g. a move over 50%)
  cost_usd       numeric,
  notes          text
);

-- Which retailer product we price for each ingredient. The ingredient slug refers to content/ingredients.json (the catalogue
-- is files, so this is deliberately not a foreign key). One product per ingredient per store.
create table public.store_products (
  store            text not null check (store in ('morrisons', 'tesco', 'sainsburys', 'asda')),
  ingredient_slug  text not null,
  product_ref      text not null,                     -- the retailer's own product id
  name             text not null,
  pack_text        text,                              -- as the retailer prints it, e.g. '1kg'
  pack_size        numeric,                           -- in g or ml (or a count), when we know it
  pack_unit        text,
  url              text,
  matched_by       text,                              -- 'catalogue' (our own mapping) or 'confirmed' (reviewed match)
  updated_at       timestamptz not null default now(),
  primary key (store, ingredient_slug)
);
create index store_products_ref_idx on public.store_products (store, product_ref);

-- Every price we have ever accepted or held, with the run that brought it. History is kept for trends and for rolling back a bad run.
create table public.store_prices (
  id                  bigint generated always as identity primary key,
  run_id              uuid not null references public.price_runs(id) on delete cascade,
  store               text not null check (store in ('morrisons', 'tesco', 'sainsburys', 'asda')),
  product_ref         text not null,
  price_pence         integer not null check (price_pence > 0),
  was_price_pence     integer,
  loyalty_price_pence integer,
  promo_text          text,
  in_stock            boolean,
  pack_text           text,
  priced_at           timestamptz not null,           -- when the vendor priced it
  held                boolean not null default false, -- failed a check: stored, never served
  hold_reason         text
);
create index store_prices_latest_idx on public.store_prices (store, product_ref, priced_at desc);
create index store_prices_run_idx on public.store_prices (run_id);

-- What the app serves: the newest accepted price per product.
create view public.latest_prices with (security_invoker = true) as
  select distinct on (store, product_ref)
         store, product_ref, price_pence, was_price_pence, loyalty_price_pence, promo_text, in_stock, pack_text, priced_at, run_id
  from public.store_prices
  where not held
  order by store, product_ref, priced_at desc;

-- Cost of one portion at a store, recomputed from the latest prices each run (it used to be baked in at import time).
create table public.recipe_costs (
  store         text not null check (store in ('morrisons', 'tesco', 'sainsburys', 'asda')),
  recipe_slug   text not null,
  cost_pence    integer,                              -- null when any priced ingredient is missing at this store
  budget_tier   text check (budget_tier in ('low', 'medium', 'high')),
  complete      boolean not null default false,
  missing       text[] not null default '{}',         -- ingredient slugs with no usable price at this store
  run_id        uuid references public.price_runs(id) on delete set null,
  as_of         timestamptz not null,
  primary key (store, recipe_slug)
);

-- Locked down: RLS on, no policies, no grants to the browser roles. The service role (server only) bypasses RLS.
alter table public.price_runs     enable row level security;
alter table public.store_products enable row level security;
alter table public.store_prices   enable row level security;
alter table public.recipe_costs   enable row level security;
revoke all on public.price_runs, public.store_products, public.store_prices, public.recipe_costs, public.latest_prices from anon, authenticated;
