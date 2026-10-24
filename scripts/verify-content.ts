// npm run content:verify [-- --strict] — CoFID verification report per recipe.
import fs from 'node:fs';
import type { IngredientDef, RecipeDef } from '../src/lib/content/types';
import { verifyRecipe } from '../src/lib/content/validate';

const ingredients = JSON.parse(fs.readFileSync('content/ingredients.json', 'utf8')) as IngredientDef[];
const ing = new Map(ingredients.map((i) => [i.slug, i]));
const recipes = fs.readdirSync('content/recipes').filter((f) => f.endsWith('.json')).flatMap((f) => {
  const v = JSON.parse(fs.readFileSync(`content/recipes/${f}`, 'utf8')) as RecipeDef | RecipeDef[];
  return Array.isArray(v) ? v : [v];
});

const used = new Set(recipes.flatMap((r) => r.ingredients.map((l) => l.ingredient)));
const need = [...used].map((s) => ing.get(s)).filter((i): i is IngredientDef => !!i && !i.cupboard);
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
