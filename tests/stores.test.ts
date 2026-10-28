import { describe, expect, it } from 'vitest';
import { INGREDIENT_NAMES, PRODUCTS, RECIPES, STORE_DATA } from '@/data';
import { safeRecipes } from '@/lib/allergens';
import { basketItems, basketUrl, MAX_PACKS } from '@/lib/basket';
import { buildShoppingFor, checkedAtFor, ingredientName, productsFor, recipeCostAt } from '@/lib/catalogue';
import { costPerPortion } from '@/lib/content/macros';
import type { IngredientDef, RecipeDef } from '@/lib/content/types';
import { validateContent } from '@/lib/content/validate';
import { buildShopping } from '@/lib/planner/shopping';
import { planWeek } from '@/lib/planner/solve';
import type { PlanInput } from '@/lib/planner/types';
import { PRICES_META } from '@/data';
import { DEFAULT_STORE, LIVE_STORES, STORES, storeOf } from '@/lib/stores';

const input: PlanInput = {
  goal: 'lose', stats: { sex: 'f', age: 34, heightCm: 168, weightKg: 74, activity: 1.375 },
  meals: { breakfast: { mode: 'plan', extraServings: 0 }, lunch: { mode: 'plan', extraServings: 0 }, dinner: { mode: 'plan', extraServings: 1 } },
  allergies: [], dislikes: [], liked: safeRecipes([]).filter((r) => r.c !== 'snack').map((r) => r.id),
};
const plan = planWeek(input, 4, 5);

// These guard the promise that adding stores changes nothing for Morrisons: every value below is what the app did before stores existed.
describe('Morrisons behaviour is unchanged', () => {
  it('keeps Morrisons as the only live store and the default', () => {
    expect(DEFAULT_STORE).toBe('morrisons');
    expect(LIVE_STORES).toEqual(['morrisons']);
    expect(storeOf(undefined).id).toBe('morrisons');
    expect(storeOf({ store: 'tesco' }).id).toBe('morrisons');   // not live yet, so a saved choice can't switch anything on
    expect(storeOf({ store: 'nonsense' }).id).toBe('morrisons');
  });
  it('has the same product links, slug rule and pack limit as before', () => {
    const m = STORES.morrisons;
    expect(m.productUrl('x-y/123')).toBe('https://groceries.morrisons.com/products/x-y/123');
    expect(m.host).toBe('groceries.morrisons.com');
    expect(m.maxPacks).toBe(36);
    expect(MAX_PACKS).toBe(36);
    expect(m.slugPattern.test('x-y/123')).toBe(true);
    expect(m.slugPattern.test('x-y')).toBe(false);
    expect(m.fill).toEqual({ app: true, extension: true });
  });
  it('builds the same shopping list, trolley items and link', () => {
    expect(buildShoppingFor(plan, 'morrisons')).toEqual(buildShopping(plan));
    expect(buildShoppingFor(plan)).toEqual(buildShopping(plan));
    const s = buildShopping(plan);
    expect(basketItems(s, [], STORES.morrisons)).toEqual(basketItems(s));
    expect(basketUrl(basketItems(s), STORES.morrisons)).toBe(basketUrl(basketItems(s)));
    expect(basketUrl(basketItems(s))!.startsWith('https://groceries.morrisons.com/products/')).toBe(true);
  });
  it('uses the same catalogue, check date and per-meal cost', () => {
    expect(productsFor('morrisons')).toBe(PRODUCTS);
    expect(checkedAtFor('morrisons')).toBe(PRICES_META.checkedAt);
    for (const r of RECIPES) {
      const c = recipeCostAt(r, 'morrisons');
      if (r.cost == null) expect(c).toBeNull(); else expect(c).toEqual({ cost: r.cost, b: r.b ?? null });
    }
  });
  it('still shows Morrisons product names in recipes', () => {
    for (const k of Object.keys(PRODUCTS)) expect(ingredientName(k, 'morrisons')).toBe(PRODUCTS[k].n);
  });
});

describe('other stores stay inert until they have data', () => {
  it('has no catalogue for Tesco yet, so nothing can be priced or filled there', () => {
    expect(STORES.tesco.live).toBe(false);
    expect(STORES.tesco.fill).toEqual({ app: false, extension: false });
    expect(Object.keys(STORE_DATA.tesco.products)).toHaveLength(0);
    expect(productsFor('tesco')).toEqual({});
    expect(RECIPES.filter((r) => r.sc)).toHaveLength(0);
    expect(recipeCostAt(RECIPES.find((r) => r.cost != null)!, 'tesco')).toBeNull();
  });
  it('gives every product and cupboard ingredient a neutral name with no store brand', () => {
    for (const k of Object.keys(PRODUCTS)) {
      expect(INGREDIENT_NAMES[k], k).toBeTruthy();
      expect(INGREDIENT_NAMES[k], k).not.toMatch(/morrisons/i);
    }
    for (const [k, n] of Object.entries(INGREDIENT_NAMES)) expect(n, k).not.toMatch(/morrisons/i);
  });
  it('names ingredients neutrally for other stores', () => {
    expect(ingredientName('breast', 'tesco')).toBe(INGREDIENT_NAMES.breast);
    expect(ingredientName('breast', 'tesco')).not.toMatch(/morrisons/i);
  });
});

// A second store, built from a made-up catalogue, to prove the pricing path works before any real data exists.
describe('pricing a meal at another store', () => {
  const ing = (slug: string, retail: { price_pence: number; pack_size: number } | null, tesco?: { price_pence: number; pack_size: number }): IngredientDef => ({
    slug, name: slug, unit: 'g', cupboard: false, allergens: [], per100: null,
    product: retail ? { retailer: 'morrisons', name: slug, slug: `${slug}/1`, ...retail } : null,
    ...(tesco ? { products: { tesco: { retailer: 'tesco', name: slug, slug: '12345678', ...tesco } } } : {}),
  });
  const r: RecipeDef = { slug: 'r', name: 'R', course: 'dinner', serves: 2, status: 'live', ingredients: [{ ingredient: 'a', qty: 500 }, { ingredient: 'b', qty: 250 }], cupboard: [], method: [] };

  it('uses that store\'s price and pack size, and is null until every line is mapped', () => {
    const m = new Map([['a', ing('a', { price_pence: 600, pack_size: 1000 }, { price_pence: 500, pack_size: 1000 })], ['b', ing('b', { price_pence: 200, pack_size: 500 })]]);
    expect(costPerPortion(r, m, 'morrisons')).toBe(Math.round((500 * 600 / 1000 + 250 * 200 / 500) / 2));
    expect(costPerPortion(r, m, 'tesco')).toBeNull();            // b isn't mapped at Tesco yet
    m.set('b', ing('b', { price_pence: 200, pack_size: 500 }, { price_pence: 150, pack_size: 500 }));
    expect(costPerPortion(r, m, 'tesco')).toBe(Math.round((500 * 500 / 1000 + 250 * 150 / 500) / 2));
  });
  it('prices a shopping list from another catalogue by its own packs and prices', () => {
    const fake = Object.fromEntries(Object.entries(PRODUCTS).map(([k, p]) => [k, { ...p, pr: p.pr * 2 }]));
    const base = buildShopping(plan);
    const doubled = buildShopping(plan, undefined, fake);
    expect(doubled.totalPence).toBe(base.totalPence * 2);
    expect(doubled.lines.map((l) => l.key)).toEqual(base.lines.map((l) => l.key));
  });
});

describe('content validation for stores', () => {
  const base = (over: Partial<IngredientDef>): IngredientDef => ({ slug: 'a', name: 'A', display: 'A', unit: 'g', cupboard: false, allergens: [], per100: null, product: { retailer: 'morrisons', name: 'A', price_pence: 100, pack_size: 100, slug: 'a/1' }, ...over });
  const errors = (i: IngredientDef) => validateContent([i], []).filter((x) => x.level === 'error').map((x) => x.message);
  it('accepts a valid Tesco mapping and rejects bad ones', () => {
    expect(errors(base({ products: { tesco: { retailer: 'tesco', name: 'A', price_pence: 100, pack_size: 100, slug: '123456789' } } }))).toEqual([]);
    expect(errors(base({ products: { tesco: { retailer: 'tesco', name: 'A', price_pence: 100, pack_size: 100, slug: 'not a slug' } } })).join()).toMatch(/slug/);
    expect(errors(base({ products: { tesco: { retailer: 'tesco', name: 'A', price_pence: 100, pack_size: 0, slug: '123456789' } } })).join()).toMatch(/pack_size/);
    expect(errors(base({ products: { waitrose: { retailer: 'waitrose', name: 'A', price_pence: 1, pack_size: 1, slug: '1' } } as never })).join()).toMatch(/unknown store/);
    expect(errors(base({ display: 'Morrisons Chicken' })).join()).toMatch(/neutral/);
  });
});
