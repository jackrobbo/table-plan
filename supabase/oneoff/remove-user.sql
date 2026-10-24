-- Remove every trace of ONE person from the Table Plan database (a test account, or an erasure you're doing by hand).
-- Run in the Supabase SQL editor. Change the address on the first line of each part, run PART 1 to preview, then PART 2.
-- (Real users can delete themselves in Account → Delete my account; this is for test accounts and anything stuck.)
-- Does not touch Stripe: cancel/delete the Stripe customer separately if there is one (PART 1 shows its id).

-- ===== PART 1: preview (read-only) =====
with t as (select id from auth.users where lower(email) = lower('you@example.com'))
select 'auth.users' as place, count(*) as rows from auth.users where id in (select id from t)
union all select 'auth.identities', count(*) from auth.identities where user_id in (select id from t)
union all select 'auth.sessions', count(*) from auth.sessions where user_id in (select id from t)
union all select 'public.profiles', count(*) from public.profiles where user_id in (select id from t)
union all select 'public.subscriptions', count(*) from public.subscriptions where user_id in (select id from t)
union all select 'public.feedback', count(*) from public.feedback where user_id in (select id from t)
union all select 'public.invites (redeemed by this email)', count(*) from public.invites where lower(email) = lower('you@example.com')
union all select 'public.waitlist', count(*) from public.waitlist where lower(email) = lower('you@example.com');
select stripe_customer_id from public.subscriptions where user_id in (select id from auth.users where lower(email) = lower('you@example.com'));

-- ===== PART 2: remove =====
do $$
declare v_email text := lower('you@example.com'); uid uuid;
begin
  select id into uid from auth.users where lower(email) = v_email;

  delete from public.feedback where user_id = uid;                                   -- the FK would only blank the user id
  update public.invites set waitlist_id = null where waitlist_id in (select id from public.waitlist where lower(email) = v_email);
  delete from public.waitlist where lower(email) = v_email;
  update public.invites set email = null where lower(email) = v_email;               -- code stays used; to make it usable again also set redeemed_at = null

  delete from auth.users where id = uid;                                             -- cascades to identities, sessions, profile, subscription
end $$;

-- every row should be 0
select 'auth.users' as place, count(*) as rows_left from auth.users where lower(email) = lower('you@example.com')
union all select 'public.waitlist', count(*) from public.waitlist where lower(email) = lower('you@example.com')
union all select 'public.invites', count(*) from public.invites where lower(email) = lower('you@example.com')
union all select 'public.profiles (orphans)', count(*) from public.profiles p where not exists (select 1 from auth.users u where u.id = p.user_id)
union all select 'public.subscriptions (orphans)', count(*) from public.subscriptions s where not exists (select 1 from auth.users u where u.id = s.user_id);
