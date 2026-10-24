import products from './products.json';
import cupboard from './cupboard.json';
import recipes from './recipes.json';
import topups from './topups.json';
import pricesMeta from './prices-meta.json';

export type Course = 'breakfast' | 'lunch' | 'snack' | 'dinner';
export type { Budget } from '@/lib/content/macros';
import type { Budget } from '@/lib/content/macros';

/** st: set only when the latest price check was not clean (delisted, out_of_stock, changed_big, error). */
export interface Product { n: string; pr: number; pack: number; u: string; s: string; st?: string }
export interface Recipe {
  id: string; c: Course; e: string; n: string; p: number; k: number; serves: number;
  fresh: [string, number][]; cup: string[]; m: string[]; allergens: string[]; macros_only?: boolean;
  /** Marginal cost of one portion in pence, and its low/medium/high tier (see BUDGET_LIMITS). null for macros-only meals. */
  cost?: number | null; b?: Budget | null;
  /** Header photo: alt text and the placeholder colour. Files are /meals/<id>-<width>.webp (see src/lib/images.ts). */
  img?: { a: string; c: string };
}
export interface Topup { n: string; p: number; k: number; prod: string; qty: number }

export const PRODUCTS = products as Record<string, Product>;
export const CUPBOARD = cupboard as Record<string, string>;
export const RECIPES = recipes as Recipe[];
export const TOPUPS = topups as Topup[];

export const PRICES_META = pricesMeta as { checkedAt: string | null; oldestCheckAt: string | null; unavailable: string[]; heldForReview: string[] };
