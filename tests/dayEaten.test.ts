import { describe, expect, it } from 'vitest';
import { RECIPES } from '../src/data';
import { dayEaten } from '../src/lib/cycle/summary';
import type { PlannedDay } from '../src/lib/planner/types';

const r = RECIPES[0];
const meal = (kcal: number, protein: number, scale = 1) => ({ slot: 'lunch' as const, recipeId: r.id, scale, extra: 0, kcal, protein });
const day = (meals: ReturnType<typeof meal>[]): PlannedDay => ({ day: 'Monday', meals, topups: [], kcal: 0, protein: 0, reserved: { kcal: 0, protein: 0 }, inBand: true, adjusted: false });

describe('dayEaten', () => {
  it('counts only ticked meals', () => {
    const d = day([meal(500, 30), meal(300, 20)]);
    expect(dayEaten(d, 0, {})).toMatchObject({ kcal: 0, protein: 0, eaten: 0, meals: 2 });
    expect(dayEaten(d, 0, { '0:0': true })).toMatchObject({ kcal: 500, protein: 30, eaten: 1, meals: 2 });
    expect(dayEaten(d, 0, { '0:0': true, '0:1': true })).toMatchObject({ kcal: 800, protein: 50, eaten: 2 });
  });
  it('keys ticks by day index and scales carbs and fat by portion', () => {
    const d = day([meal(500, 30, 2)]);
    expect(dayEaten(d, 3, { '0:0': true }).eaten).toBe(0);
    const e = dayEaten(d, 3, { '3:0': true });
    expect(e.carbs).toBe(Math.round((r.cb ?? 0) * 2));
    expect(e.fat).toBe(Math.round((r.f ?? 0) * 2));
  });
});
