-- The supermarket a person prices and shops at. Not applied until a second store is live (see design/multi-store-research.md);
-- the app only sends `store` once someone has chosen one, so running this later is safe.
alter table public.profiles
  add column if not exists store text not null default 'morrisons' check (store in ('morrisons', 'tesco'));
