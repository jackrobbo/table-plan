import { PRODUCTS, type Product, type Recipe } from '@/data';
import type { ShopLine } from './shopping';

/**
 * Internal only: how we judge a week's ingredients. Nothing here is shown to people. The aim is a week that buys as little
 * it can't use as possible, so meals that share ingredients are planned together and short-life items get used early.
 */

export type Life = 'short' | 'medium' | 'long';
/** How bad a leftover is: half a bag of spinach is a loss, half a bag of rice or a tin is not. */
export const LIFE_WEIGHT: Record<Life, number> = { short: 1, medium: 0.5, long: 0.15 };

const SHORT = new Set(['breast', 'thigh', 'mince', 'sizzle', 'rump', 'prawns', 'roast', 'ham', 'bacon', 'sausages', 'porkmince', 'porkloin', 'turkeymince', 'lambmince', 'salmon', 'cod', 'smokedsalmon', 'chorizo',
  'spinach', 'salad', 'coriander', 'avocado', 'mushrooms', 'iceberg', 'cuc', 'greenbeans', 'blueb', 'banana', 'courgette', 'slices']);
const LONG = new Set(['onions', 'carrots', 'potatoes', 'sweetpot', 'bakepot', 'eggs', 'apple', 'cabbage', 'celery', 'lemon', 'lime', 'chilli']);

/** Shelf life of an ingredient slug: explicit lists first, then a default from its aisle. */
export function lifeOf(key: string, category?: string): Life {
  if (SHORT.has(key)) return 'short';
  if (LONG.has(key)) return 'long';
  switch (category) {
    case 'Meat & fish': return 'short';
    case 'Tins, jars & sauces': case 'Cereals, snacks & protein': case 'Frozen & ready to cook': return 'long';
    default: return 'medium';
  }
}

export interface Need { key: string; qty: number }

/** Value (pence) of what is left over after buying whole packs of `needs`, weighted by how fast each item spoils. */
export function perishableLeftover(needs: readonly Need[], products: Record<string, Product> = PRODUCTS): number {
  const total = new Map<string, number>();
  for (const n of needs) total.set(n.key, (total.get(n.key) ?? 0) + n.qty);
  let loss = 0;
  for (const [key, q] of total) {
    const p = products[key];
    if (!p || q <= 0) continue;
    const packs = Math.max(1, Math.ceil(q / p.pack - 1e-9));
    loss += ((packs * p.pack - q) / p.pack) * p.pr * LIFE_WEIGHT[lifeOf(key, p.c)];
  }
  return loss;
}

/** What buying whole packs of `needs` costs in pence. */
export function packCost(needs: readonly Need[], products: Record<string, Product> = PRODUCTS): number {
  const total = new Map<string, number>();
  for (const n of needs) total.set(n.key, (total.get(n.key) ?? 0) + n.qty);
  let cost = 0;
  for (const [key, q] of total) { const p = products[key]; if (p && q > 0) cost += Math.max(1, Math.ceil(q / p.pack - 1e-9)) * p.pr; }
  return cost;
}

/** The same loss measured from a built shopping list (used to pick between whole candidate weeks). */
export function shoppingLeftover(lines: readonly ShopLine[]): number {
  let loss = 0;
  for (const l of lines) if (l.bought > 0) loss += ((l.bought - l.needed) / l.bought) * l.costPence * LIFE_WEIGHT[lifeOf(l.key, l.category)];
  return loss;
}

/** What a meal needs when cooked for `portions` people. */
export const needsOf = (r: Recipe, portions: number): Need[] => r.fresh.map(([key, q]) => ({ key, qty: (q * portions) / r.serves }));

// ---- variety: weeks that make sense ----

export type Protein = 'chicken' | 'beef' | 'pork' | 'turkey' | 'lamb' | 'fish' | 'veg';
const GROUP: Record<string, Protein> = {
  breast: 'chicken', thigh: 'chicken', roast: 'chicken',
  mince: 'beef', sizzle: 'beef', rump: 'beef',
  porkmince: 'pork', porkloin: 'pork', sausages: 'pork', bacon: 'pork', ham: 'pork', chorizo: 'pork',
  turkeymince: 'turkey', lambmince: 'lamb',
  salmon: 'fish', cod: 'fish', prawns: 'fish', smokedsalmon: 'fish', tuna: 'fish',
};

/** The main protein of a meal (first match among its fresh and cupboard items), or 'veg' when it has none. */
export function proteinOf(r: Recipe): Protein {
  let best: Protein | null = null, bestQ = 0;
  for (const [k, q] of r.fresh) { const g = GROUP[k]; if (g && q > bestQ) { best = g; bestQ = q; } }
  if (best) return best;
  for (const c of r.cup) if (GROUP[c]) return GROUP[c];
  return 'veg';
}

/** Soft penalty (pence-equivalent) for a week that leans on one protein or repeats a meal. Never a hard rule. */
export function varietyPenalty(recipes: readonly Recipe[], perProteinCap = 2): number {
  const counts = new Map<Protein, number>();
  const ids = new Map<string, number>();
  for (const r of recipes) { counts.set(proteinOf(r), (counts.get(proteinOf(r)) ?? 0) + 1); ids.set(r.id, (ids.get(r.id) ?? 0) + 1); }
  let p = 0;
  for (const n of counts.values()) if (n > perProteinCap) p += (n - perProteinCap) * 250;
  for (const n of ids.values()) if (n > 1) p += (n - 1) * 600;
  return p;
}
