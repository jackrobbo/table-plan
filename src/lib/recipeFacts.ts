import { CUPBOARD_NAMES, type Recipe } from '@/data';
import { ALLERGEN_SHORT, recipeAllergens } from './allergens';

/** Allergens declared on the products a recipe uses, in the order shown on the recipe sheet. */
export const allergenNames = (r: Recipe): string[] => recipeAllergens(r).map((a) => ALLERGEN_SHORT[a] ?? a);

/** "Easy Cook Long Grain Rice 150 g": what you use of each cupboard item, not the pack you buy. */
export const cupboardLines = (r: Recipe): string[] =>
  r.cup.map((k) => {
    const q = r.cq?.[k];
    return `${CUPBOARD_NAMES[k] ?? k}${q ? ` ${q} g` : ''}`;
  });
