import type { Product, Recipe } from '@/data';

/**
 * The price book the app reads from the database (tables written by the weekly feed: supabase/migrations/0009_price_feed.sql).
 * The server shapes it (`shapeSnapshot`); the browser applies it over the bundled data (`applySnapshot`). Everything here is pure.
 *
 * Rules that keep a bad feed from reaching people:
 * - a price that moved more than 50% from the bundled one is ignored (the feed holds such rows too);
 * - a product whose pack size differs from the bundled one is ignored (the database and the bundle disagree about the product);
 * - a snapshot older than the bundled prices is ignored;
 * - anything malformed is ignored and the bundled value stays.
 */
export type Tier = 'low' | 'medium' | 'high';

export interface PriceSnapshot {
  store: string;
  /** When the vendor priced these (ISO): the newest price in the snapshot. */
  asOf: string;
  /** By ingredient slug: [price in pence now, regular price when an offer is on, in stock, pack size the price is for]. */
  products: Record<string, [number, number | null, boolean | null, number | null]>;
  /** By recipe slug: [cost of one portion in pence at regular prices, budget tier]. */
  costs: Record<string, [number, Tier | null]>;
}

export interface PriceTarget {
  products: Record<string, Product>;
  recipes: Recipe[];
  meta: { checkedAt: string | null; oldestCheckAt: string | null; unavailable: string[]; heldForReview: string[] };
}

const TIERS = new Set(['low', 'medium', 'high']);

/** A snapshot from the network, checked field by field. Null if it is not usable at all. */
export function parseSnapshot(x: unknown): PriceSnapshot | null {
  if (!x || typeof x !== 'object') return null;
  const o = x as Record<string, unknown>;
  if (typeof o.store !== 'string' || typeof o.asOf !== 'string' || Number.isNaN(Date.parse(o.asOf))) return null;
  if (!o.products || typeof o.products !== 'object' || !o.costs || typeof o.costs !== 'object') return null;
  const products: PriceSnapshot['products'] = {};
  for (const [k, v] of Object.entries(o.products as Record<string, unknown>)) {
    if (!Array.isArray(v) || !Number.isInteger(v[0]) || (v[0] as number) <= 0) continue;
    products[k] = [v[0] as number, Number.isInteger(v[1]) && (v[1] as number) > 0 ? (v[1] as number) : null, typeof v[2] === 'boolean' ? v[2] : null, typeof v[3] === 'number' && v[3] > 0 ? v[3] : null];
  }
  const costs: PriceSnapshot['costs'] = {};
  for (const [k, v] of Object.entries(o.costs as Record<string, unknown>)) {
    if (!Array.isArray(v) || !Number.isInteger(v[0]) || (v[0] as number) < 0) continue;
    costs[k] = [v[0] as number, typeof v[1] === 'string' && TIERS.has(v[1]) ? (v[1] as Tier) : null];
  }
  return { store: o.store, asOf: o.asOf, products, costs };
}

export interface Applied { prices: number; costs: number; outOfStock: number; skipped: string[]; ignored?: 'older' }

/** Overlays a snapshot on the bundled catalogue, in place. Returns what changed, so the caller can log or test it. */
export function applySnapshot(snap: PriceSnapshot, t: PriceTarget): Applied {
  const out: Applied = { prices: 0, costs: 0, outOfStock: 0, skipped: [] };
  const bundled = t.meta.checkedAt ? Date.parse(t.meta.checkedAt) : 0;
  if (Date.parse(snap.asOf) < bundled) return { ...out, ignored: 'older' };

  const unavailable = new Set<string>();
  for (const [slug, [price, , inStock, pack]] of Object.entries(snap.products)) {
    const p = t.products[slug];
    if (!p) continue;
    if (pack != null && p.pack !== pack) { out.skipped.push(`${slug}: pack size differs`); continue; }
    if (p.pr > 0 && Math.abs(price - p.pr) / p.pr > 0.5) { out.skipped.push(`${slug}: moved over 50%`); continue; }
    if (p.pr !== price) out.prices++;
    p.pr = price;
    if (inStock === false) { p.st = 'out_of_stock'; unavailable.add(slug); out.outOfStock++; }
    else if (p.st === 'out_of_stock') delete p.st;
  }

  const byId = new Map(t.recipes.map((r) => [r.id, r]));
  for (const [slug, [cost, tier]] of Object.entries(snap.costs)) {
    const r = byId.get(slug);
    if (!r || r.macros_only) continue;
    if (r.cost !== cost || (tier && r.b !== tier)) out.costs++;
    r.cost = cost;
    if (tier) r.b = tier;
  }

  // The items to warn about are whatever is flagged out of stock or delisted after the overlay.
  void unavailable;
  t.meta.unavailable = Object.entries(t.products).filter(([, p]) => p.st === 'out_of_stock' || p.st === 'delisted').map(([k]) => k);
  t.meta.checkedAt = snap.asOf;
  t.meta.oldestCheckAt = snap.asOf;
  return out;
}

export interface SnapshotRows {
  store: string;
  /** store_products rows: our ingredient slug and the retailer's product ref, with the pack size we hold. */
  products: { ingredient_slug: string; product_ref: string; pack_size: number | string | null }[];
  /** latest_prices rows for the store. */
  prices: { product_ref: string; price_pence: number; was_price_pence: number | null; in_stock: boolean | null; priced_at: string }[];
  /** recipe_costs rows for the store. */
  costs: { recipe_slug: string; cost_pence: number | null; budget_tier: string | null; complete: boolean }[];
}

/** Server side: the database rows shaped into the compact snapshot the browser reads. Null when there is nothing priced yet. */
export function shapeSnapshot(r: SnapshotRows): PriceSnapshot | null {
  const price = new Map(r.prices.map((p) => [p.product_ref, p]));
  const products: PriceSnapshot['products'] = {};
  let newest = 0;
  for (const sp of r.products) {
    const p = price.get(sp.product_ref);
    if (!p) continue;
    const size = sp.pack_size == null ? null : Number(sp.pack_size);
    products[sp.ingredient_slug] = [p.price_pence, p.was_price_pence, p.in_stock, size != null && Number.isFinite(size) && size > 0 ? size : null];
    newest = Math.max(newest, Date.parse(p.priced_at));
  }
  if (!Object.keys(products).length || !newest) return null;
  const costs: PriceSnapshot['costs'] = {};
  for (const c of r.costs) if (c.complete && c.cost_pence != null) costs[c.recipe_slug] = [c.cost_pence, TIERS.has(c.budget_tier ?? '') ? (c.budget_tier as Tier) : null];
  return { store: r.store, asOf: new Date(newest).toISOString(), products, costs };
}
