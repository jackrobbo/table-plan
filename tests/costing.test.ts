import { describe, expect, it } from 'vitest';
import costing from '@/data/costing.json';
import { RECIPES } from '@/data';
import { computeRecipeCosts, type CostingData } from '@/lib/pricing/costing';

const data = costing as unknown as CostingData;

describe('server costing agrees with the cost baked into the app', () => {
  const costs = computeRecipeCosts(data);
  const byId = new Map(costs.map((c) => [c.slug, c]));
  it('covers every live meal that has a cost', () => {
    const priced = RECIPES.filter((r) => !r.macros_only);
    expect(priced.length).toBeGreaterThan(200);
    for (const r of priced) expect(byId.has(r.id), r.id).toBe(true);
  });
  it('gives the same cost and tier as the import for every live meal', () => {
    for (const r of RECIPES.filter((x) => !x.macros_only)) {
      const c = byId.get(r.id)!;
      expect(c.cost, `${r.id} cost`).toBe(r.cost);
      expect(c.tier, `${r.id} tier`).toBe(r.b);
      expect(c.missing, r.id).toEqual([]);
    }
  });
  it('moves a meal when one of its ingredients changes price', () => {
    const r = RECIPES.find((x) => x.fresh.some(([k]) => k === 'breast') && !x.macros_only)!;
    const base = byId.get(r.id)!.cost!;
    const dearer = computeRecipeCosts(data, { breast: 2 * (data.ingredients.breast.pr ?? 700) }).find((c) => c.slug === r.id)!.cost!;
    expect(dearer).toBeGreaterThan(base);
  });
});
