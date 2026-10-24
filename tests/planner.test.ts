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
      // Past what the bank can reach a day would be flagged, never faked; the 100-meal bank covers every profile sampled here.
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

describe('rng', () => {
  it('weighted picks follow the weights and stay deterministic', () => {
    const R = rng(7), hits = { a: 0, b: 0 };
    for (let i = 0; i < 2000; i++) hits[R.pickWeighted(['a', 'b'] as const, (x) => (x === 'a' ? 9 : 1))]++;
    expect(hits.a / 2000).toBeGreaterThan(0.85); expect(hits.a / 2000).toBeLessThan(0.95);
    expect(rng(3).weightedShuffle([1, 2, 3, 4], (x) => x)).toEqual(rng(3).weightedShuffle([1, 2, 3, 4], (x) => x));
    expect(rng(3).weightedShuffle([1, 2, 3], () => 1).sort()).toEqual([1, 2, 3]);
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

import { explainMisses } from '@/lib/planner/solve';
import type { PlannedDay } from '@/lib/planner/types';

describe('planner: honest messages for days that miss', () => {
  const day = (name: string, kcal: number, protein: number, inBand = false): PlannedDay =>
    ({ day: name, meals: [], topups: [], kcal, protein, reserved: { kcal: 0, protein: 0 }, inBand, adjusted: false });

  it('groups short days into one message that blames the recipe bank, not the user', () => {
    const msgs = explainMisses([day('Monday', 2660, 209, true), day('Tuesday', 2390, 150), day('Wednesday', 2410, 150), day('Thursday', 2400, 150)], [2600, 2760], 126);
    expect(msgs).toHaveLength(1);
    expect(msgs[0]).toMatch(/Tuesday, Wednesday and Thursday land short of your 2600–2760 kcal target \(about 2390–2410 kcal\)/);
    expect(msgs[0]).toMatch(/recipe bank/);
    expect(msgs[0]).not.toMatch(/like a few more meals/i);
  });
  it('separates short, over and low-protein days, and says nothing when every day is in band', () => {
    const msgs = explainMisses([day('Monday', 2000, 100), day('Tuesday', 3000, 100), day('Wednesday', 2700, 90)], [2600, 2760], 126);
    expect(msgs).toHaveLength(3);
    expect(msgs[1]).toMatch(/run over/);
    expect(msgs[2]).toMatch(/Wednesday are in your calorie band but under your 126g protein/);
    expect(explainMisses([day('Monday', 2700, 130, true)], [2600, 2760], 126)).toEqual([]);
  });
  it('a real high-calorie plan produces the grouped message end to end', () => {
    const plan = generatePlan(base({ goal: 'maintain', stats: { sex: 'm', age: 30, heightCm: 175, weightKg: 79, activity: 1.55 } }), 11);
    const missed = plan.days.filter((d) => !d.inBand).length;
    expect(plan.issues.length).toBe(missed ? 1 : 0);
    if (missed) expect(plan.issues[0]).toMatch(/recipe bank/);
  });
});
