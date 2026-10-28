import { CUPBOARD, CUPBOARD_NAMES, INGREDIENT_NAMES, PRICES_META, PRODUCTS, STORE_DATA, type Product, type Recipe } from '@/data';
import { buildShopping, type Shopping } from '@/lib/planner/shopping';
import type { Plan } from '@/lib/planner/types';
import { DEFAULT_STORE, type StoreId } from '@/lib/stores';

/**
 * The per-store view of the catalogue. Morrisons is the reference store and its data is the long-standing PRODUCTS / CUPBOARD /
 * recipe `cost`; every function here returns exactly that for Morrisons, so nothing changes until another store is live.
 */
export function productsFor(store: StoreId = DEFAULT_STORE): Record<string, Product> {
  return store === DEFAULT_STORE ? PRODUCTS : STORE_DATA[store]?.products ?? {};
}

export const productFor = (store: StoreId, key: string): Product | undefined => productsFor(store)[key];

/** When the store's prices were last checked (ISO), or null if never. */
export const checkedAtFor = (store: StoreId = DEFAULT_STORE): string | null => (store === DEFAULT_STORE ? PRICES_META.checkedAt : STORE_DATA[store]?.checkedAt ?? null);

/** What a meal costs per portion at a store, with its tier. Morrisons is the recipe's own `cost`/`b`; null if the store doesn't price every line. */
export function recipeCostAt(r: Recipe, store: StoreId = DEFAULT_STORE): { cost: number; b: Recipe['b'] } | null {
  if (store === DEFAULT_STORE) return r.cost != null ? { cost: r.cost, b: r.b ?? null } : null;
  const c = r.sc?.[store];
  return c ? { cost: c.cost, b: c.b } : null;
}

/**
 * The name to show for an ingredient in a recipe. Morrisons keeps the product name people see today; other stores get the neutral
 * name, because a Morrisons product name means nothing in a Tesco shop.
 */
export function ingredientName(key: string, store: StoreId = DEFAULT_STORE): string {
  if (store === DEFAULT_STORE) return PRODUCTS[key]?.n ?? INGREDIENT_NAMES[key] ?? key;
  return INGREDIENT_NAMES[key] ?? productsFor(store)[key]?.n ?? key;
}

/** The week's shopping list priced at a store. For Morrisons this is exactly `buildShopping(plan)`. */
export function buildShoppingFor(plan: Plan, store: StoreId = DEFAULT_STORE): Shopping {
  if (store === DEFAULT_STORE) return buildShopping(plan);
  return buildShopping(plan, undefined, productsFor(store), { ...CUPBOARD_NAMES });
}
