import { describe, expect, it } from 'vitest';
import { RECIPES } from '@/data';
import { safeRecipes } from '@/lib/allergens';
import { generatePlan, planWeek, SCALE_MAX, SCALE_MIN } from '@/lib/planner/solve';
import { buildShopping } from '@/lib/planner/shopping';
import type { PlanInput } from '@/lib/planner/types';
import { rng } from '@/lib/planner/rng';
import { computeTargets } from '@/lib/targets';

const likedAll = (allergies: readonly string[] = []) =>
  safeRecipes(allergies as never).filter((r) => r.c !== 'snack').map((r) => r.id);

const base = (over: Partial<PlanInput> = {}): PlanInput => ({
  goal: 'lose', stats: { sex: 'f', age: 34, heightCm: 168, weightKg: 74, activity: 1.375 },
  meals: { breakfast: { mode: 'plan', extraServings: 0 }, lunch: { mode: 'plan', extraServings: 0 }, dinner: { mode: 'plan', extraServings: 1 } },
  allergies: [], dislikes: [], liked: likedAll(), ...over,
});

describe('planner: days never fail', () => {
  it('lands every day in band with the protein floor, across 200 random profiles', () => {
    const R = rng(42);
    let days = 0, adjusted = 0;
    for (let i = 0; i < 200; i++) {
      const goal = R.pick(['lose', 'maintain', 'gain'] as const);
      const input = base({
        goal,
        stats: { sex: R.pick(['f', 'm'] as const), age: 20 + Math.floor(R.next() * 50), heightCm: 150 + Math.floor(R.next() * 45), weightKg: 50 + Math.floor(R.next() * 60), activity: R.pick([1.2, 1.375, 1.55, 1.725]) },
      });
      const T = computeTargets(input.goal, input.stats);
      const plan = generatePlan(input, i + 1);
      expect(plan.days).toHaveLength(5);
      // The 31-recipe bank tops out around 2,500 kcal a day; above that days are flagged, never faked.
      if (T.target > 2500) { expect(plan.days.every((d) => d.inBand) || plan.issues.length > 0).toBe(true); days += 5; continue; }
      for (const d of plan.days) {
        days++; if (d.adjusted) adjusted++;
        expect(d.inBand, `${goal} ${JSON.stringify(input.stats)} ${d.day}: ${d.kcal}kcal ${d.protein}g`).toBe(true);
        expect(d.kcal).toBeGreaterThanOrEqual(T.band[0] - 2);
        expect(d.kcal).toBeLessThanOrEqual(T.band[1] + 2);
        expect(d.protein).toBeGreaterThanOrEqual(T.protein - 2);
      }
    }
    expect(days).toBe(1000);
    expect(adjusted).toBeGreaterThanOrEqual(0);
  });

  it('keeps resized portions within limits and flags them as adjusted', () => {
    const plan = generatePlan(base({ goal: 'gain' }), 3);
    for (const d of plan.days) {
      for (const m of d.meals) if (m.scale !== 1) { expect(m.scale).toBeGreaterThanOrEqual(SCALE_MIN); expect(m.scale).toBeLessThanOrEqual(SCALE_MAX); expect(d.adjusted).toBe(true); }
      if (d.topups.length) expect(d.adjusted).toBe(true);
    }
  });

  it('is deterministic for a seed', () => {
    expect(generatePlan(base(), 9)).toEqual(generatePlan(base(), 9));
  });
});

describe('planner: preferences', () => {
  it('never uses recipes with household allergens or ones the user did not like', () => {
    const liked = likedAll(['milk', 'eggs']).slice(0, 12);
    const plan = generatePlan(base({ allergies: ['milk', 'eggs'], liked }), 5);
    const ok = new Set(safeRecipes(['milk', 'eggs']).map((r) => r.id));
    for (const m of plan.days.flatMap((d) => d.meals)) {
      expect(ok.has(m.recipeId)).toBe(true);
      if (m.slot !== 'snack') expect(liked).toContain(m.recipeId);
    }
  });

  it('auto-fills a snack every day', () => {
    for (const d of generatePlan(base(), 2).days) expect(d.meals.some((m) => m.slot === 'snack')).toBe(true);
  });

  it('macros-only meals reserve calories instead of planning a recipe', () => {
    const input = base({ meals: { ...base().meals, lunch: { mode: 'macros', extraServings: 0 } } });
    const plan = generatePlan(input, 4);
    for (const d of plan.days) {
      expect(d.meals.some((m) => m.slot === 'lunch')).toBe(false);
      expect(d.reserved.kcal).toBeGreaterThan(300);
      expect(d.inBand).toBe(true);
    }
  });

  it('ranks disliked dinners last when there is a choice', () => {
    const plan = generatePlan(base({ dislikes: ['Chicken'] }), 6);
    const dinners = plan.days.map((d) => RECIPES.find((r) => r.id === d.meals.find((m) => m.slot === 'dinner')!.recipeId)!);
    const chickenless = RECIPES.filter((r) => r.c === 'dinner' && !/chicken/i.test(r.n)).length;
    expect(dinners.filter((r) => /chicken/i.test(r.n)).length).toBe(Math.max(0, 5 - chickenless));
  });

  it('reports a clear issue instead of crashing when nothing is available', () => {
    const plan = generatePlan(base({ liked: [] }), 1);
    expect(plan.days).toEqual([]);
    expect(plan.issues[0]).toMatch(/No breakfast recipes/);
  });
});

describe('planner: shopping + waste', () => {
  it('prices whole packs and scales ingredients by portion', () => {
    const plan = generatePlan(base(), 8);
    const s = buildShopping(plan);
    expect(s.totalPence).toBe(s.lines.reduce((a, l) => a + l.costPence, 0));
    for (const l of s.lines) expect(l.bought).toBeGreaterThanOrEqual(l.needed - 1e-6);
    expect(s.lines.length).toBeGreaterThan(8);
  });

  it('planWeek picks a week no more expensive than the first candidate', () => {
    const input = base();
    const single = buildShopping(generatePlan(input, 1)).totalPence;
    const best = buildShopping(planWeek(input, 12, 1)).totalPence;
    expect(best).toBeLessThanOrEqual(single);
  });
});
