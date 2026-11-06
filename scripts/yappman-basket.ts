// npm run basket -- [--go] [--dry] [--mock <response.json>]
//
// Asks Yappman's basket endpoint for the closest Tesco / Sainsbury's / Asda product to each of our Morrisons ingredients, in ONE call,
// and saves the answers as price files the matching tool can read:
//   content/matches/raw/yappman-<store>.json      (feed to:  npm run match -- suggest --store <store> --input <file> --source yappman)
//   content/matches/raw/yappman-basket-response.json  (the whole answer, for the record)
// content/matches/ is gitignored on purpose: vendor data stays on this machine.
//
// Needs ONE environment variable, typed by you in your own Terminal panel (never put it in a file or in chat):
//   APIFY_TOKEN          Apify Console > Settings > API & integrations > Personal API tokens > copy
// (YAPPMAN_BASKET_URL is optional: it defaults to the Actor's Standby address. We add /basket.)
//
// Cost: $0.002 per MATCHED line per store, unmatched lines are free (83 ingredients x 3 stores is at most about $0.50).
// Without --go it only prints what it would send. --dry never calls the network. --mock <file> reads a saved response instead.
import fs from 'node:fs';
import path from 'node:path';
import type { IngredientDef } from '../src/lib/content/types';

const STORES = ['tesco', 'sainsburys', 'asda'] as const;
type Store = (typeof STORES)[number];
const PER_LINE_USD = 0.002;
const OUT_DIR = 'content/matches/raw';
/** The Actor's Standby address (public; the token is what is secret). Override with YAPPMAN_BASKET_URL if it ever changes. */
const DEFAULT_URL = 'https://yappman--uk-supermarket-price-scraper.apify.actor';

const args = process.argv.slice(2);
const flag = (k: string) => args.includes(`--${k}`);
const opt = (k: string) => { const i = args.indexOf(`--${k}`); return i >= 0 ? args[i + 1] : undefined; };

export interface BasketItem { name: string; packSize?: string }
export interface MatchedLine { index: number; matched?: { retailerProductId: string; ean?: string[]; name: string; price: number; loyaltyPrice?: number | null; matchedBy?: string; confidence?: number } }
export interface BasketRetailer { retailer: string; available?: boolean; lines?: MatchedLine[]; unmatched?: { index: number; reason?: string }[] }
export interface BasketResponse { retailers?: BasketRetailer[]; charges?: Record<string, number>; snapshot?: { week?: string; pricedAt?: string; ageDays?: number; stale?: boolean } }

/** "1000" + "g" -> "1kg", "500" + "ml" -> "500ml". Counted units (eggs, wraps) get no pack size: the name says it. */
export function packText(size: number, unit: string): string | undefined {
  if (!(size > 0)) return undefined;
  if (unit === 'g') return size >= 1000 && size % 100 === 0 ? `${size / 1000}kg` : `${size}g`;
  if (unit === 'ml') return size >= 1000 && size % 100 === 0 ? `${size / 1000}L` : `${size}ml`;
  return undefined;
}

/** One request line per ingredient we buy as a product, in file order (the response refers to lines by this index). */
export function buildItems(ing: IngredientDef[]): { items: BasketItem[]; slugs: string[] } {
  const items: BasketItem[] = [], slugs: string[] = [];
  for (const i of ing) {
    if (!i.product || i.cupboard) continue;
    const packSize = packText(i.product.pack_size, i.unit);
    items.push(packSize ? { name: i.display ?? i.name, packSize } : { name: i.display ?? i.name });
    slugs.push(i.slug);
  }
  return { items, slugs };
}

/** "British Carrots" -> "carrots", "Straight Cut Chips (Frozen)" -> "straight cut chips frozen": the basket's name matcher is strict, so plain wording hits more often. */
export function simplifyName(s: string): string {
  let t = s.replace(/[()]/g, ' ').replace(/\s+/g, ' ').trim();
  for (;;) { const n = t.replace(/^(morrisons|british|scottish|fresh|organic|the best|loose)\s+/i, ''); if (n === t) break; t = n; }
  return t.toLowerCase();
}

/**
 * Second pass: every cupboard staple (never sent the first time) and every fresh ingredient that some store did not match,
 * with plain names and NO pack size. `covered[store]` is the set of ingredient slugs that store already matched.
 */
export function buildRetryItems(ing: IngredientDef[], covered: Record<string, Set<string>>): { items: BasketItem[]; slugs: string[] } {
  const items: BasketItem[] = [], slugs: string[] = [];
  for (const i of ing) {
    const missing = i.cupboard || !!i.product && STORES.some((s) => !covered[s]?.has(i.slug));
    if (!missing || (!i.product && !i.cupboard)) continue;
    items.push({ name: simplifyName(i.display ?? i.name) });
    slugs.push(i.slug);
  }
  return { items, slugs };
}

/** Flattens the answer into one row per matched line per store, in the column names the matching tool already knows. */
export function toRows(res: BasketResponse, slugs: string[]): Record<Store, Record<string, unknown>[]> {
  const out: Record<Store, Record<string, unknown>[]> = { tesco: [], sainsburys: [], asda: [] };
  for (const r of res.retailers ?? []) {
    const store = r.retailer as Store;
    if (!out[store]) continue;
    for (const l of r.lines ?? []) {
      const m = l.matched;
      if (!m || !(m.price > 0)) continue;
      out[store].push({
        retailer: store, retailerProductId: m.retailerProductId, name: m.name, price: m.price,
        loyaltyPrice: m.loyaltyPrice ?? null, ean: m.ean?.[0], matchedBy: m.matchedBy, confidence: m.confidence,
        askedFor: slugs[l.index],
      });
    }
  }
  return out;
}

/**
 * Third pass (--search): for ingredients Tesco still has no confirmed match for, one small search run per ingredient (a shared row cap
 * across queries is why we do them one at a time). Adds a few real candidates per store to the same price files. Costs about 3-4p each.
 */
async function searchMode(ing: IngredientDef[]): Promise<void> {
  const token = process.env.APIFY_TOKEN;
  const stateFile = 'content/matches/tesco.json';
  const decisions: Record<string, { status?: string }> = fs.existsSync(stateFile) ? JSON.parse(fs.readFileSync(stateFile, 'utf8')).decisions : {};
  const todo = ing.filter((i) => (i.product || i.cupboard) && decisions[i.slug]?.status !== 'confirmed');
  const perRun = 0.005 + 0.0025 * 12;
  console.log(`Search pass: ${todo.length} ingredients without a confirmed Tesco match, one run each (up to ~$${(todo.length * perRun).toFixed(2)} in all).`);
  if (!flag('go') || !token) { console.log(!token && flag('go') ? 'Set APIFY_TOKEN first.' : 'Nothing sent. Add --go (and APIFY_TOKEN) to run it.'); return; }
  const have = Object.fromEntries(STORES.map((s) => { const f = path.join(OUT_DIR, `yappman-${s}.json`); return [s, fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) as Record<string, unknown>[] : []]; })) as Record<Store, Record<string, unknown>[]>;
  let added = 0, failed = 0;
  for (const i of todo) {
    const q = simplifyName(i.display ?? i.name);
    try {
      const r = await fetch('https://api.apify.com/v2/acts/yappman~uk-supermarket-price-scraper/run-sync-get-dataset-items', {
        method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify({ mode: 'search', retailers: STORES, queries: [q], maxItems: 12 }), signal: AbortSignal.timeout(150_000),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const rows = (await r.json()) as Record<string, unknown>[];
      for (const o of rows) {
        const store = String(o.retailer) as Store;
        if (!have[store] || !(Number(o.price) > 0)) continue;
        if (have[store].some((x) => String(x.retailerProductId) === String(o.retailerProductId))) continue;
        have[store].push({ retailer: store, retailerProductId: String(o.retailerProductId), name: o.name, price: o.price, loyaltyPrice: o.loyaltyPrice ?? null,
          ean: Array.isArray(o.ean) ? o.ean[0] : undefined, packSize: o.packSize, url: o.url, matchedBy: 'search', askedFor: i.slug });
        added++;
      }
      console.log(`${i.slug}: "${q}" -> ${rows.length} rows`);
    } catch (e) { failed++; console.log(`${i.slug}: "${q}" failed (${(e as Error).message})`); }
  }
  for (const s of STORES) fs.writeFileSync(path.join(OUT_DIR, `yappman-${s}.json`), JSON.stringify(have[s], null, 1) + '\n');
  console.log(`Added ${added} new products (${failed} searches failed). Files: ${STORES.map((s) => `${s} ${have[s].length}`).join(', ')}.`);
}

async function main() {
  const ing: IngredientDef[] = JSON.parse(fs.readFileSync('content/ingredients.json', 'utf8'));
  if (flag('search')) return searchMode(ing);
  const readRaw = (s: Store): Record<string, unknown>[] => { const f = path.join(OUT_DIR, `yappman-${s}.json`); return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : []; };
  const pass2 = flag('pass2');
  const before = Object.fromEntries(STORES.map((s) => [s, readRaw(s)])) as Record<Store, Record<string, unknown>[]>;
  const { items, slugs } = pass2
    ? buildRetryItems(ing, Object.fromEntries(STORES.map((s) => [s, new Set(before[s].map((r) => String(r.askedFor)))])))
    : buildItems(ing);
  if (pass2) console.log('Second pass: plain names, no pack size, for the cupboard staples and anything a store missed the first time.');
  if (items.length < 1 || items.length > 200) throw new Error(`Expected 1-200 ingredient lines, found ${items.length}`);
  const body = { items, retailers: STORES, live: false, includeLoyalty: true };
  const maxUsd = items.length * STORES.length * PER_LINE_USD;
  console.log(`${items.length} ingredient lines x ${STORES.length} stores. Most it can cost: $${maxUsd.toFixed(2)} (unmatched lines are free).`);

  let res: BasketResponse;
  const mock = opt('mock');
  if (mock) {
    res = JSON.parse(fs.readFileSync(mock, 'utf8'));
    console.log(`Using the saved response ${mock} (no network call).`);
  } else if (flag('dry') || !flag('go')) {
    console.log('First 3 lines of the request:', JSON.stringify(items.slice(0, 3)));
    console.log(flag('dry') ? 'Dry run: nothing sent.' : 'Nothing sent. Add --go to send it for real (needs APIFY_TOKEN and YAPPMAN_BASKET_URL).');
    return;
  } else {
    const raw = process.env.YAPPMAN_BASKET_URL || DEFAULT_URL;
    if (!/^https:\/\//i.test(raw)) throw new Error('YAPPMAN_BASKET_URL must start with https://');
    // The token goes in the Authorization header, never in the URL. If the URL you gave carries ?token=..., that is used when APIFY_TOKEN isn't set.
    const parsed = new URL(raw);
    const urlToken = parsed.searchParams.get('token');
    const token = process.env.APIFY_TOKEN || (urlToken && urlToken !== '***' ? urlToken : '');
    if (!token) throw new Error('Set APIFY_TOKEN in this terminal first (Apify Console > Settings > API & integrations > Personal API tokens).');
    const url = parsed.origin + parsed.pathname.replace(/\/+$/, '').replace(/\/basket$/, '') + '/basket';
    const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` }, body: JSON.stringify(body) });
    const text = await r.text();
    if (!r.ok) throw new Error(`Basket call failed: HTTP ${r.status} ${text.slice(0, 300)}`);
    res = JSON.parse(text);
  }

  const rows = toRows(res, slugs);
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUT_DIR, pass2 ? 'yappman-basket-response-pass2.json' : 'yappman-basket-response.json'), JSON.stringify(res, null, 1) + '\n');
  for (const s of STORES) {
    const f = path.join(OUT_DIR, `yappman-${s}.json`);
    // Pass 2 adds to what pass 1 found: a product already in the file is kept as it was, new products are appended.
    const have = new Set((pass2 ? before[s] : []).map((r) => String(r.retailerProductId)));
    const fresh = rows[s].filter((r) => !have.has(String(r.retailerProductId)));
    const out = pass2 ? [...before[s], ...fresh] : rows[s];
    fs.writeFileSync(f, JSON.stringify(out, null, 1) + '\n');
    console.log(`${s}: ${rows[s].length} of ${items.length} matched${pass2 ? `, ${fresh.length} new` : ''} -> ${f} (${out.length} products in file)`);
  }
  if (res.charges) console.log('Charged lines:', JSON.stringify(res.charges));
  if (res.snapshot) console.log('Prices from snapshot:', JSON.stringify(res.snapshot));
  console.log('\nNext, for each store:  npm run match -- suggest --store <tesco|sainsburys|asda> --input content/matches/raw/yappman-<store>.json --source yappman');
}

if (process.argv[1] && /yappman-basket\.ts$/.test(process.argv[1])) main().catch((e) => { console.error(String(e.message ?? e)); process.exit(1); });
