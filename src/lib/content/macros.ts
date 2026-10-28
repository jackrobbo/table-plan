import type { StoreId } from '../stores';
import type { Course, IngredientDef, RecipeDef } from './types';

export interface Computed {
  kcal: number; protein_g: number; carbs_g: number; fat_g: number;
  /** Lines we could not price into macros (no CoFID data, or no grams-per-unit). */
  missing: string[];
}

/** Grams (ml counted as g) in `qty` of an ingredient, or null if its unit can't be converted. */
export function gramsOf(d: IngredientDef, qty: number): number | null {
  if (d.unit === 'g' || d.unit === 'ml') return qty;
  return d.gramsPerUnit ? qty * d.gramsPerUnit : null;
}

/** Every line of a recipe as { ingredient, qty in the ingredient's own unit }, cupboard items included when they have a quantity. */
export function recipeLines(r: RecipeDef, ing: Map<string, IngredientDef>) {
  const lines = r.ingredients.map((l) => ({ slug: l.ingredient, qty: l.qty, cupboard: false }));
  for (const c of r.cupboard ?? []) {
    const q = r.cupboard_qty?.[c];
    const def = ing.get(c);
    if (q != null && q > 0) lines.push({ slug: c, qty: def && def.unit !== 'g' && def.unit !== 'ml' && def.gramsPerUnit ? q / def.gramsPerUnit : q, cupboard: true });
  }
  return lines;
}

/** Per-portion macros computed from CoFID per-100g data. Anything that can't be computed is listed in `missing`. */
export function computePerPortion(r: RecipeDef, ing: Map<string, IngredientDef>): Computed {
  let kcal = 0, protein = 0, carbs = 0, fat = 0;
  const missing: string[] = [];
  for (const l of recipeLines(r, ing)) {
    const d = ing.get(l.slug);
    const g = d ? gramsOf(d, l.qty) : null;
    if (d?.negligible && !d.per100) continue; // a pinch of spice: priced, but no calories to count
    if (!d || !d.per100 || g == null) { missing.push(l.slug); continue; }
    kcal += (d.per100.kcal * g) / 100; protein += (d.per100.protein_g * g) / 100;
    carbs += (d.per100.carbs_g * g) / 100; fat += (d.per100.fat_g * g) / 100;
  }
  // Cupboard items listed without a quantity must be flagged negligible, otherwise macros would silently omit them.
  for (const c of r.cupboard ?? []) {
    const d = ing.get(c);
    if (!((r.cupboard_qty?.[c] ?? 0) > 0) && d && !d.negligible) missing.push(c);
  }
  const n = r.serves || 1;
  const rd = (x: number) => Math.round(x / n);
  return { kcal: rd(kcal), protein_g: Math.round(protein / n), carbs_g: rd(carbs), fat_g: Math.round(fat / n), missing };
}

/** Marginal cost of one portion in pence: what the ingredients actually used cost, ignoring pack leftovers. null if any priced line is unpriced. */
export function costPerPortion(r: RecipeDef, ing: Map<string, IngredientDef>, store: StoreId = 'morrisons'): number | null {
  let total = 0;
  for (const l of recipeLines(r, ing)) {
    const d = ing.get(l.slug);
    if (!d) return null;
    const product = store === 'morrisons' ? d.product : d.products?.[store];
    if (product) total += (l.qty * product.price_pence) / product.pack_size;
    else if (d.cupboardPrice) { const g = gramsOf(d, l.qty); if (g == null) return null; total += (g * d.cupboardPrice.pence) / d.cupboardPrice.grams; }
    else if (!d.negligible) return null;
  }
  return Math.round(total / (r.serves || 1));
}

export type Budget = 'low' | 'medium' | 'high';
/**
 * Cost per portion (pence) at or below which a meal counts as that tier, per course: a £1.50 dinner is cheap, a £1.50 breakfast
 * is not. Tuned on the 100-meal launch bank so each course splits roughly into thirds; change here only, then re-run content:import.
 */
export const BUDGET_LIMITS: Record<Course, { low: number; medium: number }> = {
  breakfast: { low: 110, medium: 160 },
  lunch: { low: 110, medium: 160 },
  snack: { low: 50, medium: 100 },
  dinner: { low: 200, medium: 260 },
};

export function budgetTier(pencePerPortion: number, course: Course): Budget {
  const l = BUDGET_LIMITS[course];
  return pencePerPortion <= l.low ? 'low' : pencePerPortion <= l.medium ? 'medium' : 'high';
}

export interface Resolved { kcal: number; protein_g: number; carbs_g?: number; fat_g?: number; computed: boolean; missing: string[] }

/** What the app uses for a recipe: the declared per_portion when there is one (grandfathered PoC), else computed from ingredient data. */
export function resolvePerPortion(r: RecipeDef, ing: Map<string, IngredientDef>): Resolved {
  if (r.per_portion) return { ...r.per_portion, computed: false, missing: [] };
  const c = computePerPortion(r, ing);
  return { kcal: c.kcal, protein_g: c.protein_g, carbs_g: c.carbs_g, fat_g: c.fat_g, computed: true, missing: c.missing };
}
