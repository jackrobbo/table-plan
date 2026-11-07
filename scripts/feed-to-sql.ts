// npm run feed:sql -- [--snapshot content/feed/<date>-snapshot.json]
//
// Turns a feed snapshot (from `npm run feed -- --go`) into SQL for the price tables (supabase/migrations/0009_price_feed.sql):
//   content/feed/<date>-sql-1-run-prices.sql    one price_runs row plus every price row of the run (rows that failed a check are stored as held)
//   content/feed/<date>-sql-2-products.sql      which retailer product we price for each ingredient, per store
//   content/feed/<date>-sql-3-recipe-costs.sql  cost of one portion per live recipe at Morrisons, recomputed from the run's prices
// It prints no secrets and calls no network: apply the files with the Supabase SQL tool or `psql`, in order. Compact JSON arrays are
// used so each file is small. Everything is an upsert or an insert against a fresh run id, so it is safe to run again.
import fs from 'node:fs';
import type { IngredientDef, RecipeDef } from '../src/lib/content/types';
import { budgetTier, costPerPortion, recipeLines } from '../src/lib/content/macros';
import { morrisonsId, otherStoreUrl, validateRows, type FeedRow } from './yappman-feed';

const args = process.argv.slice(2);
const opt = (k: string) => { const i = args.indexOf(`--${k}`); return i >= 0 ? args[i + 1] : undefined; };
const readJson = <T>(f: string, fallback: T): T => (fs.existsSync(f) ? (JSON.parse(fs.readFileSync(f, 'utf8')) as T) : fallback);
const q = (s: string | null | undefined) => (s == null ? 'null' : `'${String(s).replace(/'/g, "''")}'`);
const num = (n: number | null | undefined) => (n == null || !Number.isFinite(n) ? 'null' : String(n));

/** "1kg" -> 1000 g, "500ml" -> 500 ml, "250G" -> 250 g, anything else (e.g. "6 pack") -> unknown. */
export function parsePack(text: string | null | undefined): { size: number; unit: 'g' | 'ml' } | null {
  const m = /^\s*(\d+(?:\.\d+)?)\s*(kg|g|l|ml|cl)\s*$/i.exec(text ?? '');
  if (!m) return null;
  const n = Number(m[1]), u = m[2].toLowerCase();
  if (u === 'kg') return { size: n * 1000, unit: 'g' };
  if (u === 'g') return { size: n, unit: 'g' };
  if (u === 'l') return { size: n * 1000, unit: 'ml' };
  if (u === 'cl') return { size: n * 10, unit: 'ml' };
  return { size: n, unit: 'ml' };
}

/** Cost of one portion at Morrisons from a run's prices, plus the ingredients that had no price. Pure. */
export function morrisonsRecipeCosts(ingredients: IngredientDef[], recipes: RecipeDef[], priceByRef: Map<string, number>) {
  const ing = ingredients.map((i) => (i.product ? { ...i, product: { ...i.product, price_pence: priceByRef.get(morrisonsId(i.product.slug)) ?? i.product.price_pence } } : i));
  const map = new Map(ing.map((i) => [i.slug, i]));
  return recipes.filter((r) => r.status === 'live' && !r.macros_only).map((r) => {
    const cost = costPerPortion(r, map);
    const missing = recipeLines(r, map).map((l) => l.slug).filter((s) => { const d = map.get(s); return !d || (!d.negligible && !d.product && !d.cupboardPrice); });
    return { slug: r.slug, course: r.course, cost, tier: cost == null ? null : budgetTier(cost, r.course), missing: [...new Set(missing)] };
  });
}

function main() {
  const snapFile = opt('snapshot') ?? fs.readdirSync('content/feed').filter((f) => /^\d{4}-\d{2}-\d{2}-snapshot\.json$/.test(f)).sort().at(-1);
  if (!snapFile) throw new Error('No snapshot found in content/feed. Run: npm run feed -- --go');
  const snapPath = snapFile.includes('/') ? snapFile : `content/feed/${snapFile}`;
  const snap = readJson<{ date: string; rows: FeedRow[] }>(snapPath, { date: '', rows: [] });
  const date = snap.date;
  const ingredients = readJson<IngredientDef[]>('content/ingredients.json', []);
  const recipes: RecipeDef[] = fs.readdirSync('content/recipes').filter((f) => f.endsWith('.json')).flatMap((f) => { const v = readJson<RecipeDef | RecipeDef[]>(`content/recipes/${f}`, []); return Array.isArray(v) ? v : [v]; });
  const prices = readJson<Record<string, { price_pence?: number }>>('content/prices.json', {});

  // What we expected, per store, so the run can record which rows to hold.
  const expected: Record<string, { ref: string; slug: string; lastPricePence?: number | null }[]> = { morrisons: [], tesco: [] };
  for (const i of ingredients) if (i.product?.slug && !i.cupboard) expected.morrisons.push({ ref: morrisonsId(i.product.slug), slug: i.slug, lastPricePence: prices[i.slug]?.price_pence ?? i.product.price_pence });
  const tescoState = readJson<{ decisions?: Record<string, { status?: string; row?: { productId?: string; price?: number } }> }>('content/matches/tesco.json', {});
  for (const [slug, d] of Object.entries(tescoState.decisions ?? {})) if (d.status === 'confirmed' && d.row?.productId) expected.tesco.push({ ref: String(d.row.productId), slug, lastPricePence: d.row.price ?? null });

  const held = new Map<string, string>(); // "store|ref" -> reason
  for (const store of ['morrisons', 'tesco'] as const) {
    const rows = snap.rows.filter((r) => r.store === store);
    for (const i of validateRows(store, rows, expected[store]).issues) if (i.level === 'error' && i.ref && /held for review/.test(i.text)) held.set(`${store}|${i.ref}`, i.text);
  }

  const stores = [...new Set(snap.rows.map((r) => r.store))];
  const priceRows = snap.rows.map((r) => [r.store, r.productRef, r.pricePence, r.wasPricePence, r.loyaltyPricePence, r.promoText, r.inStock, r.packSize, r.pricedAt, held.has(`${r.store}|${r.productRef}`), held.get(`${r.store}|${r.productRef}`) ?? null]);
  const expectedCount = expected.morrisons.length + expected.tesco.length;
  const sql1 = `-- price run ${date}: ${snap.rows.length} price rows
with run as (
  insert into public.price_runs (source, started_at, finished_at, status, stores, rows_expected, rows_received, rows_held, notes)
  values ('yappman', now(), now(), ${held.size ? "'partial'" : "'ok'"}, '{${stores.join(',')}}', ${expectedCount}, ${snap.rows.length}, ${held.size}, ${q('product mode, exact pages; feed dry run ' + date)})
  returning id
)
insert into public.store_prices (run_id, store, product_ref, price_pence, was_price_pence, loyalty_price_pence, promo_text, in_stock, pack_text, priced_at, held, hold_reason)
select run.id, e->>0, e->>1, (e->>2)::int, (e->>3)::int, (e->>4)::int, e->>5, (e->>6)::boolean, e->>7, (e->>8)::timestamptz, (e->>9)::boolean, e->>10
from run, jsonb_array_elements(${q(JSON.stringify(priceRows))}::jsonb) as e;
`;

  // store_products: our own Morrisons mapping and the Tesco matches Jack confirmed.
  const byRef = new Map(snap.rows.map((r) => [`${r.store}|${r.productRef}`, r]));
  const prod: unknown[][] = [];
  for (const i of ingredients) {
    if (!i.product?.slug || i.cupboard) continue;
    const ref = morrisonsId(i.product.slug), r = byRef.get(`morrisons|${ref}`);
    prod.push(['morrisons', i.slug, ref, i.product.name, r?.packSize ?? null, i.product.pack_size, i.unit, `https://groceries.morrisons.com/products/${i.product.slug}`, 'catalogue']);
  }
  const seenTesco: Record<string, string> = {};
  for (const e of expected.tesco) {
    const r = byRef.get(`tesco|${e.ref}`), p = parsePack(r?.packSize);
    prod.push(['tesco', e.slug, e.ref, r?.name ?? '', r?.packSize ?? null, p?.size ?? null, p?.unit ?? null, otherStoreUrl('tesco', e.ref, seenTesco), 'confirmed']);
  }
  const sql2 = `-- store products: ${prod.length}
insert into public.store_products (store, ingredient_slug, product_ref, name, pack_text, pack_size, pack_unit, url, matched_by)
select e->>0, e->>1, e->>2, e->>3, e->>4, (e->>5)::numeric, e->>6, e->>7, e->>8
from jsonb_array_elements(${q(JSON.stringify(prod))}::jsonb) as e
on conflict (store, ingredient_slug) do update set product_ref = excluded.product_ref, name = excluded.name, pack_text = excluded.pack_text,
  pack_size = excluded.pack_size, pack_unit = excluded.pack_unit, url = excluded.url, matched_by = excluded.matched_by, updated_at = now();
`;

  // recipe_costs: Morrisons only, until the other stores' matches are applied to the catalogue.
  // A simple 'Now £1.60, was £1.80' offer must not swing a recipe's cost for a week, so cost uses the regular (was) price when there is one.
  const priceByRef = new Map(snap.rows.filter((r) => r.store === 'morrisons' && !held.has(`morrisons|${r.productRef}`)).map((r) => [r.productRef, r.wasPricePence ?? r.pricePence]));
  const costs = morrisonsRecipeCosts(ingredients, recipes, priceByRef);
  const costRows = costs.map((c) => [c.slug, c.cost, c.tier, c.cost != null, c.missing]);
  const sql3 = `-- recipe costs at Morrisons: ${costs.length} live recipes
insert into public.recipe_costs (store, recipe_slug, cost_pence, budget_tier, complete, missing, run_id, as_of)
select 'morrisons', e->>0, (e->>1)::int, e->>2, (e->>3)::boolean, coalesce(array(select jsonb_array_elements_text(e->4)), '{}'),
  (select id from public.price_runs order by started_at desc limit 1), now()
from jsonb_array_elements(${q(JSON.stringify(costRows))}::jsonb) as e
on conflict (store, recipe_slug) do update set cost_pence = excluded.cost_pence, budget_tier = excluded.budget_tier, complete = excluded.complete,
  missing = excluded.missing, run_id = excluded.run_id, as_of = excluded.as_of;
`;

  fs.writeFileSync(`content/feed/${date}-sql-1-run-prices.sql`, sql1);
  fs.writeFileSync(`content/feed/${date}-sql-2-products.sql`, sql2);
  fs.writeFileSync(`content/feed/${date}-sql-3-recipe-costs.sql`, sql3);
  const incomplete = costs.filter((c) => c.cost == null).length;
  console.log(`Run ${date}: ${snap.rows.length} price rows (${held.size} held), ${prod.length} store products, ${costs.length} recipe costs (${incomplete} incomplete).`);
  console.log(`Files: content/feed/${date}-sql-{1-run-prices,2-products,3-recipe-costs}.sql (sizes ${[sql1, sql2, sql3].map((s) => (s.length / 1024).toFixed(0) + 'KB').join(', ')}). Apply in that order.`);
}

if (process.argv[1] && /feed-to-sql\.ts$/.test(process.argv[1])) main();
