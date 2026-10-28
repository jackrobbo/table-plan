import type { Allergen } from '../allergens';

import type { StoreId } from '../stores';

export type Course = 'breakfast' | 'lunch' | 'snack' | 'dinner';
export type RecipeStatus = 'draft' | 'verified' | 'live';

/** A store's listing for an ingredient: the product we send people to, priced per pack. */
export interface ProductMap { retailer: string; name: string; price_pence: number; pack_size: number; slug: string }

export interface IngredientDef {
  slug: string;
  name: string;
  /** Neutral name for recipes and the cooking sheet ("Chicken breast fillets"). `name` is the Morrisons product name; each store has its own. */
  display?: string;
  unit: string;
  cupboard: boolean;
  note?: string;
  allergens: Allergen[];
  /** Grams (or ml) in ONE of this ingredient's units when unit is not g/ml, e.g. an egg, a slice, a wrap. */
  gramsPerUnit?: number;
  /** Spices, herbs and seasoning: allowed in a recipe without a quantity because their calories are negligible. */
  negligible?: boolean;
  /** Aisle heading on the shopping list (products only). */
  category?: string;
  /** Price of a cupboard staple that has no mapped product yet: `pence` buys `grams` (ml counted as g). */
  cupboardPrice?: { pence: number; grams: number };
  /**
   * Where per100 came from (set by scripts/apply-nutrition.ts, never by hand). basis 'label' = the mapped Morrisons product's
   * pack label, cross-checked against the CoFID food in `code`; 'cofid' = that CoFID food. verified = sources agree (or one
   * authoritative source exists). approx = the closest CoFID food is not the identical food (listed for dietitian review).
   */
  cofid?: { code?: string; name?: string; verified: boolean; basis?: 'label' | 'cofid'; approx?: string; /** why a source was chosen when it was a judgement call */ note?: string };
  /** Per 100 g (ml counted as g), as sold/raw unless the ingredient is a ready-to-use product. null until sourced. */
  per100: { kcal: number; protein_g: number; carbs_g: number; fat_g: number } | null;
  /** Retailer mapping; null = not yet mapped/priced (M3). */
  product: ProductMap | null;
  /** Other stores' mappings, by store id. `product` is the Morrisons (reference store) mapping. */
  products?: Partial<Record<StoreId, ProductMap>>;
}

export interface RecipeDef {
  slug: string;
  name: string;
  course: Course;
  emoji?: string;
  serves: number;
  status: RecipeStatus;
  /**
   * Macros for ONE portion. Leave it out to have the importer compute it from ingredient CoFID data
   * (preferred: it is then correct by construction).
   */
  per_portion?: { kcal: number; protein_g: number; carbs_g?: number; fat_g?: number };
  ingredients: { ingredient: string; qty: number }[];
  cupboard: string[];
  /** Amount of each cupboard item in the WHOLE recipe, in g/ml. Needed to compute macros and cost. */
  cupboard_qty?: Record<string, number>;
  method: string[];
  /** Estimated minutes of hands-on prep and of cooking (an estimate, shown as "≈"). Required for live meals that are cooked or assembled. */
  time?: { prep: number; cook: number };
  /** Allergens not derivable from ingredients (e.g. cross-contact). */
  extra_allergens?: Allergen[];
  /** Macros-only meal (e.g. eating out / ready meal): no ingredients, method or pricing needed. */
  macros_only?: boolean;
  /** Provenance, e.g. 'poc' (grandfathered, macros not CoFID-verified). */
  source?: string;
  /**
   * Header photo. The picture itself is not in this file: put `<slug>.jpg` (or .png/.webp) in content/images/originals/ and run
   * `npm run images:build`, which makes the sized files and records them in content/images/manifest.json. The alt text is required.
   */
  image?: { alt: string; /** who took it, if not us */ credit?: string };
}

export interface Issue { where: string; level: 'error' | 'warning'; message: string }
