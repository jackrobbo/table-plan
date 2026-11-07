import { PRODUCTS, type Product, type Recipe } from '@/data';
import { LIFE_WEIGHT, lifeOf, needsOf, packCost, perishableLeftover, varietyPenalty } from './waste';

type Rng = { next(): number; pick<T>(xs: readonly T[]): T };

export interface PickOptions {
  pool: readonly Recipe[];
  /** Dinners needed (one per cooking day). */
  n: number;
  /** People each dinner is cooked for (the user plus extra servings). */
  portions: number;
  R: Rng;
  /** Taste and size cost of a single meal in pence-equivalent (0 = ideal; dislikes and poor calorie fit cost more). */
  tastePenalty: (r: Recipe) => number;
  /** Meals already decided (e.g. the "New for you" dinner); the others are chosen around them. */
  fixed?: readonly Recipe[];
  /** Random nudge per meal, so good weeks differ from one week to the next. */
  jitter?: number;
  products?: Record<string, Product>;
}

/** What a set of dinners costs: the shop for them, a penalty on food that would spoil, a dull week, and taste misfits. Lower is better. */
export function weekObjective(set: readonly Recipe[], o: Pick<PickOptions, 'portions' | 'tastePenalty' | 'products'>, nudge: (r: Recipe) => number = () => 0): number {
  const needs = set.flatMap((r) => needsOf(r, o.portions));
  return packCost(needs, o.products) + perishableLeftover(needs, o.products) + varietyPenalty(set) + set.reduce((a, r) => a + o.tastePenalty(r) + nudge(r), 0);
}

/**
 * Chooses the week's dinners so they share ingredients: swaps meals in and out of a random starting week and keeps what lowers
 * the objective, from several starts. With a pool smaller than the week, meals repeat (cycling) and no search is needed.
 */
export function pickDinners(o: PickOptions): Recipe[] {
  const fixed = [...(o.fixed ?? [])];
  const free = Math.max(0, o.n - fixed.length);
  const pool = o.pool.filter((r) => !fixed.includes(r));
  if (!free) return fixed.slice(0, o.n);
  if (pool.length <= free) {
    const out = [...fixed, ...pool];
    for (let i = 0; out.length < o.n && pool.length; i++) out.push(pool[i % pool.length]);
    return out.length ? out : fixed;
  }
  const jit = new Map(pool.map((r) => [r, o.R.next() * (o.jitter ?? 120)]));
  // With a big bank of meals, try a random sample of swaps per position rather than every meal: the best week barely changes, the cost does.
  const SAMPLE = 24;
  const nudge = (r: Recipe) => jit.get(r) ?? 0;
  const score = (free: Recipe[]) => weekObjective([...fixed, ...free], o, nudge);

  let best: Recipe[] | null = null, bestScore = Infinity;
  for (let start = 0; start < 4; start++) {
    const cur: Recipe[] = [];
    while (cur.length < free) { const c = o.R.pick(pool); if (!cur.includes(c)) cur.push(c); }
    let cs = score(cur);
    for (let pass = 0; pass < 3; pass++) {
      let improved = false;
      for (let i = 0; i < free; i++) {
        const tryList = pool.length > SAMPLE ? Array.from({ length: SAMPLE }, () => o.R.pick(pool)) : pool;
        for (const c of tryList) {
          if (cur.includes(c)) continue;
          const prev = cur[i]; cur[i] = c;
          const s = score(cur);
          if (s < cs - 1e-9) { cs = s; improved = true; } else cur[i] = prev;
        }
      }
      if (!improved) break;
    }
    if (cs < bestScore) { bestScore = cs; best = cur.slice(); }
  }
  return [...fixed, ...best!];
}

/** Day order for a set of dinners: the one with the most fast-spoiling fresh food goes first, so it is cooked while it is fresh. */
export function orderByFreshness(dinners: readonly Recipe[], products: Record<string, Product> = PRODUCTS): Recipe[] {
  const urgency = (r: Recipe) => r.fresh.reduce((a, [k]) => a + (lifeOf(k, products[k]?.c) === 'short' ? LIFE_WEIGHT.short : 0), 0);
  return dinners.map((r, i) => ({ r, i, u: urgency(r) })).sort((a, b) => b.u - a.u || a.i - b.i).map((e) => e.r);
}
