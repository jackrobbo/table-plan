// npm run feed -- [--probe] [--go] [--stores morrisons,tesco,sainsburys,asda] [--mock-<store> file]
//
// STAGE 1 of the weekly price feed: a dry run that never touches the app or the database.
// It asks Yappman for today's prices for the products we hold, saves a snapshot, and writes a report that says whether the
// feed is accurate and complete enough to build on.
//   every store   product mode: one call per store with the exact product pages we hold (about $0.2 for 90 products). Morrisons uses
//                 our mapped pages; Tesco, Sainsbury's and Asda use the products we CONFIRMED in the matching tool.
// Why not the basket endpoint? It matches by name, so it can hand back a different product each week (a dry run on saved answers
// showed halloumi becoming halloumi fries). The weekly feed must price exactly the product we confirmed, so it asks by page.
// It checks, per store: coverage (did every product we expect come back), duplicates, impossible or missing prices, price moves
// over 50% against what we last saw (held for review), size changes, out-of-stock and old vendor prices. --probe sends just 3
// products per store first (about 2 pence) so you can see the shape of the answers before paying for a full run.
// Output goes to content/feed/ (gitignored: vendor data stays on this machine).
//
// Without --go it prints the plan and the most it can cost and sends nothing.
// Needs APIFY_TOKEN in your own terminal (never in a file or in chat). The token is only ever sent in a request header and is never printed.
//   APIFY_TOKEN="$(pbpaste)" npm run feed -- --probe --go
import fs from 'node:fs';
import path from 'node:path';
import type { IngredientDef } from '../src/lib/content/types';

export type FeedStore = 'morrisons' | 'tesco' | 'sainsburys' | 'asda';
export const FEED_STORES: FeedStore[] = ['morrisons', 'tesco', 'sainsburys', 'asda'];
const OTHER: Exclude<FeedStore, 'morrisons'>[] = ['tesco', 'sainsburys', 'asda'];
const ACTOR = 'yappman~uk-supermarket-price-scraper';
const MORRISONS_BASE = 'https://groceries.morrisons.com/products/';
const OUT_DIR = 'content/feed';
/** Dollars: Yappman's published rates (Apify Free plan): $0.005 per run + $0.0025 per product row. */
export const RATES = { run: 0.005, row: 0.0025, basketLine: 0.002 };

/** One normalised price row. Prices are integer pence. */
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
  pricedAt: string | null;      // when the vendor priced it (their snapshot time), ISO
  askedFor?: string;            // our ingredient slug, when known
}

const pence = (x: unknown): number | null => { const n = Number(x); return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : null; };
const str = (x: unknown): string | null => (typeof x === 'string' && x.trim() ? x.trim() : null);

/** The last path segment of a Morrisons product slug ("morrisons-red-pesto-190g/104557698" -> "104557698"). */
export const morrisonsId = (slugOrUrl: string): string => slugOrUrl.replace(/\/+$/, '').split('/').pop() ?? '';

/** The product pages we price for Morrisons: every product ingredient, in file order. */
export function morrisonsTargets(ing: IngredientDef[]): { ref: string; url: string; slug: string }[] {
  return ing.filter((i) => i.product?.slug && !i.cupboard).map((i) => ({ ref: morrisonsId(i.product!.slug), url: MORRISONS_BASE + i.product!.slug, slug: i.slug }));
}

/** The product page the feed asks for, per store. Tesco's is built from the id; for the others we only use pages seen in earlier answers. */
export function otherStoreUrl(store: Exclude<FeedStore, 'morrisons'>, ref: string, seen: Record<string, string> = {}): string | null {
  if (seen[ref]) return seen[ref];
  if (store === 'tesco' && /^\d{6,10}$/.test(ref)) return `https://www.tesco.com/shop/en-GB/products/${ref}`;
  return null;
}

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

/** Compares what came back with what we expected. Pure, so it can be tested without a network. */
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

/** Maximum spend for the planned calls, in dollars. */
export function estimateCost(counts: { morrisonsRows: number; basketLines: number; stores: number }): number {
  return (counts.morrisonsRows ? RATES.run + counts.morrisonsRows * RATES.row : 0) + counts.basketLines * counts.stores * RATES.basketLine;
}

// ---------------------------------------------------------------- running it
const args = process.argv.slice(2);
const flag = (k: string) => args.includes(`--${k}`);
const opt = (k: string) => { const i = args.indexOf(`--${k}`); return i >= 0 ? args[i + 1] : undefined; };
const readJson = <T>(f: string, fallback: T): T => (fs.existsSync(f) ? (JSON.parse(fs.readFileSync(f, 'utf8')) as T) : fallback);

async function callApify(token: string, pathAndQuery: string, body: unknown, timeoutMs = 290_000): Promise<unknown> {
  const r = await fetch(`https://api.apify.com/v2/${pathAndQuery}`, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` }, body: JSON.stringify(body), signal: AbortSignal.timeout(timeoutMs) });
  const text = await r.text();
  if (!r.ok) throw new Error(`Apify call failed: HTTP ${r.status} ${text.slice(0, 200).replace(/apify_api_[A-Za-z0-9]+/g, '***')}`);
  return JSON.parse(text);
}

type Planned = { ref: string; slug: string; url: string; name?: string; lastPricePence?: number | null };

async function main() {
  const ing = readJson<IngredientDef[]>('content/ingredients.json', []);
  const wanted = (opt('stores')?.split(',') ?? FEED_STORES).filter((s): s is FeedStore => (FEED_STORES as string[]).includes(s));
  const prices = readJson<Record<string, { price_pence?: number }>>('content/prices.json', {});
  const probe = flag('probe');
  const cap = <T,>(xs: T[]) => (probe ? xs.slice(0, 3) : xs);

  // What we expect back, per store.
  const plan: Partial<Record<FeedStore, Planned[]>> = {};
  const skipped: string[] = [];
  if (wanted.includes('morrisons')) {
    plan.morrisons = cap(morrisonsTargets(ing).map((t) => { const i = ing.find((x) => x.slug === t.slug)!; return { ...t, name: i.product!.name, lastPricePence: prices[t.slug]?.price_pence ?? i.product!.price_pence }; }));
  }
  for (const s of OTHER.filter((x) => wanted.includes(x))) {
    const state = readJson<{ decisions?: Record<string, { status?: string; row?: { productId?: string; price?: number; name?: string } }> }>(`content/matches/${s}.json`, {});
    const rawFile = readJson<Record<string, unknown>[]>(`content/matches/raw/yappman-${s}.json`, []);
    const seen: Record<string, string> = {};
    for (const r of rawFile) if (typeof r.url === 'string') seen[String(r.retailerProductId)] = r.url;
    const list: Planned[] = [];
    for (const [slug, d] of Object.entries(state.decisions ?? {})) {
      if (d.status !== 'confirmed' || !d.row?.productId) continue;
      const ref = String(d.row.productId), url = otherStoreUrl(s, ref, seen);
      if (!url) { skipped.push(`${s}/${slug}: no product page address known yet`); continue; }
      list.push({ ref, slug, url, name: d.row.name, lastPricePence: d.row.price ?? null });
    }
    plan[s] = cap(list);
  }
  const lists = Object.entries(plan) as [FeedStore, Planned[]][];
  const rowsPlanned = lists.reduce((a, [, l]) => a + l.length, 0);
  const calls = lists.filter(([, l]) => l.length).length;
  const maxUsd = calls * RATES.run + rowsPlanned * RATES.row;
  console.log(`Plan${probe ? ' (probe: 3 products per store)' : ''}: ${lists.map(([s, l]) => `${s} ${l.length}`).join(', ')}.${skipped.length ? ` ${skipped.length} confirmed matches have no page address yet.` : ''}`);
  console.log(`Most it can cost: $${maxUsd.toFixed(2)} in ${calls} call${calls === 1 ? '' : 's'}.`);
  const mocks: Record<FeedStore, string | undefined> = { morrisons: opt('mock-morrisons'), tesco: opt('mock-tesco'), sainsburys: opt('mock-sainsburys'), asda: opt('mock-asda') };
  const anyMock = Object.values(mocks).some(Boolean);
  const token = process.env.APIFY_TOKEN;
  if (!flag('go') && !anyMock) { console.log('Nothing sent. Add --go (and APIFY_TOKEN) to run it for real, or --mock-<store> <file> to test on a saved answer.'); return; }
  if (flag('go') && !token && !anyMock) throw new Error('Set APIFY_TOKEN in this terminal first (never put it in a file or in chat).');

  const date = new Date().toISOString().slice(0, 10) + (probe ? '-probe' : '');
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const all: FeedRow[] = [];
  const issues: Issue[] = [];
  const stat: string[] = [];
  for (const [store, list] of lists) {
    if (!list.length) { stat.push(`| ${store} | 0 | n/a | n/a | n/a (nothing confirmed yet) |`); continue; }
    const mock = mocks[store];
    const raw = mock
      ? readJson<Record<string, unknown>[]>(mock, [])
      : ((await callApify(token!, `acts/${ACTOR}/run-sync-get-dataset-items`, { mode: 'product', productUrls: list.map((t) => t.url), maxItems: list.length })) as Record<string, unknown>[]);
    fs.writeFileSync(path.join(OUT_DIR, `${date}-${store}-raw.json`), JSON.stringify(raw, null, 1) + '\n');
    const rows = raw.map((o) => normaliseRow(store, o)).filter((r): r is FeedRow => !!r);
    all.push(...rows);
    const v = validateRows(store, rows, list.map((t) => ({ ref: t.ref, slug: t.slug, name: t.name, lastPricePence: t.lastPricePence })));
    issues.push(...v.issues);
    stat.push(`| ${store} | ${list.length} | ${rows.length} | ${v.matched} | ${(v.coverage * 100).toFixed(0)}% |`);
  }
  for (const t of skipped) issues.push({ level: 'info', store: 'tesco', text: t });
  fs.writeFileSync(path.join(OUT_DIR, `${date}-snapshot.json`), JSON.stringify({ date, rows: all }, null, 1) + '\n');
  const lines: string[] = [`# Feed dry run ${date}`, '', '| Store | Expected | Rows back | Matched | Coverage |', '|---|---|---|---|---|', ...stat, ''];
  const by = (l: Issue['level']) => issues.filter((i) => i.level === l);
  lines.push(`Errors ${by('error').length}, warnings ${by('warn').length}, notes ${by('info').length}.`, '');
  for (const lvl of ['error', 'warn', 'info'] as const) {
    if (by(lvl).length) lines.push(`## ${lvl === 'error' ? 'Errors (would be held for review)' : lvl === 'warn' ? 'Warnings' : 'Notes'}`, ...by(lvl).map((i) => `- [${i.store}] ${i.text}`), '');
  }
  const report = lines.join('\n');
  fs.writeFileSync(path.join(OUT_DIR, `${date}-report.md`), report + '\n');
  console.log('\n' + report);
  console.log(`Saved: ${OUT_DIR}/${date}-snapshot.json and ${OUT_DIR}/${date}-report.md (gitignored).`);
}

if (process.argv[1] && /yappman-feed\.ts$/.test(process.argv[1])) main().catch((e) => { console.error(String(e.message ?? e)); process.exit(1); });
