import { describe, expect, it } from 'vitest';
import { RECIPES } from '@/data';
import { isSafeFor, safeRecipes } from '@/lib/allergens';
import { planWeek } from '@/lib/planner/solve';
import { applySwap, refitDay, swapOptions } from '@/lib/planner/swap';
import type { PlanInput } from '@/lib/planner/types';
import { computeTargets } from '@/lib/targets';

const byId = new Map(RECIPES.map((r) => [r.id, r]));
const base = (over: Partial<PlanInput> = {}): PlanInput => ({
  goal: 'lose', stats: { sex: 'f', age: 34, heightCm: 168, weightKg: 74, activity: 1.375 },
  meals: { breakfast: { mode: 'plan', extraServings: 0 }, lunch: { mode: 'plan', extraServings: 0 }, dinner: { mode: 'plan', extraServings: 1 } },
  allergies: [], dislikes: [], liked: safeRecipes([]).filter((r) => r.c !== 'snack').map((r) => r.id), ...over,
});

describe('swapping a meal', () => {
  const input = base({ allergies: ['milk'], dislikes: ['mushroom'] });
  const plan = planWeek(input, 6, 11);
  const T = computeTargets(input.goal, input.stats);

  it('offers other meals of the same course that are safe, not disliked and not already that day', () => {
    plan.days[0].meals.forEach((m, mi) => {
      const opts = swapOptions(plan, 0, mi, input);
      expect(opts.length, `${m.slot}`).toBeGreaterThan(0);
      for (const o of opts) {
        expect(o.recipe.c).toBe(m.slot);
        expect(isSafeFor(o.recipe, ['milk'])).toBe(true);
        expect(o.recipe.n.toLowerCase()).not.toContain('mushroom');
        expect(plan.days[0].meals.map((x) => x.recipeId)).not.toContain(o.recipe.id);
      }
    });
  });

  it('puts options that keep the day in band first, and tells the truth about the band', () => {
    const lunch = plan.days[1].meals.findIndex((m) => m.slot === 'lunch');
    const opts = swapOptions(plan, 1, lunch, input, 10);
    const flags = opts.map((o) => o.day.inBand);
    expect(flags).toEqual([...flags].sort((a, b) => Number(b) - Number(a)));
    for (const o of opts) {
      const inBand = o.day.kcal >= T.band[0] - 2 && o.day.kcal <= T.band[1] + 2 && o.day.protein >= T.protein - 2;
      expect(o.day.inBand, `${o.recipe.id} ${o.day.kcal}kcal ${o.day.protein}g`).toBe(inBand);
      expect(o.dKcal).toBe(o.day.kcal - plan.days[1].kcal);
    }
  });

  it('replaces the meal in place: same order and count (so eaten-ticks stay valid), day totals add up', () => {
    const dinner = plan.days[2].meals.findIndex((m) => m.slot === 'dinner');
    const pick = swapOptions(plan, 2, dinner, input)[0];
    const next = applySwap(plan, 2, dinner, pick.recipe.id, input);
    const d = next.days[2];
    expect(d.meals.map((m) => m.slot)).toEqual(plan.days[2].meals.map((m) => m.slot));
    expect(d.meals[dinner].recipeId).toBe(pick.recipe.id);
    expect(d.meals.filter((_, i) => i !== dinner).map((m) => m.recipeId)).toEqual(plan.days[2].meals.filter((_, i) => i !== dinner).map((m) => m.recipeId));
    const sumK = d.meals.reduce((a, m) => a + m.kcal, 0) + d.topups.reduce((a, t) => a + t.k, 0) + d.reserved.kcal;
    expect(Math.abs(d.kcal - sumK)).toBeLessThanOrEqual(d.meals.length + 1);   // per-meal rounding only
    expect(next.days.filter((_, i) => i !== 2)).toEqual(plan.days.filter((_, i) => i !== 2));
    expect(plan.days[2].meals[dinner].recipeId).not.toBe(pick.recipe.id);        // the original plan is untouched
  });

  it('can swap a snack, and re-fitting an unchanged day changes nothing material', () => {
    const sn = plan.days[0].meals.findIndex((m) => m.slot === 'snack');
    expect(swapOptions(plan, 0, sn, input).every((o) => o.recipe.c === 'snack')).toBe(true);
    const same = refitDay(input, plan.days[0], plan.days[0].meals.map((m) => m.recipeId));
    expect(same.inBand).toBe(plan.days[0].inBand);
    expect(Math.abs(same.kcal - plan.days[0].kcal)).toBeLessThanOrEqual(60);
  });

  it('ignores a swap that does not exist', () => {
    expect(swapOptions(plan, 9, 0, input)).toEqual([]);
    expect(applySwap(plan, 0, 99, 'nope', input)).toBe(plan);
    expect(byId.has('nope')).toBe(false);
  });
});
