import type { SupabaseClient } from '@supabase/supabase-js';
import type { PlanId } from './config';
import { noSubscription, type BillingService, type Subscription } from './types';

/** Real billing: reads the webhook-maintained `subscriptions` row; checkout and portal run through our server routes. */
export function createSupabaseBilling(sb: SupabaseClient): BillingService {
  const token = async () => (await sb.auth.getSession()).data.session?.access_token;

  async function redirect(path: string, body: unknown): Promise<never> {
    const t = await token();
    const r = await fetch(path, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${t ?? ''}` }, body: JSON.stringify(body) });
    const j = (await r.json().catch(() => ({}))) as { url?: string; error?: string };
    if (!r.ok || !j.url) throw new Error(j.error ?? 'Could not reach the payment page.');
    window.location.href = j.url;
    return new Promise<never>(() => undefined); // the page is navigating away
  }

  const get = async (userId: string): Promise<Subscription> => {
    const { data } = await sb.from('subscriptions').select('*').eq('user_id', userId).maybeSingle();
    if (!data) return noSubscription();
    return {
      status: data.status, plan: data.plan, trialEndsAt: data.trial_ends_at, currentPeriodEnd: data.current_period_end,
      cancelAtPeriodEnd: data.cancel_at_period_end, stripeCustomerId: data.stripe_customer_id ?? undefined,
    };
  };

  return {
    get,
    subscribe: (_userId, _email, plan: PlanId) => redirect('/api/billing/checkout', { plan }),
    // Cancelling and resuming happen in Stripe's billing portal, which also shows invoices and the card.
    cancel: () => redirect('/api/billing/portal', {}),
    resume: () => redirect('/api/billing/portal', {}),
  };
}
