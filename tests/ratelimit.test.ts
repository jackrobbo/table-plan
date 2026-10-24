import { beforeEach, describe, expect, it } from 'vitest';
import { clientIp, limited, resetRateLimits } from '@/lib/server/rateLimit';

beforeEach(() => resetRateLimits());

describe('rate limiting', () => {
  it('lets a caller through up to the limit, then stops them until the window passes', () => {
    const t0 = 1_000_000;
    for (let i = 0; i < 3; i++) expect(limited('a', 3, 60_000, t0 + i)).toBe(false);
    expect(limited('a', 3, 60_000, t0 + 10)).toBe(true);
    expect(limited('a', 3, 60_000, t0 + 59_000)).toBe(true);
    expect(limited('a', 3, 60_000, t0 + 61_000)).toBe(false);
  });
  it('keeps callers apart', () => {
    expect(limited('a', 1, 60_000, 1)).toBe(false);
    expect(limited('a', 1, 60_000, 2)).toBe(true);
    expect(limited('b', 1, 60_000, 3)).toBe(false);
  });
  it('trusts the address Vercel reports, not one the client makes up', () => {
    const req = (h: Record<string, string>) => new Request('https://x.test/', { headers: h });
    expect(clientIp(req({ 'x-vercel-forwarded-for': '1.2.3.4', 'x-forwarded-for': '9.9.9.9' }))).toBe('1.2.3.4');
    expect(clientIp(req({ 'x-forwarded-for': '5.6.7.8, 10.0.0.1' }))).toBe('5.6.7.8');
    expect(clientIp(req({}))).toBe('unknown');
  });
});
