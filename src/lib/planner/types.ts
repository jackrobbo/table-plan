import type { Budget, Topup } from '@/data';
import type { Allergen } from '../allergens';
import type { MealTime } from '../profile';
import type { Goal, Stats } from '../targets';

export type Slot = MealTime | 'snack';
export const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'] as const;

export interface PlanInput {
  goal: Goal;
  stats: Stats;
  meals: Record<MealTime, { mode: 'plan' | 'macros'; extraServings: number }>;
  allergies: readonly Allergen[];
  dislikes: readonly string[];
  /** Recipe ids the user kept in the taste swipe. Planned meals only come from these. */
  liked: readonly string[];
  /** Recipe ids the user skipped in the taste swipe: never added when the spend cap leaves too few liked meals. */
  skipped?: readonly string[];
  /** Spend cap on auto-picked meals. Undefined = no cap (e.g. the user hand-picked their meals). */
  budget?: Budget;
  /** Slip one meal the person hasn't rated into the week ("New for you"). Off for weeks they picked by hand. Default on. */
  explore?: boolean;
}

export interface PlannedMeal {
  slot: Slot;
  recipeId: string;
  /** Multiplier on the user's own portion (1 = as written). */
  scale: number;
  /** Servings made for other people, at scale 1. */
  extra: number;
  kcal: number;
  protein: number;
}

export interface PlannedDay {
  day: string;
  meals: PlannedMeal[];
  /** Small add-ons (banana, yogurt, Babybel) used to close a protein or calorie gap. */
  topups: Topup[];
  kcal: number;
  protein: number;
  /** Calories/protein held back for "macros only" meals the user sorts themselves. */
  reserved: { kcal: number; protein: number };
  inBand: boolean;
  /** True when a portion was resized or a top-up added to land in band. */
  adjusted: boolean;
}

export interface Plan {
  seed: number;
  days: PlannedDay[];
  issues: string[];
  /** Things worth knowing that are not problems, e.g. the spend cap had to be relaxed for a course. */
  notes?: string[];
}
