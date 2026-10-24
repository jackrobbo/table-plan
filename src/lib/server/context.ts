import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { WaitlistStore } from '../beta/waitlist';
import type { ServerUser, SubscriptionStore } from '../billing/server';
import type { Subscription } from '../billing/types';
import type { AccountStore } from './account';
import type { SignupStore } from './signup';
import { fileWaitlistStore } from './waitlistFile';

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/** Service-role client (bypasses RLS). Server-only: SUPABASE_SERVICE_ROLE_KEY must never be exposed to the browser. */
function admin(): SupabaseClient | null {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return URL_ && key ? createClient(URL_, key, { auth: { persistSession: false, autoRefreshToken: false } }) : null;
}

/** The signed-in user, from the Supabase access token the browser sends as `Authorization: Bearer ...`. */
export async function getServerUser(req: Request): Promise<ServerUser | null> {
  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token || !URL_ || !ANON) return null;
  const { data, error } = await createClient(URL_, ANON, { auth: { persistSession: false } }).auth.getUser(token);
  return error || !data.user?.email ? null : { id: data.user.id, email: data.user.email };
}

export function getSubscriptionStore(): SubscriptionStore | null {
  const sb = admin();
  if (!sb) return null;
  return {
    async seen(eventId) {
      const { data } = await sb.from('stripe_events').select('id').eq('id', eventId).maybeSingle();
      return !!data;
    },
    async save(userId: string, s: Subscription, eventId: string) {
      const { error } = await sb.from('subscriptions').upsert({
        user_id: userId, stripe_customer_id: s.stripeCustomerId ?? null, status: s.status, plan: s.plan,
        trial_ends_at: s.trialEndsAt, current_period_end: s.currentPeriodEnd, cancel_at_period_end: s.cancelAtPeriodEnd, updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });
      // 23503 = the user no longer exists (they deleted their account; Stripe still reports the subscription ending).
      // Nothing to record, and failing would only make Stripe retry for days.
      if (error && error.code !== '23503') throw new Error(error.message);
      await sb.from('stripe_events').insert({ id: eventId });
    },
  };
}

export async function getStripeCustomerId(user: ServerUser): Promise<string | undefined> {
  const sb = admin();
  if (!sb) return undefined;
  const { data } = await sb.from('subscriptions').select('stripe_customer_id').eq('user_id', user.id).maybeSingle();
  return data?.stripe_customer_id ?? undefined;
}

/** Local dev can use WAITLIST_FILE; otherwise the waitlist is a Supabase insert (idempotent on email). */
export function getWaitlistStore(): WaitlistStore | null {
  if (process.env.WAITLIST_FILE) return fileWaitlistStore(process.env.WAITLIST_FILE);
  const sb = admin();
  if (!sb) return null;
  return {
    async add(e) {
      const { error } = await sb.from('waitlist').upsert({ email: e.email, source: e.source, consent_at: e.consentAt }, { onConflict: 'email', ignoreDuplicates: true });
      if (error) throw new Error(error.message);
    },
  };
}

/** Account creation for the invite gate: atomic single-use redemption via the `redeem_invite` SQL function, then a confirmed login. */
export function getSignupStore(): SignupStore | null {
  const sb = admin();
  if (!sb) return null;
  return {
    async redeem(code, email) {
      const { data, error } = await sb.rpc('redeem_invite', { p_code: code, p_email: email });
      return !error && data === true;
    },
    async release(code, email) {
      await sb.from('invites').update({ email: null, redeemed_at: null }).eq('code', code).eq('email', email);
    },
    async createUser(email) {
      const { error } = await sb.auth.admin.createUser({ email, email_confirm: true });
      if (!error) return 'created';
      return error.code === 'email_exists' || /already (been )?registered/i.test(error.message) ? 'exists' : 'failed';
    },
  };
}

export async function saveFeedback(user: ServerUser | null, msg: { message: string; page: string }): Promise<boolean> {
  const sb = admin();
  if (!sb || !user) return false;
  const { error } = await sb.from('feedback').insert({ user_id: user.id, message: msg.message, page: msg.page });
  return !error;
}

/** Export and erasure for the signed-in person. Server-only: uses the service role. */
export function getAccountStore(): AccountStore | null {
  const sb = admin();
  if (!sb) return null;
  const must = (what: string, error: { message: string } | null) => { if (error) throw new Error(`${what}: ${error.message}`); };
  return {
    async stripeCustomerId(userId) {
      const { data } = await sb.from('subscriptions').select('stripe_customer_id').eq('user_id', userId).maybeSingle();
      return data?.stripe_customer_id ?? undefined;
    },
    async exportData(user) {
      const email = user.email.toLowerCase();
      const [profile, sub, feedback, waitlist, invite] = await Promise.all([
        sb.from('profiles').select('*').eq('user_id', user.id).maybeSingle(),
        sb.from('subscriptions').select('status, plan, trial_ends_at, current_period_end, cancel_at_period_end, stripe_customer_id, updated_at').eq('user_id', user.id).maybeSingle(),
        sb.from('feedback').select('message, page, created_at').eq('user_id', user.id).order('created_at'),
        sb.from('waitlist').select('email, source, consent_at').eq('email', email).maybeSingle(),
        sb.from('invites').select('redeemed_at').eq('email', email).maybeSingle(),
      ]);
      for (const [what, r] of [['profile', profile], ['subscription', sub], ['feedback', feedback], ['waitlist', waitlist], ['invite', invite]] as const) must(what, r.error);
      return { profile: profile.data, subscription: sub.data, feedback: feedback.data ?? [], waitlist: waitlist.data, invite: invite.data };
    },
    async deleteData(user) {
      const email = user.email.toLowerCase();
      must('feedback', (await sb.from('feedback').delete().eq('user_id', user.id)).error);
      const { data: wl, error: wlErr } = await sb.from('waitlist').select('id').eq('email', email).maybeSingle();
      must('waitlist', wlErr);
      if (wl) {
        must('invites', (await sb.from('invites').update({ waitlist_id: null }).eq('waitlist_id', wl.id)).error);
        must('waitlist', (await sb.from('waitlist').delete().eq('id', wl.id)).error);
      }
      // The code stays used (it can't be redeemed again) but no longer points at a person.
      must('invites', (await sb.from('invites').update({ email: null }).eq('email', email)).error);
    },
    async deleteUser(userId) {
      const { error } = await sb.auth.admin.deleteUser(userId);
      if (error && error.status !== 404) throw new Error(error.message);
    },
  };
}
