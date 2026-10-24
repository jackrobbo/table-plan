import { describe, expect, it, vi } from 'vitest';
import { deleteStripeCustomer } from '@/lib/billing/server';
import { deleteAccount, exportAccount, type AccountStore } from '@/lib/server/account';

const user = { id: 'u1', email: 'jo@example.com' };
const env = { STRIPE_SECRET_KEY: 'sk_test_x' };
const stripe = (status: number, body: unknown = { id: 'cus_1', deleted: true }) =>
  vi.fn(async () => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })) as unknown as typeof fetch;

function store(over: Partial<AccountStore> = {}, calls: string[] = []): AccountStore & { calls: string[] } {
  return {
    calls,
    stripeCustomerId: async () => 'cus_1',
    exportData: async () => ({ profile: { goal: 'lose' }, subscription: null, feedback: [], waitlist: null, invite: null }),
    deleteData: async () => { calls.push('data'); },
    deleteUser: async () => { calls.push('user'); },
    ...over,
  };
}

describe('deleting an account', () => {
  it('needs a signed-in person and a configured database', async () => {
    expect((await deleteAccount({ user: null, store: store(), env })).status).toBe(401);
    expect((await deleteAccount({ user, store: null, env })).status).toBe(501);
  });

  it('cancels billing first, then removes data, then the login', async () => {
    const calls: string[] = [];
    const f = stripe(200);
    const r = await deleteAccount({ user, store: store({}, calls), env, fetchImpl: f });
    expect(r).toEqual({ status: 200, body: { ok: true } });
    expect(calls).toEqual(['data', 'user']);
    const [url, init] = (f as unknown as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.stripe.com/v1/customers/cus_1');
    expect(init.method).toBe('DELETE');
  });

  it('deletes nothing if it cannot confirm the subscription is cancelled', async () => {
    const calls: string[] = [];
    const r = await deleteAccount({ user, store: store({}, calls), env, fetchImpl: stripe(500, { error: { message: 'boom' } }) });
    expect(r.status).toBe(502);
    expect(calls).toEqual([]);
    const noKey = await deleteAccount({ user, store: store({}, calls), env: {} });
    expect(noKey.status).toBe(502);
    expect(calls).toEqual([]);
  });

  it('carries on when the Stripe customer is already gone, or there never was one', async () => {
    const calls: string[] = [];
    expect((await deleteAccount({ user, store: store({}, calls), env, fetchImpl: stripe(404, { error: { code: 'resource_missing' } }) })).status).toBe(200);
    const f = stripe(200);
    expect((await deleteAccount({ user, store: store({ stripeCustomerId: async () => undefined }, calls), env, fetchImpl: f })).status).toBe(200);
    expect(f).not.toHaveBeenCalled();
    expect(calls).toEqual(['data', 'user', 'data', 'user']);
  });

  it('can be retried after a partial failure', async () => {
    let failOnce = true;
    const calls: string[] = [];
    const s = store({ deleteUser: async () => { if (failOnce) { failOnce = false; throw new Error('db down'); } calls.push('user'); } }, calls);
    const first = await deleteAccount({ user, store: s, env, fetchImpl: stripe(200) });
    expect(first.status).toBe(500);
    expect(String(first.body.error)).toMatch(/cancelled/);
    // second attempt: Stripe says the customer is already deleted (404), and the rest completes
    const second = await deleteAccount({ user, store: s, env, fetchImpl: stripe(404) });
    expect(second.status).toBe(200);
    expect(calls).toEqual(['data', 'data', 'user']);
  });
});

describe('Stripe customer deletion', () => {
  it('reports what happened without ever throwing', async () => {
    expect(await deleteStripeCustomer({ customerId: 'cus_1', env, fetchImpl: stripe(200) })).toBe('deleted');
    expect(await deleteStripeCustomer({ customerId: 'cus_1', env, fetchImpl: stripe(404) })).toBe('none');
    expect(await deleteStripeCustomer({ customerId: 'cus_1', env, fetchImpl: stripe(200, { deleted: false }) })).toBe('failed');
    expect(await deleteStripeCustomer({ customerId: 'cus_1', env: {} })).toBe('failed');
    expect(await deleteStripeCustomer({ customerId: 'cus_1', env, fetchImpl: (async () => { throw new Error('offline'); }) as unknown as typeof fetch })).toBe('failed');
  });
});

describe('exporting your data', () => {
  it('needs a signed-in person', async () => {
    expect((await exportAccount({ user: null, store: store() })).status).toBe(401);
  });
  it('returns what we hold, labelled with who and when', async () => {
    const r = await exportAccount({ user, store: store(), now: new Date('2026-10-24T12:00:00Z') });
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ exportedAt: '2026-10-24T12:00:00.000Z', account: { id: 'u1', email: 'jo@example.com' }, profile: { goal: 'lose' }, feedback: [] });
  });
});
