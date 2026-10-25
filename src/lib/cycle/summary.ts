import { RECIPES } from '@/data';
import type { Plan, PlannedDay } from '../planner/types';
import type { Shopping } from '../planner/shopping';

const byId = new Map(RECIPES.map((r) => [r.id, r]));
const avg = (xs: number[]) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : 0);

/** A day's carbs and fat from the meals that have them (top-ups and reserved "macros only" meals carry none, so this is a floor). */
export function dayCarbsFat(d: PlannedDay): { carbs: number; fat: number } {
  let carbs = 0, fat = 0;
  for (const m of d.meals) { const r = byId.get(m.recipeId); carbs += (r?.cb ?? 0) * m.scale; fat += (r?.f ?? 0) * m.scale; }
  return { carbs: Math.round(carbs), fat: Math.round(fat) };
}

/** The "Daily average" across the planned days: what the week delivers per day, to set against the target. */
export function weekAverages(plan: Plan) {
  const days = plan.days.filter((d) => !d.off);
  return {
    kcal: avg(days.map((d) => d.kcal)), protein: avg(days.map((d) => d.protein)),
    carbs: avg(days.map((d) => dayCarbsFat(d).carbs)), fat: avg(days.map((d) => dayCarbsFat(d).fat)),
  };
}

/** What a typical meal-prep service charges per meal (design brief: £5–8); the midpoint, used only for the comparison. */
export const MEAL_PREP_PENCE = 650;

export interface WeekSummary {
  eaten: number; planned: number;
  daysInBand: number; days: number;
  averages: ReturnType<typeof weekAverages>;
  /** Estimated shop cost per portion cooked, and what the same portions cost at meal-prep prices. */
  perMealPence: number; savedPence: number;
}

/** The "week done" numbers. Ticks are keyed `${dayIndex}:${mealIndex}`; snacks count as meals eaten. */
export function summariseWeek(plan: Plan, ticks: Record<string, boolean>, shopping: Shopping): WeekSummary {
  const planned = plan.days.reduce((a, d) => a + d.meals.length, 0);
  const eaten = plan.days.reduce((a, d, i) => a + d.meals.filter((_, j) => ticks[`${i}:${j}`]).length, 0);
  const portions = plan.days.reduce((a, d) => a + d.meals.filter((m) => m.slot !== 'snack').reduce((b, m) => b + m.scale + m.extra, 0), 0);
  const perMealPence = portions ? Math.round(shopping.totalPence / portions) : 0;
  return {
    eaten, planned, daysInBand: plan.days.filter((d) => !d.off && d.inBand).length, days: plan.days.filter((d) => !d.off).length, averages: weekAverages(plan),
    perMealPence, savedPence: Math.max(0, Math.round((MEAL_PREP_PENCE - perMealPence) * portions)),
  };
}

/** True when every meal in the week has been ticked off. */
export const allEaten = (plan: Plan, ticks: Record<string, boolean>) => plan.days.length > 0 && plan.days.every((d, i) => d.meals.every((_, j) => ticks[`${i}:${j}`]));
