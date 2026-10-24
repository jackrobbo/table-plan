import { PLANS, type PlanId } from './config';
import { checkoutParams, HANDLED_EVENTS, stripeForm, subscriptionFromStripe, verifyStripeSignature } from './stripe';
import type { Subscription } from './types';

type Env = Record<string, string | undefined>;
export interface ServerUser { id: string; email: string }

/** Persistence the webhook needs. Implemented on Supabase (service role) once a project exists. */
export interface SubscriptionStore {
  /** True if this event id was already processed (Stripe retries deliveries). */
  seen(eventId: string): Promise<boolean>;
  save(userId: string, sub: Subscription, eventId: string): Promise<void>;
}

export interface Result { status: number; body: Record<string, unknown> }

const STRIPE = 'https://api.stripe.com/v1';
const post = (fetchImpl: typeof fetch, key: string, path: string, params: Record<string, unknown>) =>
  fetchImpl(`${STRIPE}${path}`, { method: 'POST', headers: { authorization: `Bearer ${key}`, 'content-type': 'application/x-www-form-urlencoded' }, body: stripeForm(params) });

/** Creates a Stripe Checkout Session for the signed-in user. The client only ever supplies the plan id. */
export async function createCheckoutSession(a: { plan: unknown; user: ServerUser | null; origin: string; env: Env; fetchImpl?: typeof fetch }): Promise<Result> {
  const key = a.env.STRIPE_SECRET_KEY;
  if (!key) return { status: 501, body: { error: 'Payments are not configured yet.' } };
  if (!a.user) return { status: 401, body: { error: 'Sign in first.' } };
  if (a.plan !== 'yearly' && a.plan !== 'monthly') return { status: 400, body: { error: 'Unknown plan.' } };
  const plan: PlanId = a.plan;
  const priceId = a.env[PLANS[plan].stripePriceEnv];
  if (!priceId) return { status: 501, body: { error: `Missing ${PLANS[plan].stripePriceEnv}.` } };
  const res = await post(a.fetchImpl ?? fetch, key, '/checkout/sessions', checkoutParams(plan, { userId: a.user.id, email: a.user.email, origin: a.origin, priceId, managedPayments: a.env.STRIPE_MANAGED_PAYMENTS === '1' }));
  const json = (await res.json()) as { url?: string; error?: { message?: string } };
  return res.ok && json.url ? { status: 200, body: { url: json.url } } : { status: 502, body: { error: json.error?.message ?? 'Could not start checkout.' } };
}

/** Billing portal link for "Manage or cancel". Needs the customer id saved by the webhook. */
export async function createPortalSession(a: { customerId: string | undefined; origin: string; env: Env; fetchImpl?: typeof fetch }): Promise<Result> {
  const key = a.env.STRIPE_SECRET_KEY;
  if (!key) return { status: 501, body: { error: 'Payments are not configured yet.' } };
  if (!a.customerId) return { status: 404, body: { error: 'No subscription found.' } };
  const res = await post(a.fetchImpl ?? fetch, key, '/billing_portal/sessions', { customer: a.customerId, return_url: `${a.origin}/account` });
  const json = (await res.json()) as { url?: string };
  return res.ok && json.url ? { status: 200, body: { url: json.url } } : { status: 502, body: { error: 'Could not open the billing portal.' } };
}

/**
 * Deletes the person's Stripe customer, which also cancels any subscription at once. 'none' = there was nothing to delete (already
 * gone), 'failed' = we couldn't confirm it, so the caller must not carry on as if billing had stopped.
 */
export async function deleteStripeCustomer(a: { customerId: string; env: Env; fetchImpl?: typeof fetch }): Promise<'deleted' | 'none' | 'failed'> {
  const key = a.env.STRIPE_SECRET_KEY;
  if (!key) return 'failed';
  try {
    const res = await (a.fetchImpl ?? fetch)(`${STRIPE}/customers/${encodeURIComponent(a.customerId)}`, { method: 'DELETE', headers: { authorization: `Bearer ${key}` } });
    if (res.status === 404) return 'none';
    const json = (await res.json().catch(() => ({}))) as { deleted?: boolean };
    return res.ok && json.deleted ? 'deleted' : 'failed';
  } catch { return 'failed'; }
}

/** Verifies and applies a Stripe webhook. Unknown events are acknowledged (200) so Stripe stops retrying them. */
export async function handleWebhook(a: { payload: string; signature: string | null; env: Env; store: SubscriptionStore | null; nowSec?: number }): Promise<Result> {
  const secret = a.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return { status: 501, body: { error: 'Webhook not configured.' } };
  if (!verifyStripeSignature(a.payload, a.signature, secret, a.nowSec)) return { status: 400, body: { error: 'Bad signature.' } };
  let event: any;
  try { event = JSON.parse(a.payload); } catch { return { status: 400, body: { error: 'Bad payload.' } }; }
  if (!(HANDLED_EVENTS as readonly string[]).includes(event.type)) return { status: 200, body: { ignored: event.type } };
  if (!a.store) return { status: 503, body: { error: 'No subscription store configured.' } };
  if (await a.store.seen(event.id)) return { status: 200, body: { duplicate: true } };
  const obj = event.data?.object;
  const userId = obj?.metadata?.user_id;
  const sub = subscriptionFromStripe(obj, a.env);
  if (!userId || !sub) return { status: 200, body: { skipped: 'no user or unknown status' } };
  await a.store.save(userId, event.type === 'customer.subscription.deleted' ? { ...sub, status: 'canceled' } : sub, event.id);
  return { status: 200, body: { ok: true } };
}
