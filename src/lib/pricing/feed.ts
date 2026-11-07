/**
 * Reading and checking rows from the price feed (Yappman, product mode). Pure functions, shared by the dry-run script
 * (scripts/yappman-feed.ts) and the weekly job on the server (src/lib/server/feed.ts), so both apply exactly the same checks.
 * Prices are integer pence.
 */
export type FeedStore = 'morrisons' | 'tesco' | 'sainsburys' | 'asda';

/** One normalised price row. */
export interface FeedRow {
  store: FeedStore;
  productRef: string;           // the retailer's own product id (Morrisons: the number at the end of our product slug)
  name: string;
  pricePence: number;
  wasPricePence: number | null;
  loyaltyPricePence: number | null;
  promoText: string | null;
  inStock: boolean | null;
  packSize: string | null;
  url: string | null;
  pricedAt: string | null;      // when the vendor priced it, ISO
  askedFor?: string;            // our ingredient slug, when known
}

const pence = (x: unknown): number | null => { const n = Number(x); return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : null; };
const str = (x: unknown): string | null => (typeof x === 'string' && x.trim() ? x.trim() : null);

/** The last path segment of a Morrisons product slug ("morrisons-red-pesto-190g/104557698" -> "104557698"). */
export const morrisonsId = (slugOrUrl: string): string => slugOrUrl.replace(/\/+$/, '').split('/').pop() ?? '';

/** A Yappman product-mode row into our shape. Returns null for rows we cannot use. */
export function normaliseRow(store: FeedStore, o: Record<string, unknown>, askedFor?: string): FeedRow | null {
  const price = pence(o.price);
  const ref = String(o.retailerProductId ?? '').trim() || (typeof o.url === 'string' ? morrisonsId(o.url) : '');
  if (!ref || price == null) return null;
  const loyalty = o.loyaltyPrice != null ? pence(o.loyaltyPrice) : null;
  return {
    store, productRef: ref, name: String(o.name ?? ''), pricePence: price, wasPricePence: o.wasPrice != null ? pence(o.wasPrice) : null,
    loyaltyPricePence: loyalty, promoText: str(o.promotionText) ?? str(o.promotion), inStock: typeof o.inStock === 'boolean' ? o.inStock : null,
    packSize: str(o.packSize), url: str(o.url), pricedAt: str(o.pricedAt) ?? str(o.scrapedAt), askedFor,
  };
}

export interface Issue { level: 'error' | 'warn' | 'info'; store: FeedStore; ref?: string; slug?: string; text: string }
export interface Expected { ref: string; slug: string; name?: string; lastPricePence?: number | null; lastPackSize?: string | null }

/** Compares what came back with what we expected. Errors are rows that must be held back; warnings are worth a look. */
export function validateRows(store: FeedStore, rows: FeedRow[], expected: Expected[], opts: { now?: Date; maxAgeDays?: number } = {}): { issues: Issue[]; coverage: number; matched: number } {
  const issues: Issue[] = [];
  const now = opts.now ?? new Date();
  const maxAge = opts.maxAgeDays ?? 8;
  const byRef = new Map<string, FeedRow[]>();
  for (const r of rows) byRef.set(r.productRef, [...(byRef.get(r.productRef) ?? []), r]);
  let matched = 0;
  for (const e of expected) {
    const got = byRef.get(e.ref);
    if (!got?.length) { issues.push({ level: 'error', store, ref: e.ref, slug: e.slug, text: `missing from the feed: ${e.slug}${e.name ? ` (${e.name})` : ''}` }); continue; }
    matched++;
    if (got.length > 1) issues.push({ level: 'warn', store, ref: e.ref, slug: e.slug, text: `${got.length} rows for the same product (${e.slug})` });
    const r = got[0];
    if (r.inStock === false) issues.push({ level: 'warn', store, ref: e.ref, slug: e.slug, text: `out of stock: ${e.slug}` });
    if (e.lastPricePence && e.lastPricePence > 0) {
      const move = (r.pricePence - e.lastPricePence) / e.lastPricePence;
      if (Math.abs(move) > 0.5) issues.push({ level: 'error', store, ref: e.ref, slug: e.slug, text: `price moved ${(move * 100).toFixed(0)}%: ${e.slug} ${e.lastPricePence}p -> ${r.pricePence}p (held for review)` });
      else if (Math.abs(move) > 0.15) issues.push({ level: 'warn', store, ref: e.ref, slug: e.slug, text: `price moved ${(move * 100).toFixed(0)}%: ${e.slug} ${e.lastPricePence}p -> ${r.pricePence}p` });
    }
    if (e.lastPackSize && r.packSize && e.lastPackSize.replace(/\s/g, '').toLowerCase() !== r.packSize.replace(/\s/g, '').toLowerCase())
      issues.push({ level: 'warn', store, ref: e.ref, slug: e.slug, text: `pack size changed: ${e.slug} ${e.lastPackSize} -> ${r.packSize}` });
    if (r.pricedAt) {
      const days = (now.getTime() - new Date(r.pricedAt).getTime()) / 86_400_000;
      if (days > maxAge) issues.push({ level: 'warn', store, ref: e.ref, slug: e.slug, text: `vendor price is ${days.toFixed(0)} days old: ${e.slug}` });
    }
  }
  const wanted = new Set(expected.map((e) => e.ref));
  const extra = rows.filter((r) => !wanted.has(r.productRef)).length;
  if (extra) issues.push({ level: 'info', store, text: `${extra} rows came back for products we did not ask for (ignored)` });
  return { issues, coverage: expected.length ? matched / expected.length : 1, matched };
}

/** For name-based matching: does the feed still hand back the product we confirmed for each ingredient? (Used when discovering matches, not in the weekly run.) */
export function matchStability(store: FeedStore, rows: FeedRow[], confirmed: Record<string, string>): Issue[] {
  const out: Issue[] = [];
  for (const r of rows) {
    if (!r.askedFor || !confirmed[r.askedFor]) continue;
    if (confirmed[r.askedFor] !== r.productRef) out.push({ level: 'warn', store, slug: r.askedFor, ref: r.productRef, text: `match drift: ${r.askedFor} now returns ${r.productRef} (${r.name}), we confirmed ${confirmed[r.askedFor]}` });
  }
  return out;
}
