import crypto from 'node:crypto';
import { PLANS, type PlanId } from './config';
import type { SubStatus, Subscription } from './types';

/** Verifies a Stripe-Signature header (v1 HMAC-SHA256 over `${t}.${payload}`) with a replay window. */
export function verifyStripeSignature(payload: string, header: string | null, secret: string, nowSec = Math.floor(Date.now() / 1000), toleranceSec = 300): boolean {
  if (!header) return false;
  const parts = Object.fromEntries(header.split(',').map((kv) => kv.split('=') as [string, string]));
  const t = Number(parts.t);
  if (!t || Math.abs(nowSec - t) > toleranceSec) return false;
  const expected = crypto.createHmac('sha256', secret).update(`${t}.${payload}`).digest('hex');
  return header.split(',').filter((p) => p.startsWith('v1=')).some((p) => {
    const got = p.slice(3);
    return got.length === expected.length && crypto.timingSafeEqual(Buffer.from(got), Buffer.from(expected));
  });
}

const STATUS: Record<string, SubStatus> = { trialing: 'trialing', active: 'active', past_due: 'past_due', unpaid: 'past_due', canceled: 'canceled', incomplete_expired: 'canceled' };
const iso = (sec?: number | null) => (sec ? new Date(sec * 1000).toISOString() : null);

/** Maps a Stripe subscription object to ours. Plan comes from the price id, so it can't be spoofed by metadata. */
export function subscriptionFromStripe(obj: any, env: Record<string, string | undefined> = process.env): Subscription | null {
  const st = STATUS[obj?.status];
  if (!st) return null;
  const priceId = obj.items?.data?.[0]?.price?.id;
  const plan = (Object.keys(PLANS) as PlanId[]).find((p) => env[PLANS[p].stripePriceEnv] === priceId) ?? null;
  return {
    status: st, plan, trialEndsAt: st === 'trialing' ? iso(obj.trial_end) : null,
    currentPeriodEnd: iso(obj.current_period_end ?? obj.items?.data?.[0]?.current_period_end),
    cancelAtPeriodEnd: !!obj.cancel_at_period_end, stripeCustomerId: typeof obj.customer === 'string' ? obj.customer : undefined,
  };
}

/** Events we act on. Everything else is acknowledged and ignored. */
export const HANDLED_EVENTS = ['customer.subscription.created', 'customer.subscription.updated', 'customer.subscription.deleted'] as const;

/** Form-encodes nested params the way Stripe's API expects, e.g. line_items[0][price]. */
export function stripeForm(params: Record<string, unknown>, prefix = ''): string {
  return Object.entries(params).flatMap(([k, v]) => {
    const name = prefix ? `${prefix}[${k}]` : k;
    if (v === undefined || v === null) return [];
    if (Array.isArray(v)) return v.map((x, i) => (typeof x === 'object' ? stripeForm(x as Record<string, unknown>, `${name}[${i}]`) : `${encodeURIComponent(`${name}[${i}]`)}=${encodeURIComponent(String(x))}`));
    if (typeof v === 'object') return [stripeForm(v as Record<string, unknown>, name)];
    return [`${encodeURIComponent(name)}=${encodeURIComponent(String(v))}`];
  }).join('&');
}

export function checkoutParams(plan: PlanId, opts: { userId: string; email: string; origin: string; priceId: string }) {
  const cfg = PLANS[plan];
  return {
    mode: 'subscription',
    line_items: [{ price: opts.priceId, quantity: 1 }],
    client_reference_id: opts.userId,
    customer_email: opts.email,
    success_url: `${opts.origin}/plan?subscribed=1`,
    cancel_url: `${opts.origin}/subscribe`,
    allow_promotion_codes: true,
    // The trial is a Stripe subscription trial: the card is taken now and charged when it ends, unless cancelled.
    subscription_data: { ...(cfg.trialDays > 0 ? { trial_period_days: cfg.trialDays } : {}), metadata: { user_id: opts.userId, plan } },
  };
}
