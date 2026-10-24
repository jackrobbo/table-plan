// npm run catalogue:payload — writes the catalogue as row-shaped JSON to public/catalogue/ (gitignored). A deployment serves it,
// and Postgres can pull and upsert it server-side (extensions.http_get + jsonb_populate_recordset), so a large catalogue never
// has to be pasted through a tool call. Remove public/catalogue before a normal deploy.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import type { IngredientDef, RecipeDef } from '../src/lib/content/types';
import { budgetTier, costPerPortion, resolvePerPortion } from '../src/lib/content/macros';
import { deriveAllergens } from '../src/lib/content/validate';

const root = '';
const ingredients = JSON.parse(fs.readFileSync(root + 'content/ingredients.json', 'utf8')) as IngredientDef[];
const prices = JSON.parse(fs.readFileSync(root + 'content/prices.json', 'utf8')) as Record<string, { price_pence: number; status: string; checked_at: string; last_ok_at: string }>;
for (const i of ingredients) { const e = i.product && prices[i.slug]; if (e && i.product && (e.status === 'ok' || e.status === 'out_of_stock')) i.product.price_pence = e.price_pence; }
const recipes: RecipeDef[] = [];
for (const f of fs.readdirSync(root + 'content/recipes').filter((f) => f.endsWith('.json')).sort()) { const v = JSON.parse(fs.readFileSync(path.join(root, 'content/recipes', f), 'utf8')); recipes.push(...(Array.isArray(v) ? v : [v])); }
const ing = new Map(ingredients.map((i) => [i.slug, i]));
const images = fs.existsSync(root + 'content/images/manifest.json') ? (JSON.parse(fs.readFileSync(root + 'content/images/manifest.json', 'utf8')) as Record<string, { colour: string }>) : {};

const ingRows = ingredients.map((i) => {
  const p = i.per100; const note = [i.cofid?.approx && `approx: ${i.cofid.approx}`, i.cofid?.note].filter(Boolean).join(' | ') || null;
  return { slug: i.slug, name: i.name, unit: i.unit, cupboard: i.cupboard, note: i.note ?? null, allergens: i.allergens, kcal_100: p?.kcal ?? null, protein_100: p?.protein_g ?? null, carbs_100: p?.carbs_g ?? null, fat_100: p?.fat_g ?? null,
    cofid_code: i.cofid?.code ?? null, cofid_verified: !!i.cofid?.verified, grams_per_unit: i.gramsPerUnit ?? null, negligible: !!i.negligible, cupboard_price_pence: i.cupboardPrice?.pence ?? null, cupboard_price_grams: i.cupboardPrice?.grams ?? null, nutrition_basis: i.cofid?.basis ?? null, nutrition_note: note };
});
const prodRows = ingredients.filter((i) => i.product).map((i) => ({ ingredient_slug: i.slug, retailer: i.product!.retailer, name: i.product!.name, price_pence: i.product!.price_pence, pack_size: i.product!.pack_size, slug: i.product!.slug,
  price_status: prices[i.slug]?.status ?? 'ok', checked_at: prices[i.slug]?.checked_at ?? null, last_ok_at: prices[i.slug]?.last_ok_at ?? null }));
const recRows = recipes.map((r) => {
  const m = resolvePerPortion(r, ing); const cost = r.macros_only ? null : costPerPortion(r, ing);
  const allergens = deriveAllergens(r, ing);
  const hash = crypto.createHash('sha256').update(JSON.stringify([r, m, cost, allergens])).digest('hex').slice(0, 16);
  return { slug: r.slug, name: r.name, course: r.course, emoji: r.emoji ?? null, serves: r.serves, kcal: m.kcal, protein_g: m.protein_g, carbs_g: m.carbs_g ?? null, fat_g: m.fat_g ?? null, method: r.method, allergens, status: r.status, source: r.source ?? null, macros_only: !!r.macros_only, content_hash: hash, cost_pence: cost, budget: cost == null ? null : budgetTier(cost, r.course), image_alt: r.image?.alt ?? null, image_colour: r.image && images[r.slug] ? images[r.slug].colour : null };
});
const lineRows = recipes.flatMap((r) => [...r.ingredients.map((l) => ({ recipe_slug: r.slug, ingredient_slug: l.ingredient, qty: l.qty, cupboard: false })), ...r.cupboard.map((c) => ({ recipe_slug: r.slug, ingredient_slug: c, qty: r.cupboard_qty?.[c] ?? 0, cupboard: true }))]);
const SP = root + 'public/catalogue/';
fs.mkdirSync(SP, { recursive: true });
const w = (n: string, v: unknown) => { const s = JSON.stringify(v); fs.writeFileSync(SP + n, s); console.log(n, (s.length / 1024).toFixed(0), 'KB', (v as unknown[]).length, 'rows'); };
w('ingredients.json', ingRows); w('products.json', prodRows); w('recipes.json', recRows); w('lines.json', lineRows);
