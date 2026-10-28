import type { IngredientDef } from '../content/types';
import type { PriceCache } from '../pricing/refresh';
import { STORES, type StoreId } from '../stores';
import { packInUnit, parsePack } from './pack';
import type { Decision } from './types';

export interface ApplyResult { ingredients: IngredientDef[]; prices: PriceCache; applied: string[]; removed: string[]; problems: string[] }

/**
 * Writes confirmed matches into the content: each ingredient gets `products.<store>` (name, product id, price, and pack size in the
 * ingredient's own unit), and the store's price cache gets the price with the time it was read. Never touches Morrisons' `product`.
 * An ingredient whose decision is now "no equivalent" has any earlier mapping removed. Anything that can't be applied cleanly is a problem.
 */
export function applyDecisions(ingredients: IngredientDef[], store: StoreId, decisions: Record<string, Decision>, prices: PriceCache, now = new Date()): ApplyResult {
  const def = STORES[store];
  const next = structuredClone(ingredients) as IngredientDef[];
  const cache: PriceCache = { ...prices };
  const applied: string[] = [], removed: string[] = [], problems: string[] = [];
  for (const i of next) {
    const d = decisions[i.slug];
    if (!d) continue;
    if (d.status === 'no_equivalent') { if (i.products?.[store]) { delete i.products[store]; if (!Object.keys(i.products).length) delete i.products; delete cache[i.slug]; removed.push(i.slug); } continue; }
    if (d.status !== 'confirmed' || !d.row) continue;
    const r = d.row;
    const pack = packInUnit(parsePack(r.packSize ?? r.name), i.unit, i.gramsPerUnit);
    if (!pack || pack <= 0) { problems.push(`${i.slug}: can't read a pack size from "${r.packSize ?? r.name}" (unit ${i.unit}); fix by hand`); continue; }
    if (!def.slugPattern.test(r.productId)) { problems.push(`${i.slug}: product id "${r.productId}" doesn't look like a ${def.name} id`); continue; }
    if (!(r.price > 0)) { problems.push(`${i.slug}: no usable price`); continue; }
    i.products = { ...(i.products ?? {}), [store]: { retailer: store, name: r.name, price_pence: r.price, pack_size: pack, slug: r.productId } };
    const at = r.scrapedAt ?? now.toISOString();
    cache[i.slug] = { price_pence: r.price, checked_at: at, last_ok_at: at, status: 'ok' } as PriceCache[string];
    applied.push(i.slug);
  }
  return { ingredients: next, prices: cache, applied, removed, problems };
}

/** Which ingredients the live meals actually use: the ones a store must price before it can be turned on. */
export function neededIngredients(recipes: { status: string; macros_only?: boolean; ingredients: { ingredient: string }[]; cupboard: string[] }[]): Set<string> {
  const need = new Set<string>();
  for (const r of recipes) if (r.status === 'live' && !r.macros_only) { r.ingredients.forEach((l) => need.add(l.ingredient)); r.cupboard.forEach((c) => need.add(c)); }
  return need;
}
