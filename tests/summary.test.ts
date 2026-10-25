import { describe, expect, it } from 'vitest';
import { allEaten, dayCarbsFat, summariseWeek, weekAverages, MEAL_PREP_PENCE } from '@/lib/cycle/summary';
import { planWeek } from '@/lib/planner/solve';
import { buildShopping } from '@/lib/planner/shopping';
import { safeRecipes } from '@/lib/allergens';
import type { PlanInput } from '@/lib/planner/types';

const input: PlanInput = {
  goal: 'lose', stats: { sex: 'f', age: 34, heightCm: 168, weightKg: 74, activity: 1.375 },
  meals: { breakfast: { mode: 'plan', extraServings: 0 }, lunch: { mode: 'plan', extraServings: 0 }, dinner: { mode: 'plan', extraServings: 1 } },
  allergies: [], dislikes: [], liked: safeRecipes([]).filter((r) => r.c !== 'snack').map((r) => r.id),
};
const plan = planWeek(input, 4, 5);
const shopping = buildShopping(plan);
const all = Object.fromEntries(plan.days.flatMap((d, i) => d.meals.map((_, j) => [`${i}:${j}`, true])));

describe('week summary', () => {
  it('averages the week per day and finds carbs and fat from the recipes', () => {
    const a = weekAverages(plan);
    expect(a.kcal).toBe(Math.round(plan.days.reduce((s, d) => s + d.kcal, 0) / plan.days.length));
    expect(a.protein).toBeGreaterThan(100);
    const d = dayCarbsFat(plan.days[0]);
    expect(d.carbs).toBeGreaterThan(0); expect(d.fat).toBeGreaterThan(0);
  });
  it('counts what was eaten, days in band, and compares cost per meal with meal prep', () => {
    const half = summariseWeek(plan, {}, shopping);
    expect(half.eaten).toBe(0);
    const s = summariseWeek(plan, all, shopping);
    expect(s.eaten).toBe(s.planned);
    expect(s.days).toBe(5);
    expect(s.daysInBand).toBe(plan.days.filter((d) => d.inBand).length);
    expect(s.perMealPence).toBeGreaterThan(50);
    expect(s.perMealPence).toBeLessThan(MEAL_PREP_PENCE);
    expect(s.savedPence).toBeGreaterThan(0);
  });
  it('knows when every meal is ticked', () => {
    expect(allEaten(plan, {})).toBe(false);
    expect(allEaten(plan, all)).toBe(true);
    expect(allEaten(plan, { ...all, '4:0': false })).toBe(false);
  });
});
