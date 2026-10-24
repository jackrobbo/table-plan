-- Subscription state mirrored from Stripe webhooks. Users can read their own row; only the service role writes.
create table public.subscriptions (
  user_id              uuid primary key references auth.users(id) on delete cascade,
  stripe_customer_id   text unique,
  status               text not null default 'none' check (status in ('none','trialing','active','past_due','canceled')),
  plan                 text check (plan in ('yearly','monthly')),
  trial_ends_at        timestamptz,
  current_period_end   timestamptz,
  cancel_at_period_end boolean not null default false,
  updated_at           timestamptz not null default now()
);
alter table public.subscriptions enable row level security;
create policy "own subscription read" on public.subscriptions for select using ((select auth.uid()) = user_id);
-- no insert/update/delete policies: webhooks use the service role, which bypasses RLS.

-- Webhook idempotency: Stripe retries, so remember which events were processed.
create table public.stripe_events (id text primary key, received_at timestamptz not null default now());
alter table public.stripe_events enable row level security;
