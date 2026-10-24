import { RECIPES, type Recipe } from '@/data';

/** The 14 major allergens under UK food-information law. */
export const ALLERGENS = [
  ['celery', 'Celery'], ['gluten', 'Gluten (wheat, barley, rye, oats)'], ['crustaceans', 'Crustaceans'],
  ['eggs', 'Eggs'], ['fish', 'Fish'], ['lupin', 'Lupin'], ['milk', 'Milk'], ['molluscs', 'Molluscs'],
  ['mustard', 'Mustard'], ['nuts', 'Tree nuts'], ['peanuts', 'Peanuts'], ['sesame', 'Sesame'],
  ['soya', 'Soya'], ['sulphites', 'Sulphur dioxide / sulphites'],
] as const;

export type Allergen = (typeof ALLERGENS)[number][0];

/**
 * PROVISIONAL ingredient → allergen tags, derived from product names only.
 * M2 replaces this with per-recipe allergens verified against the product labels;
 * until then, treat as best-effort and err on the side of excluding.
 */
const INGREDIENT_ALLERGENS: Record<string, Allergen[]> = {
  prawns: ['crustaceans'], eggs: ['eggs'], milk: ['milk'], yog: ['milk'], greek: ['milk'], creme: ['milk'],
  babybel: ['milk'], pouch: ['milk'], loaf: ['gluten'], wraps: ['gluten'], mission: ['gluten', 'soya'],
  pittas: ['gluten'], houm: ['sesame'], grenade: ['milk', 'soya', 'gluten', 'nuts', 'peanuts'],
  wafer: ['milk', 'soya', 'gluten', 'nuts', 'peanuts'], pops: ['milk', 'soya'],
  spaghetti: ['gluten'], fusilli: ['gluten'], noodles: ['gluten', 'eggs'], lasagne: ['gluten', 'eggs'],
  granola: ['gluten', 'nuts', 'milk'], butter: ['milk'], tuna: ['fish'], peri: ['celery', 'mustard', 'sulphites'],
  soy: ['soya', 'gluten'], teriyaki: ['soya', 'gluten', 'sesame'], mayo: ['eggs', 'mustard'],
  seafood: ['eggs', 'mustard'], cheddar: ['milk'], nuts: ['nuts', 'peanuts'], parmesan: ['milk'],
  isolate: ['milk', 'soya'], fajita: ['sulphites'],
};

export function recipeAllergens(r: Recipe): Allergen[] {
  const found = new Set<Allergen>();
  for (const key of [...r.fresh.map(([k]) => k), ...r.cup]) {
    INGREDIENT_ALLERGENS[key]?.forEach((a) => found.add(a));
  }
  return [...found];
}

/** Household-wide hard exclude: any overlap removes the recipe. */
export function isSafeFor(r: Recipe, allergies: readonly Allergen[]): boolean {
  if (!allergies.length) return true;
  const has = recipeAllergens(r);
  return !allergies.some((a) => has.includes(a));
}

export function safeRecipes(allergies: readonly Allergen[]): Recipe[] {
  return RECIPES.filter((r) => isSafeFor(r, allergies));
}
