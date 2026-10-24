import { getRateStore } from './context';
import { clientIp, limited } from './rateLimit';

export interface RateStore {
  /** Counts one request against `key`; true once it is over the limit for the window. */
  hit(key: string, limit: number, windowSeconds: number): Promise<boolean>;
}

/** Hashed, so the shared counter never holds anyone's address. */
async function fingerprint(s: string): Promise<string> {
  const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode('table-plan:' + s)));
  return [...bytes.slice(0, 12)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * True when this caller has made too many `name` requests in the window. Uses the shared database counter so it holds across
 * serverless instances; if that is unavailable it falls back to a per-instance count rather than blocking real people.
 */
export async function rateLimited(req: Request, name: string, limit: number, windowSeconds = 60, store: RateStore | null = getRateStore()): Promise<boolean> {
  const key = `${name}:${await fingerprint(clientIp(req))}`;
  if (store) {
    try { return await store.hit(key, limit, windowSeconds); } catch { /* fall through to the local count */ }
  }
  return limited(key, limit, windowSeconds * 1000);
}
