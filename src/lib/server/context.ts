import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { InviteStore } from '../beta/invites';
import type { WaitlistStore } from '../beta/waitlist';
import type { ServerUser, SubscriptionStore } from '../billing/server';
import type { Subscription } from '../billing/types';
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
      if (error) throw new Error(error.message);
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

/** Atomic single-use redemption via the `redeem_invite` SQL function. */
export function getInviteStore(): InviteStore | null {
  const sb = admin();
  if (!sb) return null;
  return {
    async redeem(code, email) {
      const { data, error } = await sb.rpc('redeem_invite', { p_code: code, p_email: email });
      return !error && data === true;
    },
  };
}

export async function saveFeedback(user: ServerUser | null, msg: { message: string; page: string }): Promise<boolean> {
  const sb = admin();
  if (!sb || !user) return false;
  const { error } = await sb.from('feedback').insert({ user_id: user.id, message: msg.message, page: msg.page });
  return !error;
}
