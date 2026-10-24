import products from './products.json';
import cupboard from './cupboard.json';
import recipes from './recipes.json';
import topups from './topups.json';
import pricesMeta from './prices-meta.json';

export type Course = 'breakfast' | 'lunch' | 'snack' | 'dinner';

/** st: set only when the latest price check was not clean (delisted, out_of_stock, changed_big, error). */
export interface Product { n: string; pr: number; pack: number; u: string; s: string; st?: string }
export interface Recipe {
  id: string; c: Course; e: string; n: string; p: number; k: number; serves: number;
  fresh: [string, number][]; cup: string[]; m: string[]; allergens: string[]; macros_only?: boolean;
}
export interface Topup { n: string; p: number; k: number; prod: string; qty: number }

export const PRODUCTS = products as Record<string, Product>;
export const CUPBOARD = cupboard as Record<string, string>;
export const RECIPES = recipes as Recipe[];
export const TOPUPS = topups as Topup[];

export const PRICES_META = pricesMeta as { checkedAt: string | null; oldestCheckAt: string | null; unavailable: string[]; heldForReview: string[] };
