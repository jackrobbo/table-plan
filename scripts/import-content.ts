// npm run content:import — validates content/, then compiles app data + supabase/seed.sql.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import type { IngredientDef, RecipeDef } from '../src/lib/content/types';
import type { PriceCache } from '../src/lib/pricing/refresh';
import { BUDGET_LIMITS, budgetTier, costPerPortion, resolvePerPortion } from '../src/lib/content/macros';
import { deriveAllergens, validateContent } from '../src/lib/content/validate';

const readJson = <T>(f: string) => JSON.parse(fs.readFileSync(f, 'utf8')) as T;
const ingredients = readJson<IngredientDef[]>('content/ingredients.json');
const recipes: RecipeDef[] = [];
for (const f of fs.readdirSync('content/recipes').filter((f) => f.endsWith('.json')).sort()) {
  const v = readJson<RecipeDef | RecipeDef[]>(path.join('content/recipes', f));
  recipes.push(...(Array.isArray(v) ? v : [v])); // a file may hold one recipe or a batch
}

const prices: PriceCache = fs.existsSync('content/prices.json') ? readJson<PriceCache>('content/prices.json') : {};
// Overlay the latest cached price; a delisted product keeps its last price but is flagged unavailable.
for (const i of ingredients) {
  const e = i.product && prices[i.slug];
  if (e && i.product && (e.status === 'ok' || e.status === 'out_of_stock')) i.product.price_pence = e.price_pence;
}
const images = fs.existsSync('content/images/manifest.json') ? readJson<Record<string, { colour: string }>>('content/images/manifest.json') : {};
const issues = validateContent(ingredients, recipes, images);
for (const i of issues) console.log(`${i.level === 'error' ? '✖' : '⚠'} ${i.where}: ${i.message}`);
const errors = issues.filter((i) => i.level === 'error').length;
console.log(`${recipes.length} recipes, ${ingredients.length} ingredients — ${errors} errors, ${issues.length - errors} warnings`);
if (errors) { console.error('Fix errors before importing; nothing written.'); process.exit(1); }

const ingMap = new Map(ingredients.map((i) => [i.slug, i]));
// Per-portion macros (declared for grandfathered PoC recipes, otherwise computed from ingredient data) and marginal cost.
const resolved = new Map(recipes.map((r) => {
  const m = resolvePerPortion(r, ingMap);
  const cost = r.macros_only ? null : costPerPortion(r, ingMap);
  return [r.slug, { m, cost, budget: cost == null ? null : budgetTier(cost, r.course) }] as const;
}));
const byStatus = (s: string) => recipes.filter((r) => r.status === s).length;
console.log(`live ${byStatus('live')} · verified ${byStatus('verified')} · draft ${byStatus('draft')}`);
console.log(`photos: ${recipes.filter((r) => r.image && images[r.slug]).length}/${recipes.filter((r) => r.status === 'live').length} live meals have a header photo (the rest show their emoji)`);

// ---- compiled app data (live recipes only; shape consumed by src/data/index.ts) ----
const out = (f: string, v: unknown) => fs.writeFileSync(`src/data/${f}.json`, JSON.stringify(v, null, 1) + '\n');
out('products', Object.fromEntries(ingredients.filter((i) => i.product).map((i) => [i.slug,
  { n: i.product!.name, pr: i.product!.price_pence, pack: i.product!.pack_size, u: i.unit, s: i.product!.slug, c: i.category ?? 'Other',
    ...(prices[i.slug] && prices[i.slug].status !== 'ok' ? { st: prices[i.slug].status } : {}) }])));
const checked = Object.values(prices).map((e) => e.checked_at).sort();
const unavailable = Object.entries(prices).filter(([, e]) => e.status === 'delisted' || e.status === 'out_of_stock').map(([k]) => k);
out('prices-meta', { checkedAt: checked.at(-1) ?? null, oldestCheckAt: checked[0] ?? null, unavailable,
  heldForReview: Object.entries(prices).filter(([, e]) => e.status === 'changed_big').map(([k]) => k) });
for (const r of recipes.filter((r) => r.status === 'live'))
  for (const l of r.ingredients) if (unavailable.includes(l.ingredient)) console.log(`⚠ ${r.slug}: "${l.ingredient}" is delisted/out of stock at Morrisons`);
out('cupboard', Object.fromEntries(ingredients.filter((i) => i.cupboard).map((i) => [i.slug, i.note ?? i.name])));
// "Easy Cook Long Grain Rice 1kg" → "Easy Cook Long Grain Rice": the recipe sheet shows what you use, not the pack you buy.
const shortName = (n: string) => n.replace(/\s+\d[\d.,×x\s]*(?:g|kg|ml|l|cl)\b.*$/i, '').replace(/\s+\d+$/, '').replace(/^Savers\s+/, '');
out('cupboard-names', Object.fromEntries(ingredients.filter((i) => i.cupboard).map((i) => [i.slug, shortName(i.name)])));
out('recipes', recipes.filter((r) => r.status === 'live').map((r) => ({
  id: r.slug, c: r.course, e: r.emoji ?? '🍽️', n: r.name, p: resolved.get(r.slug)!.m.protein_g, k: resolved.get(r.slug)!.m.kcal, serves: r.serves,
  cb: resolved.get(r.slug)!.m.carbs_g ?? null, f: resolved.get(r.slug)!.m.fat_g ?? null,
  cost: resolved.get(r.slug)!.cost, b: resolved.get(r.slug)!.budget,
  ...(r.image && images[r.slug] ? { img: { a: r.image.alt, c: images[r.slug].colour } } : {}),
  ...(r.time ? { t: r.time.prep + r.time.cook } : {}),
  macros_only: r.macros_only ?? false,
  fresh: r.ingredients.map((l) => [l.ingredient, l.qty]), cup: r.cupboard, ...(r.cupboard_qty ? { cq: r.cupboard_qty } : {}), m: r.method,
  allergens: deriveAllergens(r, ingMap),
})));

// ---- idempotent SQL ----
const q = (s: unknown) => (s == null ? 'null' : `'${String(s).replace(/'/g, "''")}'`);
const n = (v: unknown) => (v == null ? 'null' : String(v));
const arr = (a: string[]) => `array[${a.map(q).join(',')}]::text[]`;
const sql: string[] = ['-- generated by scripts/import-content.ts; do not edit', 'begin;'];
for (const i of ingredients) {
  const p = i.per100;
  const note = [i.cofid?.approx && `approx: ${i.cofid.approx}`, i.cofid?.note].filter(Boolean).join(' | ') || null;
  sql.push(`insert into public.ingredients (slug,name,unit,cupboard,note,allergens,kcal_100,protein_100,carbs_100,fat_100,cofid_code,cofid_verified,grams_per_unit,negligible,cupboard_price_pence,cupboard_price_grams,nutrition_basis,nutrition_note) values (${q(i.slug)},${q(i.name)},${q(i.unit)},${i.cupboard},${q(i.note)},${arr(i.allergens)},${n(p?.kcal)},${n(p?.protein_g)},${n(p?.carbs_g)},${n(p?.fat_g)},${q(i.cofid?.code)},${!!i.cofid?.verified},${n(i.gramsPerUnit)},${!!i.negligible},${n(i.cupboardPrice?.pence)},${n(i.cupboardPrice?.grams)},${q(i.cofid?.basis)},${q(note)}) on conflict (slug) do update set name=excluded.name,unit=excluded.unit,cupboard=excluded.cupboard,note=excluded.note,allergens=excluded.allergens,kcal_100=excluded.kcal_100,protein_100=excluded.protein_100,carbs_100=excluded.carbs_100,fat_100=excluded.fat_100,cofid_code=excluded.cofid_code,cofid_verified=excluded.cofid_verified,grams_per_unit=excluded.grams_per_unit,negligible=excluded.negligible,cupboard_price_pence=excluded.cupboard_price_pence,cupboard_price_grams=excluded.cupboard_price_grams,nutrition_basis=excluded.nutrition_basis,nutrition_note=excluded.nutrition_note;`);
  if (i.product) sql.push(`insert into public.products (ingredient_slug,retailer,name,price_pence,pack_size,slug,price_status,checked_at,last_ok_at) values (${q(i.slug)},${q(i.product.retailer)},${q(i.product.name)},${i.product.price_pence},${i.product.pack_size},${q(i.product.slug)},${q(prices[i.slug]?.status ?? 'ok')},${q(prices[i.slug]?.checked_at)},${q(prices[i.slug]?.last_ok_at)}) on conflict (ingredient_slug,retailer) do update set name=excluded.name,price_pence=excluded.price_pence,pack_size=excluded.pack_size,slug=excluded.slug,price_status=excluded.price_status,checked_at=excluded.checked_at,last_ok_at=excluded.last_ok_at,updated_at=now();`);
}
for (const r of recipes) {
  const { m, cost, budget } = resolved.get(r.slug)!;
  // The hash covers what we derive too (macros, cost, allergens), so a change to an ingredient's data re-syncs its recipes.
  const hash = crypto.createHash('sha256').update(JSON.stringify([r, m, cost, deriveAllergens(r, ingMap), images[r.slug]?.colour ?? null])).digest('hex').slice(0, 16);
  sql.push(`insert into public.recipes (slug,name,course,emoji,serves,kcal,protein_g,carbs_g,fat_g,method,allergens,status,source,macros_only,content_hash,cost_pence,budget,image_alt,image_colour) values (${q(r.slug)},${q(r.name)},${q(r.course)},${q(r.emoji)},${r.serves},${m.kcal},${m.protein_g},${n(m.carbs_g)},${n(m.fat_g)},${arr(r.method)},${arr(deriveAllergens(r, ingMap))},${q(r.status)},${q(r.source)},${!!r.macros_only},${q(hash)},${n(cost)},${q(budget)},${q(r.image?.alt)},${q(r.image && images[r.slug] ? images[r.slug].colour : null)}) on conflict (slug) do update set name=excluded.name,course=excluded.course,emoji=excluded.emoji,serves=excluded.serves,kcal=excluded.kcal,protein_g=excluded.protein_g,carbs_g=excluded.carbs_g,fat_g=excluded.fat_g,method=excluded.method,allergens=excluded.allergens,status=excluded.status,source=excluded.source,macros_only=excluded.macros_only,content_hash=excluded.content_hash,cost_pence=excluded.cost_pence,budget=excluded.budget,image_alt=excluded.image_alt,image_colour=excluded.image_colour where public.recipes.content_hash is distinct from excluded.content_hash;`);
  sql.push(`delete from public.recipe_ingredients where recipe_slug=${q(r.slug)};`);
  for (const l of r.ingredients) sql.push(`insert into public.recipe_ingredients (recipe_slug,ingredient_slug,qty,cupboard) values (${q(r.slug)},${q(l.ingredient)},${l.qty},false);`);
  for (const c of r.cupboard) sql.push(`insert into public.recipe_ingredients (recipe_slug,ingredient_slug,qty,cupboard) values (${q(r.slug)},${q(c)},${r.cupboard_qty?.[c] ?? 0},true);`);
}
sql.push('commit;');

// ---- budget spread (live, costed recipes) ----
const live = recipes.filter((r) => r.status === 'live' && resolved.get(r.slug)!.cost != null);
console.log('\nCost per portion by course and tier (limits in pence: ' + Object.entries(BUDGET_LIMITS).map(([c, l]) => `${c} ${l.low}/${l.medium}`).join(', ') + ')');
for (const c of ['breakfast', 'lunch', 'snack', 'dinner']) {
  const rs = live.filter((r) => r.course === c);
  const count = (b: string) => rs.filter((r) => resolved.get(r.slug)!.budget === b).length;
  const costs = rs.map((r) => resolved.get(r.slug)!.cost!).sort((a, b) => a - b);
  console.log(`  ${c.padEnd(9)} ${String(rs.length).padStart(2)} recipes  low ${count('low')} · medium ${count('medium')} · high ${count('high')}   £${((costs[0] ?? 0) / 100).toFixed(2)}–£${((costs.at(-1) ?? 0) / 100).toFixed(2)}`);
}
const uncosted = recipes.filter((r) => r.status === 'live' && !r.macros_only && resolved.get(r.slug)!.cost == null).map((r) => r.slug);
if (uncosted.length) console.log(`  ⚠ no cost for: ${uncosted.join(', ')}`);
fs.writeFileSync('supabase/seed.sql', sql.join('\n') + '\n');
console.log('wrote src/data/*.json and supabase/seed.sql');
