import { AuthApiError, type SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';
import { NO_ACCOUNT, createSupabaseBackend } from '@/lib/db/supabase';
import { startSignup, type SignupStore } from '@/lib/server/signup';

function fake(over: Partial<SignupStore> = {}) {
  const used = new Map<string, string>();   // code -> email
  const log: string[] = [];
  const store: SignupStore = {
    redeem: async (code, email) => { log.push(`redeem ${code}`); if (code !== 'ABCDEFGHJKMN' || used.has(code)) return false; used.set(code, email); return true; },
    release: async (code, email) => { log.push(`release ${code}`); if (used.get(code) === email) used.delete(code); },
    createUser: async () => { log.push('create'); return 'created'; },
    ...over,
  };
  return { store, used, log };
}
const go = (body: unknown, store: SignupStore | null, inviteRequired = true) => startSignup({ body, store, inviteRequired });

describe('creating an account (server side)', () => {
  it('needs the server configured and a valid email', async () => {
    expect((await go({ email: 'a@b.co' }, null)).status).toBe(503);
    expect((await go({ email: 'nope', invite: 'ABCD-EFGH-JKMN' }, fake().store)).status).toBe(400);
    expect((await go(null, fake().store)).status).toBe(400);
  });

  it('while invite-only: no valid code, no account', async () => {
    const f = fake();
    expect((await go({ email: 'a@b.co' }, f.store)).status).toBe(400);
    expect((await go({ email: 'a@b.co', invite: 'wrong' }, f.store)).status).toBe(400);
    expect((await go({ email: 'a@b.co', invite: 'ZZZZ-ZZZZ-ZZZZ' }, f.store)).status).toBe(400);   // well-formed but unknown
    expect(f.log).toEqual(['redeem ZZZZZZZZZZZZ']);
    expect(f.log).not.toContain('create');
  });

  it('spends the code and creates the account, once', async () => {
    const f = fake();
    const r = await go({ email: ' Jo@Example.com ', invite: 'abcd-efgh-jkmn' }, f.store);
    expect(r).toEqual({ status: 200, body: { ok: true } });
    expect(f.used.get('ABCDEFGHJKMN')).toBe('jo@example.com');
    expect((await go({ email: 'other@example.com', invite: 'ABCD-EFGH-JKMN' }, f.store)).status).toBe(400);   // already used
  });

  it('gives the code back when the account already existed, and carries on to the sign-in code', async () => {
    const f = fake({ createUser: async () => 'exists' });
    expect(await go({ email: 'a@b.co', invite: 'ABCD-EFGH-JKMN' }, f.store)).toEqual({ status: 200, body: { ok: true } });
    expect(f.used.size).toBe(0);
  });

  it('gives the code back when the account could not be made', async () => {
    const f = fake({ createUser: async () => 'failed' });
    expect((await go({ email: 'a@b.co', invite: 'ABCD-EFGH-JKMN' }, f.store)).status).toBe(502);
    expect(f.used.size).toBe(0);
  });

  it('when the beta is open, no code is needed', async () => {
    const f = fake();
    expect((await go({ email: 'a@b.co' }, f.store, false)).status).toBe(200);
    expect(f.log).toEqual(['create']);
  });
});

describe('signing in never creates an account', () => {
  const client = (error: unknown) => {
    const calls: unknown[] = [];
    return { calls, sb: { auth: { signInWithOtp: async (a: unknown) => { calls.push(a); return { error }; }, onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }) } } as unknown as SupabaseClient };
  };
  it('asks Supabase not to create the user', async () => {
    const c = client(null);
    await createSupabaseBackend(c.sb).auth.sendCode(' Jo@Example.com ');
    expect(c.calls).toEqual([{ email: 'jo@example.com', options: { shouldCreateUser: false } }]);
  });
  it('says so plainly when there is no account for the email', async () => {
    const c = client(new AuthApiError('Signups not allowed for otp', 422, 'otp_disabled'));
    await expect(createSupabaseBackend(c.sb).auth.sendCode('x@y.co')).rejects.toThrow(NO_ACCOUNT);
  });
  it('passes on the rate-limit message', async () => {
    const c = client(new AuthApiError('rate limit', 429, 'over_email_send_rate_limit'));
    await expect(createSupabaseBackend(c.sb).auth.sendCode('x@y.co')).rejects.toThrow(/Too many codes/);
  });
});
