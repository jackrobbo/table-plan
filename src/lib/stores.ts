/**
 * The supermarkets Table Plan can price and shop at. Everything store-specific (name, host, how a product page is addressed, whether
 * the trolley can be filled for you) lives here, so adding a store is data plus an adapter, not edits across the app.
 *
 * Morrisons is the reference store: meals are planned and their spend tiers are set from its prices. A store only goes `live`
 * once its catalogue is mapped and priced (src/data/stores.json), see design/multi-store-research.md.
 */
export type StoreId = 'morrisons' | 'tesco';

export interface Store {
  id: StoreId;
  /** "Morrisons": used in sentences and button labels. */
  name: string;
  /** Short label for tight spaces (list links, chips). */
  short: string;
  /** Host of the store's grocery site; the only host the trolley screens may open. */
  host: string;
  /** Has a mapped, priced catalogue the app can use. */
  live: boolean;
  /** Which trolley-filling routes exist for it. */
  fill: { app: boolean; extension: boolean };
  /** Full URL of a product page from its catalogue slug. */
  productUrl: (slug: string) => string;
  /** What a valid catalogue slug looks like (guards what we hand to the extension and app). */
  slugPattern: RegExp;
  /** The store's own limit on the quantity box. */
  maxPacks: number;
}

export const STORES: Record<StoreId, Store> = {
  morrisons: {
    id: 'morrisons', name: 'Morrisons', short: 'Morrisons', host: 'groceries.morrisons.com', live: true,
    fill: { app: true, extension: true },
    productUrl: (slug) => `https://groceries.morrisons.com/products/${slug}`,
    slugPattern: /^[a-z0-9][a-z0-9-]*\/\d+$/i, maxPacks: 36,
  },
  tesco: {
    id: 'tesco', name: 'Tesco', short: 'Tesco', host: 'www.tesco.com', live: false,
    fill: { app: false, extension: false },
    productUrl: (slug) => `https://www.tesco.com/groceries/en-GB/products/${slug}`,
    slugPattern: /^\d{6,10}$/, maxPacks: 99,
  },
};

export const DEFAULT_STORE: StoreId = 'morrisons';
export const STORE_IDS = Object.keys(STORES) as StoreId[];
export const LIVE_STORES = STORE_IDS.filter((s) => STORES[s].live);
export const isStoreId = (v: unknown): v is StoreId => typeof v === 'string' && v in STORES;

/** The person's chosen store; anything unknown or not yet live falls back to the default. */
export function storeOf(p: { store?: string } | null | undefined): Store {
  const id = p?.store;
  return isStoreId(id) && STORES[id].live ? STORES[id] : STORES[DEFAULT_STORE];
}
