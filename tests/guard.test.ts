import { beforeEach, describe, expect, it } from 'vitest';
import { rateLimited, type RateStore } from '@/lib/server/guard';
import { resetRateLimits } from '@/lib/server/rateLimit';

const req = (ip: string) => new Request('https://x.test/api', { headers: { 'x-vercel-forwarded-for': ip } });
beforeEach(() => resetRateLimits());

describe('shared rate limit', () => {
  it('counts against a hashed key, never the address', async () => {
    const keys: string[] = [];
    const store: RateStore = { hit: async (key) => { keys.push(key); return false; } };
    await rateLimited(req('203.0.113.7'), 'signup', 10, 60, store);
    expect(keys[0]).toMatch(/^signup:[0-9a-f]{24}$/);
    expect(keys[0]).not.toContain('203.0.113.7');
    await rateLimited(req('203.0.113.7'), 'signup', 10, 60, store);
    expect(keys[1]).toBe(keys[0]);
    await rateLimited(req('203.0.113.8'), 'signup', 10, 60, store);
    expect(keys[2]).not.toBe(keys[0]);
  });
  it('says limited when the shared counter says so', async () => {
    const store: RateStore = { hit: async () => true };
    expect(await rateLimited(req('1.1.1.1'), 'waitlist', 10, 60, store)).toBe(true);
  });
  it('falls back to a local count if the shared one is down, rather than blocking everyone', async () => {
    const down: RateStore = { hit: async () => { throw new Error('db down'); } };
    const out: boolean[] = [];
    for (let i = 0; i < 4; i++) out.push(await rateLimited(req('2.2.2.2'), 'x', 3, 60, down));
    expect(out).toEqual([false, false, false, true]);
    expect(await rateLimited(req('9.9.9.9'), 'x', 3, 60, down)).toBe(false);
  });
});
