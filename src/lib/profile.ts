import type { Weeks } from './cycle/week';
import type { Allergen } from './allergens';
import type { Goal, Sex, Stats } from './targets';
import type { Budget } from './content/macros';
import type { HeightUnit, WeightUnit } from './units';

export type MealTime = 'breakfast' | 'lunch' | 'dinner';

export interface MealPlanSetting {
  /** 'plan' = we pick the meal; 'macros' = just reserve its calories/protein. */
  mode: 'plan' | 'macros';
  /** Extra servings for others (household members eating the same meal). */
  extraServings: number;
}

export type OnboardingStep =
  | 'goal' | 'height' | 'weight' | 'age' | 'sex' | 'activity'
  | 'meals' | 'allergies' | 'target' | 'dislikes' | 'taste';

export interface Profile {
  goal: Goal | null;
  heightUnit: HeightUnit;
  weightUnit: WeightUnit;
  /** All stats are optional (GDPR: special-category health data). Missing ⇒ default targets. */
  stats: Stats;
  /** User explicitly skipped these steps, so we don't re-prompt on resume. */
  skipped: Partial<Record<'height' | 'weight' | 'age' | 'sex', true>>;
  meals: Record<MealTime, MealPlanSetting>;
  allergies: Allergen[];
  noAllergies: boolean;
  dislikes: string[];
  likedRecipes: string[];
  skippedRecipes: string[];
  step: OnboardingStep;
  completed: boolean;
  /** Weekly cycle (M5): every week the user can see, keyed by Monday. */
  weeks: Weeks;
  /** Spend cap for auto-picked weeks: 'low' = cheapest-tier meals, 'medium' = up to mid-priced, 'high' = no cap. */
  budget: Budget;
  /** When the person agreed to our use of their health information and to the terms, and which version they agreed to. Null until they do. */
  consent: { health: string; terms: string; version: string } | null;
  /** Reminder opt-in, and which nudges have already been shown (`${week}:${kind}`). */
  /** `asked`: the post-save reminders prompt has been answered (either way), so it isn't shown again. */
  reminders: { on: boolean; shown: string[]; asked?: boolean };
}

export const emptyProfile = (): Profile => ({
  goal: null,
  heightUnit: 'cm',
  weightUnit: 'kg',
  stats: { activity: 1.375 },
  skipped: {},
  meals: {
    breakfast: { mode: 'plan', extraServings: 0 },
    lunch: { mode: 'plan', extraServings: 0 },
    dinner: { mode: 'plan', extraServings: 1 },
  },
  allergies: [],
  noAllergies: false,
  dislikes: [],
  likedRecipes: [],
  skippedRecipes: [],
  step: 'goal',
  completed: false,
  weeks: {},
  budget: 'medium',
  consent: null,
  reminders: { on: false, shown: [] },
});

export type { Goal, Sex };
