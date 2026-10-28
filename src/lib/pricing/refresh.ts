import { parseProductPage } from './parse';

export type PriceStatus = 'ok' | 'changed_big' | 'out_of_stock' | 'delisted' | 'error';

export interface PriceEntry {
  price_pence: number;
  checked_at: string;
  /** Last time the product was seen in stock with a sane price. */
  last_ok_at: string | null;
  status: PriceStatus;
  note?: string;
}
export type PriceCache = Record<string, PriceEntry>;

export interface Target { slug: string; url: string; expectedSku: string; knownPence: number }
export interface FetchResult { status: number; url: string; body: string }
export type Fetcher = (url: string) => Promise<FetchResult>;

/** A move bigger than this in one check is held for review rather than trusted. */
export const BIG_MOVE = 0.5;

export function skuFromUrl(url: string) { return url.match(/\/(\d+)\/?(?:\?.*)?$/)?.[1] ?? ''; }

export async function checkProduct(t: Target, prev: PriceEntry | undefined, fetcher: Fetcher, now: Date): Promise<PriceEntry> {
  const checked_at = now.toISOString();
  const base = prev?.price_pence ?? t.knownPence;
  const keep = (status: PriceStatus, note: string): PriceEntry =>
    ({ price_pence: base, checked_at, last_ok_at: prev?.last_ok_at ?? null, status, note });

  let res: FetchResult;
  try { res = await fetcher(t.url); } catch (e) { return keep('error', `fetch failed: ${(e as Error).message}`); }

  if (res.status === 404 || res.status === 410) return keep('delisted', `HTTP ${res.status}`);
  if (res.status >= 500 || res.status === 429 || res.status === 403) return keep('error', `HTTP ${res.status}`);
  if (res.status >= 400) return keep('error', `HTTP ${res.status}`);

  const p = parseProductPage(res.body);
  // Silent delisting: page 200s (or redirects to a search/category page) but the product is gone.
  if (!p) return keep('delisted', 'no product data on page');
  if (p.sku && p.sku !== t.expectedSku) return keep('delisted', `page now shows SKU ${p.sku}, expected ${t.expectedSku}`);
  if (p.availability === 'out_of_stock') return { ...keep('out_of_stock', 'out of stock'), price_pence: p.pricePence };
  if (p.pricePence <= 0) return keep('error', 'price is zero');

  const move = Math.abs(p.pricePence - base) / base;
  if (move > BIG_MOVE) return { ...keep('changed_big', `moved ${Math.round(move * 100)}% (${base}p → ${p.pricePence}p); held for review`) };
  return { price_pence: p.pricePence, checked_at, last_ok_at: checked_at, status: 'ok' };
}

export type StaleLevel = 'fresh' | 'aging' | 'stale';
export const FRESH_HOURS = 36;
export const STALE_HOURS = 96;

export function staleness(checkedAt: string | null, now = new Date()): StaleLevel {
  if (!checkedAt) return 'stale';
  const h = (now.getTime() - new Date(checkedAt).getTime()) / 36e5;
  return h <= FRESH_HOURS ? 'fresh' : h <= STALE_HOURS ? 'aging' : 'stale';
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const shortDate = (iso: string) => { const d = new Date(iso); return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`; };

/** "≈ £42.10 · Morrisons prices checked 23 Oct" with a warning once data gets old. */
export function describeEstimate(totalPence: number, checkedAt: string | null, now = new Date(), storeName = 'Morrisons') {
  const level = staleness(checkedAt, now);
  const money = '£' + (totalPence / 100).toFixed(2);
  const when = checkedAt ? `checked ${shortDate(checkedAt)}` : 'not yet checked';
  return {
    level,
    text: `≈ ${money} · estimated ${storeName} prices, ${when}`,
    warning: level === 'stale' ? `These prices may be out of date. Check them at ${storeName} before you buy.` : null,
  };
}
