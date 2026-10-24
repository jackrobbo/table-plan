import { RECIPES, type Recipe } from '@/data';

/** The 14 major allergens under UK food-information law. */
export const ALLERGENS = [
  ['celery', 'Celery'], ['gluten', 'Gluten (wheat, barley, rye, oats)'], ['crustaceans', 'Crustaceans'],
  ['eggs', 'Eggs'], ['fish', 'Fish'], ['lupin', 'Lupin'], ['milk', 'Milk'], ['molluscs', 'Molluscs'],
  ['mustard', 'Mustard'], ['nuts', 'Tree nuts'], ['peanuts', 'Peanuts'], ['sesame', 'Sesame'],
  ['soya', 'Soya'], ['sulphites', 'Sulphur dioxide / sulphites'],
] as const;

export type Allergen = (typeof ALLERGENS)[number][0];

/** Short names for chips and lines, e.g. 'Gluten' rather than 'Gluten (wheat, barley, rye, oats)'. */
export const ALLERGEN_SHORT: Record<Allergen, string> = {
  celery: 'Celery', gluten: 'Gluten', crustaceans: 'Crustaceans', eggs: 'Eggs', fish: 'Fish', lupin: 'Lupin', milk: 'Milk', molluscs: 'Molluscs',
  mustard: 'Mustard', nuts: 'Tree nuts', peanuts: 'Peanuts', sesame: 'Sesame', soya: 'Soya', sulphites: 'Sulphites',
};

/** Allergens are derived from ingredient data by `npm run content:import` (content/ingredients.json). */
export const recipeAllergens = (r: Recipe): Allergen[] => r.allergens as Allergen[];

/** Household-wide hard exclude: any overlap removes the recipe. */
export function isSafeFor(r: Recipe, allergies: readonly Allergen[]): boolean {
  if (!allergies.length) return true;
  const has = recipeAllergens(r);
  return !allergies.some((a) => has.includes(a));
}

export function safeRecipes(allergies: readonly Allergen[]): Recipe[] {
  return RECIPES.filter((r) => isSafeFor(r, allergies));
}
