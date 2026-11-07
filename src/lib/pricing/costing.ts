import { BUDGET_LIMITS, budgetTier, type Budget } from '../content/macros';
import type { Course, IngredientDef, RecipeDef } from '../content/types';

/**
 * What the server needs to recompute the cost of one portion of every meal from fresh prices, without the content files.
 * Written at import time to src/data/costing.json (server use only; it never ships to the browser) and used by the weekly price job.
 * The arithmetic is exactly `costPerPortion` in src/lib/content/macros.ts, and a test checks the two agree for every live meal.
 */
export interface CostingData {
  /** By ingredient slug. pack: size of the bought product in the ingredient's unit; pr: the bundled price (fallback); cp: a cupboard staple's [pence, grams]; g: grams per counted unit; neg: a pinch with no price. */
  ingredients: Record<string, { pack?: number; pr?: number; cp?: [number, number]; g?: number; unit: string; neg?: 1 }>;
  /** By recipe slug: course, serves and the lines [ingredient slug, quantity in its own unit] (cupboard lines in their own unit too). */
  recipes: Record<string, { c: Course; s: number; l: [string, number][] }>;
}

export function buildCostingData(ingredients: IngredientDef[], recipes: RecipeDef[]): CostingData {
  const ing: CostingData['ingredients'] = {};
  for (const i of ingredients) {
    const o: CostingData['ingredients'][string] = { unit: i.unit };
    if (i.product) { o.pack = i.product.pack_size; o.pr = i.product.price_pence; }
    if (i.cupboardPrice) o.cp = [i.cupboardPrice.pence, i.cupboardPrice.grams];
    if (i.gramsPerUnit) o.g = i.gramsPerUnit;
    if (i.negligible) o.neg = 1;
    ing[i.slug] = o;
  }
  const map = new Map(ingredients.map((i) => [i.slug, i]));
  const rec: CostingData['recipes'] = {};
  for (const r of recipes) {
    if (r.status !== 'live' || r.macros_only) continue;
    const l: [string, number][] = r.ingredients.map((x) => [x.ingredient, x.qty]);
    for (const c of r.cupboard ?? []) {
      const q = r.cupboard_qty?.[c];
      const d = map.get(c);
      if (q != null && q > 0) l.push([c, d && d.unit !== 'g' && d.unit !== 'ml' && d.gramsPerUnit ? q / d.gramsPerUnit : q]);
    }
    rec[r.slug] = { c: r.course, s: r.serves, l };
  }
  return { ingredients: ing, recipes: rec };
}

export interface RecipeCost { slug: string; cost: number | null; tier: Budget | null; missing: string[] }

/** Cost of one portion of every meal. `price` is the current pence price of a bought ingredient's product (falls back to the bundled price). */
export function computeRecipeCosts(data: CostingData, price: Record<string, number> = {}): RecipeCost[] {
  return Object.entries(data.recipes).map(([slug, r]) => {
    let total = 0;
    const missing: string[] = [];
    for (const [k, qty] of r.l) {
      const d = data.ingredients[k];
      if (!d) { missing.push(k); continue; }
      if (d.pack) total += (qty * (price[k] ?? d.pr ?? 0)) / d.pack;
      else if (d.cp) {
        const g = d.unit === 'g' || d.unit === 'ml' ? qty : d.g ? qty * d.g : null;
        if (g == null) { missing.push(k); continue; }
        total += (g * d.cp[0]) / d.cp[1];
      } else if (!d.neg) missing.push(k);
    }
    const cost = missing.length ? null : Math.round(total / (r.s || 1));
    return { slug, cost, tier: cost == null ? null : budgetTier(cost, r.c), missing };
  });
}

export { BUDGET_LIMITS };
