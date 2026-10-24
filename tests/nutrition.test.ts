import { describe, expect, it } from 'vitest';
import { RECIPES } from '@/data';
import { BUDGET_LIMITS, budgetTier, computePerPortion, costPerPortion, gramsOf, resolvePerPortion } from '@/lib/content/macros';
import type { IngredientDef, RecipeDef } from '@/lib/content/types';
import { validateContent } from '@/lib/content/validate';

const ing = (over: Partial<IngredientDef> & { slug: string }): IngredientDef => ({
  name: over.slug, unit: 'g', cupboard: false, allergens: [], per100: null, product: null, ...over,
});
const food = (kcal: number, protein_g: number, carbs_g = 0, fat_g = 0) => ({ kcal, protein_g, carbs_g, fat_g });
const INGREDIENTS = [
  ing({ slug: 'chicken', per100: food(100, 20, 0, 2), cofid: { verified: true }, product: { retailer: 'morrisons', name: 'Chicken 500g', price_pence: 500, pack_size: 500, slug: 'x/1' } }),
  ing({ slug: 'egg', unit: 'eggs', gramsPerUnit: 50, per100: food(130, 12), cofid: { verified: true }, product: { retailer: 'morrisons', name: 'Eggs 6', price_pence: 180, pack_size: 6, slug: 'x/2' } }),
  ing({ slug: 'rice', cupboard: true, per100: food(350, 7, 80, 1), cofid: { verified: true }, cupboardPrice: { pence: 100, grams: 1000 } }),
  ing({ slug: 'cumin', cupboard: true, negligible: true }),
  ing({ slug: 'mystery' }),
];
const map = new Map(INGREDIENTS.map((i) => [i.slug, i]));
const recipe = (over: Partial<RecipeDef> = {}): RecipeDef => ({
  slug: 'r', name: 'R', course: 'dinner', serves: 2, status: 'live', ingredients: [{ ingredient: 'chicken', qty: 300 }], cupboard: [], method: ['cook'], ...over,
});

describe('computed macros', () => {
  it('converts counted units to grams and splits the whole recipe across servings', () => {
    expect(gramsOf(map.get('egg')!, 3)).toBe(150);
    const r = recipe({ ingredients: [{ ingredient: 'chicken', qty: 300 }, { ingredient: 'egg', qty: 2 }], cupboard: ['rice'], cupboard_qty: { rice: 100 } });
    const m = computePerPortion(r, map);
    // (300g chicken = 300 kcal, 2 eggs = 100g = 130 kcal, 100g rice = 350 kcal) / 2
    expect(m.kcal).toBe(390);
    expect(m.protein_g).toBe(Math.round((60 + 12 + 7) / 2));
    expect(m.missing).toEqual([]);
  });
  it('flags what it cannot compute instead of silently leaving it out', () => {
    expect(computePerPortion(recipe({ ingredients: [{ ingredient: 'mystery', qty: 10 }] }), map).missing).toEqual(['mystery']);
    // a cupboard item with no quantity is only acceptable when it is a pinch of spice
    expect(computePerPortion(recipe({ cupboard: ['rice'] }), map).missing).toEqual(['rice']);
    expect(computePerPortion(recipe({ cupboard: ['cumin'] }), map).missing).toEqual([]);
  });
  it('a declared per_portion wins (grandfathered), otherwise the computed one is used', () => {
    expect(resolvePerPortion(recipe({ per_portion: { kcal: 999, protein_g: 1 } }), map)).toMatchObject({ kcal: 999, computed: false });
    expect(resolvePerPortion(recipe(), map)).toMatchObject({ kcal: 150, computed: true });
  });
});

describe('cost per portion', () => {
  it('prices what is used, not the whole pack, and counts cupboard staples at their shelf price', () => {
    // 300g of a £5/500g pack = £3, 2 eggs of £1.80/6 = 60p, 100g rice at £1/kg = 10p; two servings
    const r = recipe({ ingredients: [{ ingredient: 'chicken', qty: 300 }, { ingredient: 'egg', qty: 2 }], cupboard: ['rice'], cupboard_qty: { rice: 100 } });
    expect(costPerPortion(r, map)).toBe(Math.round((300 + 60 + 10) / 2));
  });
  it('is null when something cannot be priced, and spices cost nothing', () => {
    expect(costPerPortion(recipe({ ingredients: [{ ingredient: 'mystery', qty: 10 }] }), map)).toBeNull();
    expect(costPerPortion(recipe({ cupboard: ['cumin'], cupboard_qty: { cumin: 3 } }), map)).toBe(150);
  });
});

describe('budget tiers', () => {
  it('judge a meal against its own course', () => {
    expect(budgetTier(150, 'dinner')).toBe('low');
    expect(budgetTier(150, 'breakfast')).toBe('medium');
    expect(budgetTier(150, 'snack')).toBe('high');
    for (const c of Object.keys(BUDGET_LIMITS) as (keyof typeof BUDGET_LIMITS)[]) {
      const { low, medium } = BUDGET_LIMITS[c];
      expect(budgetTier(low, c)).toBe('low'); expect(budgetTier(low + 1, c)).toBe('medium');
      expect(budgetTier(medium, c)).toBe('medium'); expect(budgetTier(medium + 1, c)).toBe('high');
    }
  });
});

describe('allergen safety net', () => {
  it('fails the import when an ingredient name implies an allergen it does not declare', () => {
    const bad = [ing({ slug: 'cod', name: 'Morrisons 2 Cod Fillets' }), ing({ slug: 'cheese', name: 'Cheddar', allergens: ['milk'] }), ing({ slug: 'pb', name: 'Smooth Peanut Butter', allergens: ['peanuts'] }), ing({ slug: 'coco', name: 'Canned Coconut Milk' })];
    const errs = validateContent(bad, []).filter((i) => i.level === 'error').map((i) => i.where + ': ' + i.message);
    expect(errs).toEqual(['ingredient cod: name suggests "fish" but it is not in allergens']);
  });
});

describe('the launch bank', () => {
  const live = RECIPES.filter((r) => !r.macros_only);
  it('has a cost and tier for every meal, and every tier in every course', () => {
    expect(RECIPES.length).toBeGreaterThanOrEqual(100);
    for (const r of live) { expect(r.cost, r.id).toBeGreaterThan(0); expect(['low', 'medium', 'high'], r.id).toContain(r.b); }
    for (const c of ['breakfast', 'lunch', 'snack', 'dinner'] as const)
      for (const b of ['low', 'medium', 'high'] as const) expect(live.filter((r) => r.c === c && r.b === b).length, `${c} ${b}`).toBeGreaterThanOrEqual(3);
  });
  it('has believable calories and protein for every meal', () => {
    for (const r of live) {
      expect(r.k, r.id).toBeGreaterThan(r.c === 'snack' ? 80 : 150);
      expect(r.k, r.id).toBeLessThan(1000);
      expect(r.p * 4, r.id).toBeLessThan(r.k);
    }
  });
  it('leaves enough meals for every one of the 14 allergens, so excluding one still gives a varied week', () => {
    for (const a of ['celery', 'gluten', 'crustaceans', 'eggs', 'fish', 'lupin', 'milk', 'molluscs', 'mustard', 'nuts', 'peanuts', 'sesame', 'soya', 'sulphites'])
      for (const [c, min] of [['breakfast', 5], ['lunch', 5], ['snack', 3], ['dinner', 5]] as const)
        expect(RECIPES.filter((r) => r.c === c && !r.allergens.includes(a)).length, `${a} / ${c}`).toBeGreaterThanOrEqual(min);
  });
  it('has enough lighter meals for weight-loss targets (about 1,300–1,500 kcal a day)', () => {
    expect(RECIPES.filter((r) => r.c === 'dinner' && r.k <= 560).length).toBeGreaterThanOrEqual(12);
    expect(RECIPES.filter((r) => r.c === 'lunch' && r.k <= 420).length).toBeGreaterThanOrEqual(8);
    expect(RECIPES.filter((r) => r.c === 'breakfast' && r.k <= 380).length).toBeGreaterThanOrEqual(8);
    expect(RECIPES.filter((r) => r.c === 'snack' && r.k <= 180).length).toBeGreaterThanOrEqual(8);
  });
  it('flags fish, crustaceans and milk on the recipes that contain them', () => {
    const by = (id: string) => RECIPES.find((r) => r.id === id)!.allergens;
    expect(by('cod-chips-and-peas')).toContain('fish');
    expect(by('salmon-rice-and-broccoli')).toContain('fish');
    expect(by('prawn-teriyaki-noodles')).toContain('crustaceans');
    expect(by('shakshuka-with-feta')).toContain('milk');
    expect(by('smoked-salmon-bagel')).toEqual(expect.arrayContaining(['fish', 'gluten']));
  });
});
