import crypto from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { PLANS, gbp, perMonth } from '@/lib/billing/config';
import { createMockBilling } from '@/lib/billing/mock';
import { createCheckoutSession, createPortalSession, handleWebhook, type SubscriptionStore } from '@/lib/billing/server';
import { checkoutParams, stripeForm, subscriptionFromStripe, verifyStripeSignature } from '@/lib/billing/stripe';
import { PAST_DUE_GRACE_DAYS, hasAccess, noSubscription, type Subscription } from '@/lib/billing/types';
import type { KV } from '@/lib/db/types';

const mem = (): KV => { const m = new Map<string, string>(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v), removeItem: (k) => void m.delete(k) }; };
const T0 = new Date('2026-10-26T10:00:00Z');
const sign = (payload: string, secret: string, t: number) => `t=${t},v1=${crypto.createHmac('sha256', secret).update(`${t}.${payload}`).digest('hex')}`;

describe('pricing config', () => {
  it('matches the launch decision and formats pence', () => {
    expect(PLANS.yearly).toMatchObject({ pence: 999, interval: 'year', trialDays: 7 });
    expect(PLANS.monthly).toMatchObject({ pence: 99, interval: 'month', trialDays: 0 });
    expect(gbp(999)).toBe('£9.99');
    expect(perMonth(PLANS.yearly)).toBe('£0.83');
    expect(perMonth(PLANS.monthly)).toBe('£0.99');
  });
});

describe('access rules', () => {
  const sub = (o: Partial<Subscription>): Subscription => ({ ...noSubscription(), ...o });
  it('trialing and active get in until the period ends', () => {
    expect(hasAccess(sub({ status: 'trialing', currentPeriodEnd: '2026-11-02T10:00:00Z' }), T0)).toBe(true);
    expect(hasAccess(sub({ status: 'active', currentPeriodEnd: '2026-10-01T00:00:00Z' }), T0)).toBe(false);
    expect(hasAccess(noSubscription(), T0)).toBe(false);
  });
  it('a cancelled plan keeps access until the paid period ends', () => {
    expect(hasAccess(sub({ status: 'canceled', currentPeriodEnd: '2026-11-01T00:00:00Z' }), T0)).toBe(true);
    expect(hasAccess(sub({ status: 'canceled', currentPeriodEnd: '2026-10-01T00:00:00Z' }), T0)).toBe(false);
  });
  it('past_due gets a short grace window, then loses access', () => {
    const end = '2026-10-24T10:00:00Z';
    expect(hasAccess(sub({ status: 'past_due', currentPeriodEnd: end }), T0)).toBe(true);
    expect(hasAccess(sub({ status: 'past_due', currentPeriodEnd: end }), new Date(new Date(end).getTime() + (PAST_DUE_GRACE_DAYS + 1) * 864e5))).toBe(false);
  });
});

describe('mock billing', () => {
  it('yearly starts a 7-day trial; monthly is active immediately; cancel/resume keep access', async () => {
    const b = createMockBilling(mem(), () => T0);
    const y = await b.subscribe('u1', 'a@b.co', 'yearly');
    expect(y).toMatchObject({ status: 'trialing', plan: 'yearly', trialEndsAt: '2026-11-02T10:00:00.000Z' });
    const c = await b.cancel('u1');
    expect(c.cancelAtPeriodEnd).toBe(true);
    expect(hasAccess(c, T0)).toBe(true);
    expect((await b.resume('u1')).cancelAtPeriodEnd).toBe(false);
    const m = await b.subscribe('u2', 'a@b.co', 'monthly');
    expect(m).toMatchObject({ status: 'active', plan: 'monthly', trialEndsAt: null, currentPeriodEnd: '2026-11-26T10:00:00.000Z' });
    expect((await b.cancel('nobody')).status).toBe('none');
  });
  it('persists per user', async () => {
    const kv = mem();
    await createMockBilling(kv, () => T0).subscribe('u1', 'a@b.co', 'yearly');
    expect((await createMockBilling(kv, () => T0).get('u1')).plan).toBe('yearly');
    expect((await createMockBilling(kv, () => T0).get('u2')).status).toBe('none');
  });
});

describe('stripe helpers', () => {
  const secret = 'whsec_test';
  const payload = '{"id":"evt_1"}';
  it('verifies signatures, rejects tampering, wrong secrets and stale timestamps', () => {
    const t = 1_800_000_000;
    expect(verifyStripeSignature(payload, sign(payload, secret, t), secret, t + 10)).toBe(true);
    expect(verifyStripeSignature(payload + ' ', sign(payload, secret, t), secret, t + 10)).toBe(false);
    expect(verifyStripeSignature(payload, sign(payload, 'other', t), secret, t + 10)).toBe(false);
    expect(verifyStripeSignature(payload, sign(payload, secret, t), secret, t + 1000)).toBe(false);
    expect(verifyStripeSignature(payload, null, secret, t)).toBe(false);
    expect(verifyStripeSignature(payload, 'garbage', secret, t)).toBe(false);
  });
  it('form-encodes nested params the way Stripe expects', () => {
    expect(decodeURIComponent(stripeForm({ mode: 'subscription', line_items: [{ price: 'p_1', quantity: 1 }], subscription_data: { metadata: { user_id: 'u' } } })))
      .toBe('mode=subscription&line_items[0][price]=p_1&line_items[0][quantity]=1&subscription_data[metadata][user_id]=u');
  });
  it('puts the trial on yearly only, and ties the user to the subscription server-side', () => {
    const y = checkoutParams('yearly', { userId: 'u1', email: 'a@b.co', origin: 'https://x.test', priceId: 'p_y' });
    expect(y.subscription_data).toMatchObject({ trial_period_days: 7, metadata: { user_id: 'u1', plan: 'yearly' } });
    expect(checkoutParams('monthly', { userId: 'u1', email: 'a@b.co', origin: 'https://x.test', priceId: 'p_m' }).subscription_data).not.toHaveProperty('trial_period_days');
  });
  it('maps a Stripe subscription, taking the plan from the price id', () => {
    const env = { STRIPE_PRICE_YEARLY: 'price_y', STRIPE_PRICE_MONTHLY: 'price_m' };
    const s = subscriptionFromStripe({ status: 'trialing', trial_end: 1_800_000_000, current_period_end: 1_800_000_000, cancel_at_period_end: false, customer: 'cus_1', items: { data: [{ price: { id: 'price_y' } }] } }, env)!;
    expect(s).toMatchObject({ status: 'trialing', plan: 'yearly', stripeCustomerId: 'cus_1', cancelAtPeriodEnd: false });
    expect(subscriptionFromStripe({ status: 'weird' }, env)).toBeNull();
    expect(subscriptionFromStripe({ status: 'active', items: { data: [{ price: { id: 'price_x' } }] } }, env)!.plan).toBeNull();
  });
});

describe('server flows', () => {
  const user = { id: 'u1', email: 'a@b.co' };
  const env = { STRIPE_SECRET_KEY: 'sk_test', STRIPE_PRICE_YEARLY: 'price_y', STRIPE_PRICE_MONTHLY: 'price_m', STRIPE_WEBHOOK_SECRET: 'whsec_test' };

  it('checkout: 501 when unconfigured, 401 signed out, 400 bad plan, 200 with a url', async () => {
    const f = (async () => new Response(JSON.stringify({ url: 'https://checkout.stripe.com/c/1' }), { status: 200 })) as unknown as typeof fetch;
    expect((await createCheckoutSession({ plan: 'yearly', user, origin: 'o', env: {}, fetchImpl: f })).status).toBe(501);
    expect((await createCheckoutSession({ plan: 'yearly', user: null, origin: 'o', env, fetchImpl: f })).status).toBe(401);
    expect((await createCheckoutSession({ plan: 'free', user, origin: 'o', env, fetchImpl: f })).status).toBe(400);
    expect((await createCheckoutSession({ plan: 'yearly', user, origin: 'o', env: { ...env, STRIPE_PRICE_YEARLY: undefined }, fetchImpl: f })).status).toBe(501);
    const ok = await createCheckoutSession({ plan: 'yearly', user, origin: 'https://x.test', env, fetchImpl: f });
    expect(ok).toEqual({ status: 200, body: { url: 'https://checkout.stripe.com/c/1' } });
  });

  it('checkout sends the right request to Stripe and never trusts a client-supplied price', async () => {
    let seen: { url: string; body: string; auth: string } | null = null;
    const f = (async (url: string, init: RequestInit) => { seen = { url, body: String(init.body), auth: String((init.headers as Record<string, string>).authorization) }; return new Response(JSON.stringify({ url: 'u' }), { status: 200 }); }) as unknown as typeof fetch;
    await createCheckoutSession({ plan: 'monthly', user, origin: 'https://x.test', env, fetchImpl: f });
    expect(seen!.url).toBe('https://api.stripe.com/v1/checkout/sessions');
    expect(seen!.auth).toBe('Bearer sk_test');
    expect(decodeURIComponent(seen!.body)).toContain('line_items[0][price]=price_m');
    expect(decodeURIComponent(seen!.body)).toContain('client_reference_id=u1');
  });

  it('portal: needs a customer', async () => {
    const f = (async () => new Response(JSON.stringify({ url: 'https://billing.stripe.com/p/1' }), { status: 200 })) as unknown as typeof fetch;
    expect((await createPortalSession({ customerId: undefined, origin: 'o', env, fetchImpl: f })).status).toBe(404);
    expect((await createPortalSession({ customerId: 'cus_1', origin: 'o', env, fetchImpl: f })).body).toEqual({ url: 'https://billing.stripe.com/p/1' });
  });

  describe('webhook', () => {
    const t = 1_800_000_000;
    const event = (type: string, over: object = {}) => JSON.stringify({ id: 'evt_9', type, data: { object: { status: 'active', current_period_end: t + 86400, cancel_at_period_end: false, customer: 'cus_1', metadata: { user_id: 'u1' }, items: { data: [{ price: { id: 'price_y' } }] }, ...over } } });
    const store = () => { const saved: [string, Subscription][] = []; const ids = new Set<string>(); const s: SubscriptionStore = { seen: async (id) => ids.has(id), save: async (u, sub, id) => { saved.push([u, sub]); ids.add(id); } }; return { s, saved }; };
    const call = (payload: string, sig: string | null, s: SubscriptionStore | null) => handleWebhook({ payload, signature: sig, env, store: s, nowSec: t });

    it('rejects bad signatures and missing config', async () => {
      const { s } = store(); const p = event('customer.subscription.updated');
      expect((await call(p, 't=1,v1=bad', s)).status).toBe(400);
      expect((await handleWebhook({ payload: p, signature: sign(p, 'whsec_test', t), env: {}, store: s, nowSec: t })).status).toBe(501);
    });
    it('saves a verified subscription event for the user in its metadata, once', async () => {
      const { s, saved } = store(); const p = event('customer.subscription.updated');
      expect((await call(p, sign(p, 'whsec_test', t), s)).status).toBe(200);
      expect(saved).toHaveLength(1);
      expect(saved[0]).toMatchObject(['u1', { status: 'active', plan: 'yearly', stripeCustomerId: 'cus_1' }]);
      expect((await call(p, sign(p, 'whsec_test', t), s)).body).toEqual({ duplicate: true });
      expect(saved).toHaveLength(1);
    });
    it('deleted subscriptions become canceled; unknown events are acknowledged; no store is a 503', async () => {
      const { s, saved } = store(); const d = event('customer.subscription.deleted');
      await call(d, sign(d, 'whsec_test', t), s);
      expect(saved[0][1].status).toBe('canceled');
      const other = JSON.stringify({ id: 'evt_2', type: 'invoice.paid', data: { object: {} } });
      expect((await call(other, sign(other, 'whsec_test', t), s)).body).toEqual({ ignored: 'invoice.paid' });
      const p = event('customer.subscription.updated');
      expect((await call(p, sign(p, 'whsec_test', t), null)).status).toBe(503);
    });
    it('skips events with no user id instead of guessing', async () => {
      const { s, saved } = store(); const p = event('customer.subscription.created', { metadata: {} });
      expect((await call(p, sign(p, 'whsec_test', t), s)).status).toBe(200);
      expect(saved).toHaveLength(0);
    });
  });
});
