import type { Allergen } from '../allergens';

export type Course = 'breakfast' | 'lunch' | 'snack' | 'dinner';
export type RecipeStatus = 'draft' | 'verified' | 'live';

export interface IngredientDef {
  slug: string;
  name: string;
  unit: string;
  /** Grams (or ml) in one `unit`, for count-based units (eggs, bananas, slices) so they can take part in CoFID macro checks. */
  unit_g?: number;
  cupboard: boolean;
  note?: string;
  allergens: Allergen[];
  /** CoFID values per 100 g/ml. null until verified. */
  /** CoFID food code and whether the per100 values were checked against it. */
  cofid?: { code?: string; verified: boolean };
  per100: { kcal: number; protein_g: number; carbs_g: number; fat_g: number } | null;
  /** Retailer mapping; null = not yet mapped/priced (M3). */
  product: { retailer: string; name: string; price_pence: number; pack_size: number; slug: string } | null;
}

export interface RecipeDef {
  slug: string;
  name: string;
  course: Course;
  emoji?: string;
  serves: number;
  status: RecipeStatus;
  /** Macros for ONE portion. */
  per_portion: { kcal: number; protein_g: number; carbs_g?: number; fat_g?: number };
  ingredients: { ingredient: string; qty: number }[];
  cupboard: string[];
  /**
   * Grams of cupboard items used across the whole recipe (e.g. oil, honey). Cupboard items aren't priced or
   * listed with quantities, so this only feeds macro verification; leave out spices and other trace amounts.
   */
  cupboard_g?: Record<string, number>;
  method: string[];
  /** Allergens not derivable from ingredients (e.g. cross-contact). */
  extra_allergens?: Allergen[];
  /** Macros-only meal (e.g. eating out / ready meal): no ingredients, method or pricing needed. */
  macros_only?: boolean;
  /** Provenance, e.g. 'poc' (grandfathered, macros not CoFID-verified). */
  source?: string;
}

export interface Issue { where: string; level: 'error' | 'warning'; message: string }
