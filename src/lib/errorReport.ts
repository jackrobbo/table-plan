/** What we keep from a browser error: where it happened and what it was, never who it happened to. */
export interface ErrorReport { kind: 'error' | 'rejection' | 'boundary'; message: string; stack: string; page: string; build: string }

const clip = (v: unknown, n: number) => (typeof v === 'string' ? v : '').replace(/\s+/g, ' ').slice(0, n);

/** Scrubs a client-supplied report to a small, fixed shape. Anything unexpected is dropped; emails and long tokens are blanked out. */
export function shapeReport(body: unknown): ErrorReport | null {
  if (!body || typeof body !== 'object') return null;
  const b = body as Record<string, unknown>;
  const message = clip(b.message, 300);
  if (!message) return null;
  const scrub = (s: string) => s.replace(/[^\s@]+@[^\s@]+\.[^\s@]+/g, '[email]').replace(/[A-Za-z0-9_-]{32,}/g, '[token]');
  const kind = b.kind === 'rejection' || b.kind === 'boundary' ? b.kind : 'error';
  const page = clip(b.page, 80).split(/[?#]/)[0];
  return { kind, message: scrub(message), stack: scrub(clip(b.stack, 1200)), page, build: clip(b.build, 40) };
}

/** Browser side: sends a report without waiting, at most a handful per page load, and never throws. */
let sent = 0;
const seen = new Set<string>();
export function reportError(kind: ErrorReport['kind'], err: unknown) {
  try {
    if (sent >= 5) return;
    const e = err as { message?: unknown; stack?: unknown } | string | null;
    const message = typeof e === 'string' ? e : String(e?.message ?? err ?? '');
    const key = kind + message;
    if (!message || seen.has(key)) return;
    seen.add(key); sent++;
    const body = JSON.stringify({ kind, message, stack: typeof e === 'object' && e ? e.stack : '', page: location.pathname, build: process.env.NEXT_PUBLIC_BUILD ?? '' });
    if (!navigator.sendBeacon?.('/api/client-error', new Blob([body], { type: 'application/json' }))) void fetch('/api/client-error', { method: 'POST', headers: { 'content-type': 'application/json' }, body, keepalive: true });
  } catch { /* reporting must never cause the next error */ }
}
