import { CUPBOARD, PRODUCTS, RECIPES, type Recipe } from '@/data';
import type { Plan } from './types';

export interface ShopLine {
  key: string; name: string; slug: string; packs: number; costPence: number;
  needed: number; bought: number; unit: string; usedBy: string[];
  /** Set when the latest price check found the product delisted / out of stock. */
  status?: string;
}
export interface Shopping { lines: ShopLine[]; totalPence: number; wastePence: number; cupboard: string[] }

const byId = new Map(RECIPES.map((r) => [r.id, r]));

/** Aggregates the week's ingredients into whole packs. Pure; products/recipes injectable for tests. */
export function buildShopping(plan: Plan, recipes: Map<string, Recipe> = byId, products = PRODUCTS, cupboardInfo = CUPBOARD): Shopping {
  const need: Record<string, number> = {};
  const usedBy: Record<string, Set<string>> = {};
  const cupboard = new Set<string>();
  const add = (key: string, qty: number, who: string) => { need[key] = (need[key] ?? 0) + qty; (usedBy[key] ??= new Set()).add(who); };

  for (const d of plan.days) {
    for (const m of d.meals) {
      const r = recipes.get(m.recipeId);
      if (!r) continue;
      const portions = m.scale + m.extra;
      for (const [k, q] of r.fresh) add(k, (q * portions) / r.serves, r.n);
      r.cup.forEach((c) => cupboard.add(c));
    }
    for (const t of d.topups) add(t.prod, t.qty, 'Top-ups');
  }

  let total = 0, waste = 0;
  const lines: ShopLine[] = Object.entries(need).flatMap(([key, q]) => {
    const p = products[key];
    if (!p) return [];
    const packs = Math.max(1, Math.ceil(q / p.pack - 1e-9));
    const cost = packs * p.pr;
    total += cost;
    waste += Math.round(((packs * p.pack - q) / p.pack) * p.pr);
    return [{ key, name: p.n, slug: p.s, packs, costPence: cost, needed: q, bought: packs * p.pack, unit: p.u, usedBy: [...usedBy[key]], status: p.st }];
  }).sort((a, b) => b.costPence - a.costPence);

  return { lines, totalPence: total, wastePence: waste, cupboard: [...cupboard].map((c) => cupboardInfo[c] ?? c) };
}
