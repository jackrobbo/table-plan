-- Private beta: waitlist, invites, feedback. All three are written by server routes with the service role,
-- so RLS is on with no policies except feedback (users may insert their own).
create table public.waitlist (
  id          uuid primary key default gen_random_uuid(),
  email       text not null unique check (email = lower(email)),
  source      text not null default 'site',
  consent_at  timestamptz not null,      -- when they agreed to be emailed (UK GDPR)
  created_at  timestamptz not null default now(),
  invited_at  timestamptz
);
alter table public.waitlist enable row level security;

create table public.invites (
  code         text primary key check (code = upper(code) and length(code) = 12),  -- stored without dashes
  waitlist_id  uuid references public.waitlist(id),
  email        text,                       -- who redeemed it
  created_at   timestamptz not null default now(),
  redeemed_at  timestamptz
);
alter table public.invites enable row level security;
create index invites_waitlist_idx on public.invites (waitlist_id);

-- Atomic single-use redemption: returns true only for the one request that wins.
create or replace function public.redeem_invite(p_code text, p_email text) returns boolean
language sql security definer set search_path = public as $$
  with u as (
    update public.invites set email = lower(p_email), redeemed_at = now()
    where code = upper(p_code) and redeemed_at is null returning 1
  ) select exists (select 1 from u);
$$;
revoke all on function public.redeem_invite(text, text) from public, anon, authenticated;

create table public.feedback (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references auth.users(id) on delete set null,
  message    text not null check (length(message) between 3 and 2000),
  page       text,
  created_at timestamptz not null default now()
);
alter table public.feedback enable row level security;
create index feedback_user_idx on public.feedback (user_id);
create policy "own feedback insert" on public.feedback for insert with check ((select auth.uid()) = user_id);
