/**
 * Best-effort request limiter for our public API routes. State is per server instance, so it blunts a script hammering one route
 * (invite guessing, sign-up or waitlist spam) but is not an exact global count: the Vercel Firewall rule in design/security.md is
 * the hard limit. Fails closed for the caller who has used up their allowance, open for everyone else.
 */
const hits = new Map<string, number[]>();
let lastSweep = 0;

export function limited(key: string, limit: number, windowMs: number, now = Date.now()): boolean {
  if (now - lastSweep > 60_000) {
    lastSweep = now;
    for (const [k, v] of hits) if (!v.length || now - v[v.length - 1] > 10 * 60_000) hits.delete(k);
  }
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= limit) { hits.set(key, recent); return true; }
  recent.push(now);
  hits.set(key, recent);
  return false;
}

/** The caller's address as Vercel reports it (it sets these itself, so a client can't choose its own). */
export function clientIp(req: Request): string {
  const h = req.headers;
  return (h.get('x-vercel-forwarded-for') ?? h.get('x-real-ip') ?? h.get('x-forwarded-for')?.split(',')[0] ?? 'unknown').trim();
}

export const tooMany = () => Response.json({ error: 'Too many requests. Please wait a minute and try again.' }, { status: 429, headers: { 'Retry-After': '60', 'Cache-Control': 'no-store' } });

export const resetRateLimits = () => hits.clear();
