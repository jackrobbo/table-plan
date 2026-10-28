import products from './products.json';
import cupboard from './cupboard.json';
import cupboardNames from './cupboard-names.json';
import recipes from './recipes.json';
import topups from './topups.json';
import pricesMeta from './prices-meta.json';

export type Course = 'breakfast' | 'lunch' | 'snack' | 'dinner';
export type { Budget } from '@/lib/content/macros';
import type { Budget } from '@/lib/content/macros';

/** st: set only when the latest price check was not clean (delisted, out_of_stock, changed_big, error). */
export interface Product { n: string; pr: number; pack: number; u: string; s: string; st?: string; c?: string }
export interface Recipe {
  id: string; c: Course; e: string; n: string; p: number; k: number; serves: number;
  fresh: [string, number][]; cup: string[]; m: string[]; allergens: string[]; macros_only?: boolean;
  /** Carbs and fat per portion (grams), when known. */
  cb?: number | null; f?: number | null;
  /** Grams (or ml) of each cupboard item in the whole recipe. */
  cq?: Record<string, number>;
  /** Marginal cost of one portion in pence, and its low/medium/high tier (see BUDGET_LIMITS). null for macros-only meals. */
  cost?: number | null; b?: Budget | null;
  /** Estimated minutes, prep plus cooking (0 = ready to eat). */
  t?: number;
  /** Header photo: alt text and the placeholder colour. Files are /meals/<id>-<width>.webp (see src/lib/images.ts). */
  img?: { a: string; c: string };
}
export interface Topup { n: string; p: number; k: number; prod: string; qty: number }

export const PRODUCTS = products as Record<string, Product>;
export const CUPBOARD = cupboard as Record<string, string>;
/** Cupboard item display names (no price), for the recipe sheet. */
export const CUPBOARD_NAMES = cupboardNames as Record<string, string>;
export const RECIPES = recipes as unknown as Recipe[];
export const TOPUPS = topups as Topup[];

export const PRICES_META = pricesMeta as { checkedAt: string | null; oldestCheckAt: string | null; unavailable: string[]; heldForReview: string[] };
