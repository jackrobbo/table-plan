// npm run labels:fetch [-- --all] — reads the pack-label nutrition table from each mapped Morrisons product page
// into content/nutrition-labels.json (per 100 g/ml, as sold). Only fetches missing slugs unless --all. 2 s apart, same UA as prices.
import fs from 'node:fs';
import type { IngredientDef } from '../src/lib/content/types';
import { parseDeclaredAllergens, parseNutritionTable, type LabelNutrition } from '../src/lib/pricing/nutrition';

const FILE = 'content/nutrition-labels.json';
const BASE = 'https://groceries.morrisons.com/products/';
const UA = 'TablePlanPriceCheck/0.1 (+https://table-plan-app.vercel.app)';
type Entry = Partial<LabelNutrition> & { product: string; fetched_at: string; /** bold allergens in the ingredients list; absent when the page has none */ allergens?: string[] };

const ingredients = JSON.parse(fs.readFileSync('content/ingredients.json', 'utf8')) as IngredientDef[];
const map = fs.existsSync('content/cofid-map.json') ? (JSON.parse(fs.readFileSync('content/cofid-map.json', 'utf8')) as Record<string, { labelPage?: string }>) : {};
const have: Record<string, Entry> = fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE, 'utf8')) : {};
const all = process.argv.includes('--all');

async function main() {
  // A mapped product, or a `labelPage` in cofid-map.json for cupboard items we only need allergens for (stock cubes, spices).
  const todo = ingredients.map((i) => ({ i, page: i.product?.slug ?? map[i.slug]?.labelPage })).filter((t): t is { i: IngredientDef; page: string } => !!t.page && (all || have[t.i.slug]?.product !== t.page));
  console.log(`${todo.length} product pages to read`);
  let ok = 0, none = 0;
  for (const { i, page } of todo) {
    try {
      const r = await fetch(BASE + page, { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(20000) });
      const html = r.status === 200 ? await r.text() : '';
      const n = html ? parseNutritionTable(html) : null;
      const allergens = html ? parseDeclaredAllergens(html) : null;
      if (n || allergens) have[i.slug] = { ...(n ?? {}), ...(allergens ? { allergens } : {}), product: page, fetched_at: new Date().toISOString() };
      else delete have[i.slug];
      if (n) ok++; else { none++; console.log(`  no label table: ${i.slug} (HTTP ${r.status})`); }
    } catch (e) { console.log(`  error: ${i.slug}: ${(e as Error).message}`); }
    await new Promise((r) => setTimeout(r, 2000));
  }
  fs.writeFileSync(FILE, JSON.stringify(Object.fromEntries(Object.entries(have).sort()), null, 1) + '\n');
  console.log(`labels: ${ok} read, ${none} without a label table, ${Object.keys(have).length} stored`);
}
main();
