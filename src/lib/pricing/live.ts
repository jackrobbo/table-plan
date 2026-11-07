import { PRICES_META, PRODUCTS, RECIPES } from '@/data';
import { getBackend } from '@/lib/db';
import { DEFAULT_STORE, type StoreId } from '@/lib/stores';
import { applySnapshot, type Applied } from './snapshot';

/**
 * Brings the app's prices up to date from the weekly feed, once per page load per store, before anything plans or prices a week.
 * It never blocks for long and never fails loudly: if the network, the server or the data is unavailable, the bundled prices stay.
 */
const done = new Map<string, Promise<Applied | null>>();

export function ensureLivePrices(store: StoreId = DEFAULT_STORE, timeoutMs = 2500): Promise<Applied | null> {
  const known = done.get(store);
  if (known) return known;
  const svc = getBackend().prices;
  const p = !svc ? Promise.resolve(null) : Promise.race([
    svc.snapshot(store).then((snap) => (snap && snap.store === store ? applySnapshot(snap, { products: PRODUCTS, recipes: RECIPES, meta: PRICES_META }) : null)),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs)),
  ]).catch(() => null);
  done.set(store, p);
  return p;
}
