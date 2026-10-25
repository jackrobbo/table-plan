import { describe, expect, it, vi } from 'vitest';
import { sanitise, track, registerAnalytics, setAnalyticsConsent } from '@/lib/analytics';
import { generateCode, generateCodes, looksLikeCode, normaliseCode, redeemInvite, type InviteStore } from '@/lib/beta/invites';
import { joinWaitlist, type WaitlistStore } from '@/lib/beta/waitlist';

describe('invite codes', () => {
  it('generates readable, unique, well-formed codes', () => {
    const codes = generateCodes(500);
    expect(new Set(codes).size).toBe(500);
    for (const c of codes) { expect(c).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/); expect(c).not.toMatch(/[01OIL]/); expect(looksLikeCode(c)).toBe(true); }
    expect(generateCode(() => 0)).toBe('AAAA-AAAA-AAAA');
  });
  it('normalises whatever people type', () => {
    expect(normaliseCode(' abcd-efgh jkmn ')).toBe('ABCDEFGHJKMN');
    expect(looksLikeCode('nope')).toBe(false);
  });
  it('redeems once, rejects bad/used codes, and reports when invites are off', async () => {
    const used = new Set<string>();
    const store: InviteStore = { redeem: async (code) => { if (code !== 'ABCDEFGHJKMN' || used.has(code)) return false; used.add(code); return true; } };
    expect(await redeemInvite(store, 'abcd-efgh-jkmn', 'a@b.co')).toEqual({ ok: true });
    expect(await redeemInvite(store, 'ABCD-EFGH-JKMN', 'c@d.co')).toEqual({ ok: false, reason: 'used' });
    expect(await redeemInvite(store, 'short', 'a@b.co')).toEqual({ ok: false, reason: 'invalid' });
    expect(await redeemInvite(null, 'ABCD-EFGH-JKMN', 'a@b.co')).toEqual({ ok: false, reason: 'unavailable' });
  });
});

describe('waitlist', () => {
  const mk = () => { const rows: unknown[] = []; const store: WaitlistStore = { add: async (e) => void rows.push(e) }; return { rows, store }; };
  const now = new Date('2026-10-26T10:00:00Z');
  it('stores a consented, lower-cased signup with a consent timestamp', async () => {
    const { rows, store } = mk();
    expect(await joinWaitlist({ body: { email: ' Jo@Example.COM ', consent: true, source: 'page' }, store, now })).toEqual({ status: 200, body: { ok: true } });
    expect(rows).toEqual([{ email: 'jo@example.com', source: 'page', consentAt: now.toISOString() }]);
  });
  it('requires a valid email and explicit consent', async () => {
    const { rows, store } = mk();
    expect((await joinWaitlist({ body: { email: 'nope', consent: true }, store })).status).toBe(400);
    expect((await joinWaitlist({ body: { email: 'a@b.co', consent: false }, store })).status).toBe(400);
    expect((await joinWaitlist({ body: null, store })).status).toBe(400);
    expect(rows).toHaveLength(0);
  });
  it('ignores honeypot bots without storing, and is honest when there is no store', async () => {
    const { rows, store } = mk();
    expect((await joinWaitlist({ body: { email: 'a@b.co', consent: true, company: 'Acme' }, store })).status).toBe(200);
    expect(rows).toHaveLength(0);
    expect((await joinWaitlist({ body: { email: 'a@b.co', consent: true }, store: null })).status).toBe(503);
  });
});

describe('analytics privacy', () => {
  it('drops anything that could identify a person or reveal health data', () => {
    expect(sanitise({ step: 'weight', weightKg: 74, email: 'a@b.co', heightCm: 168, allergies: 'milk', note: 'x@y.z', days_in_band: 5, plan: 'yearly' }))
      .toEqual({ step: 'weight', days_in_band: 5, plan: 'yearly' });
    expect(sanitise({ source: 'someone@example.com' })).toEqual({});
    expect(sanitise({ step: 'a'.repeat(40) })).toEqual({});
  });
  it('does nothing without consent or a provider, and never throws', () => {
    const seen: string[] = [];
    registerAnalytics((n) => { seen.push(n); });
    setAnalyticsConsent(false); track('subscribed'); expect(seen).toEqual([]);
    setAnalyticsConsent(true); track('subscribed', { plan: 'yearly', weightKg: 80 }); expect(seen).toEqual(['subscribed']);
    registerAnalytics(() => { throw new Error('boom'); });
    expect(() => track('subscribed')).not.toThrow();
    registerAnalytics(null); setAnalyticsConsent(false);
  });
});

describe('free beta flag', () => {
  it('is off unless NEXT_PUBLIC_FREE_BETA=1', async () => {
    vi.resetModules();
    delete process.env.NEXT_PUBLIC_FREE_BETA;
    expect((await import('../src/lib/beta/config')).freeBeta).toBe(false);
    vi.resetModules();
    process.env.NEXT_PUBLIC_FREE_BETA = '1';
    expect((await import('../src/lib/beta/config')).freeBeta).toBe(true);
    delete process.env.NEXT_PUBLIC_FREE_BETA;
  });
});
