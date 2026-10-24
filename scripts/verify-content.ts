// npm run content:verify [-- --strict] — CoFID verification report per recipe.
import fs from 'node:fs';
import type { IngredientDef, RecipeDef } from '../src/lib/content/types';
import { budgetTier, computePerPortion, costPerPortion, resolvePerPortion } from '../src/lib/content/macros';
import { verifyRecipe } from '../src/lib/content/validate';

const ingredients = JSON.parse(fs.readFileSync('content/ingredients.json', 'utf8')) as IngredientDef[];
const ing = new Map(ingredients.map((i) => [i.slug, i]));
const recipes = fs.readdirSync('content/recipes').filter((f) => f.endsWith('.json')).flatMap((f) => {
  const v = JSON.parse(fs.readFileSync(`content/recipes/${f}`, 'utf8')) as RecipeDef | RecipeDef[];
  return Array.isArray(v) ? v : [v];
});

const used = new Set(recipes.flatMap((r) => [...r.ingredients.map((l) => l.ingredient), ...(r.cupboard_qty ? Object.keys(r.cupboard_qty) : [])]));
const need = [...used].map((s) => ing.get(s)).filter((i): i is IngredientDef => !!i && !i.negligible);
const done = need.filter((i) => i.cofid?.verified && i.per100);
console.log(`Ingredients with verified CoFID data: ${done.length}/${need.length}`);

let verified = 0;
for (const r of recipes) {
  if (r.macros_only) continue;
  const v = verifyRecipe(r, ing);
  if (v.verified) verified++;
  else console.log(`✖ ${r.slug} [${r.status}] ${Math.round(v.coverage * 100)}% covered — ${v.reason}`);
}
const total = recipes.filter((r) => !r.macros_only).length;
console.log(`\nRecipes verified: ${verified}/${total}`);
const unverifiedLive = recipes.filter((r) => r.status === 'live' && !r.macros_only && !verifyRecipe(r, ing).verified).length;
console.log(`Live but unverified: ${unverifiedLive}`);
if (process.argv.includes('--strict') && unverifiedLive) process.exit(1);

// Recipe table: macros as the app will use them, what they compute to, cost and tier. `--table` prints every recipe.
if (process.argv.includes('--table')) {
  console.log('\nslug'.padEnd(34) + 'course     serves  kcal  P   C   F   £/portion  tier    macros');
  for (const r of recipes.filter((r) => !r.macros_only).sort((a, b) => a.course.localeCompare(b.course) || a.slug.localeCompare(b.slug))) {
    const m = resolvePerPortion(r, ing), c = computePerPortion(r, ing), cost = costPerPortion(r, ing);
    const src = r.per_portion ? (c.missing.length ? 'declared (not checkable)' : `declared; computes to ${c.kcal} kcal / ${c.protein_g}g`) : 'computed';
    console.log(`${r.slug.padEnd(33)} ${r.course.padEnd(10)} ${String(r.serves).padStart(4)}  ${String(m.kcal).padStart(4)} ${String(m.protein_g).padStart(3)} ${String(m.carbs_g ?? '').padStart(3)} ${String(m.fat_g ?? '').padStart(3)}  ${cost == null ? '   n/a' : '£' + (cost / 100).toFixed(2).padStart(5)}    ${cost == null ? '-' : budgetTier(cost, r.course).padEnd(6)}  ${src}`);
  }
}
