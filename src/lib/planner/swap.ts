import { PRODUCTS, RECIPES, type Course, type Recipe } from '@/data';
import { safeRecipes } from '../allergens';
import { computeTargets } from '../targets';
import { buildShopping } from './shopping';
import { RESIZE_WEIGHT, SCALE_MAX, SCALE_MIN, TOPUP_SETS } from './solve';
import type { Plan, PlanInput, PlannedDay, PlannedMeal } from './types';

const byId = new Map(RECIPES.map((r) => [r.id, r]));
const round1 = (x: number) => Math.round(x * 100) / 100;

/**
 * Re-fits one day around its (possibly changed) meals, the way the planner does: breakfast and snacks stay as written,
 * lunch and dinner may be resized (SCALE_MIN..SCALE_MAX), and top-ups are re-chosen. Prefers in band with the least change;
 * otherwise the closest miss, flagged `inBand: false`.
 */
export function refitDay(input: PlanInput, day: PlannedDay, mealIds: string[]): PlannedDay {
  const T = computeTargets(input.goal, input.stats);
  const rk = day.reserved.kcal, rp = day.reserved.protein;
  const lo = T.band[0] - rk, hi = T.band[1] - rk, mid = (lo + hi) / 2, needP = T.protein - rp;
  const recipes = mealIds.map((id) => byId.get(id)!);
  const flex = day.meals.map((m) => m.slot === 'lunch' || m.slot === 'dinner');
  const fixedK = recipes.reduce((a, r, i) => a + (flex[i] ? 0 : r.k), 0), fixedP = recipes.reduce((a, r, i) => a + (flex[i] ? 0 : r.p), 0);
  const flexK = recipes.reduce((a, r, i) => a + (flex[i] ? r.k : 0), 0), flexP = recipes.reduce((a, r, i) => a + (flex[i] ? r.p : 0), 0);

  let best: { sc: number; tu: (typeof TOPUP_SETS)[number]; K: number; P: number; score: number; miss: number } | null = null;
  for (const tu of TOPUP_SETS) {
    const baseK = fixedK + tu.reduce((a, x) => a + x.k, 0), baseP = fixedP + tu.reduce((a, x) => a + x.p, 0);
    const scales = new Set<number>([1]);
    if (flexK) {
      const minS = Math.max(SCALE_MIN, (lo - baseK) / flexK, flexP ? (needP - baseP) / flexP : 0);
      const maxS = Math.min(SCALE_MAX, (hi - baseK) / flexK);
      if (minS <= maxS) scales.add(Math.min(maxS, Math.max(minS, 1)));
      scales.add(Math.min(SCALE_MAX, Math.max(SCALE_MIN, (mid - baseK) / flexK)));
    }
    for (const raw of scales) {
      const sc = Math.abs(raw - 1) <= 0.02 ? 1 : raw;
      const K = baseK + sc * flexK, P = baseP + sc * flexP;
      const miss = Math.max(0, lo - K) + Math.max(0, K - hi) + Math.max(0, needP - P) * 8;
      const score = Math.abs(mid - K) * 0.5 + Math.abs(sc - 1) * RESIZE_WEIGHT + tu.length * 30;
      const better = !best || (miss === 0 && best.miss > 0) || (miss === 0 ? score < best.score : best.miss > 0 && miss < best.miss);
      if (better) best = { sc, tu, K, P, score, miss };
    }
  }
  const b = best!;
  const meals: PlannedMeal[] = day.meals.map((m, i) => {
    const scl = flex[i] ? b.sc : 1, r = recipes[i];
    return { slot: m.slot, recipeId: r.id, scale: round1(scl), extra: m.extra, kcal: Math.round(r.k * scl), protein: Math.round(r.p * scl) };
  });
  return {
    ...day, meals, topups: b.tu, kcal: Math.round(b.K + rk), protein: Math.round(b.P + rp),
    inBand: b.miss === 0, adjusted: b.sc !== 1 || b.tu.length > 0,
  };
}

export interface SwapOption {
  recipe: Recipe;
  /** The day as it would be after the swap (portions and top-ups re-fitted). */
  day: PlannedDay;
  dKcal: number;
  dProtein: number;
  /** Change to the week's shopping total, in pence. */
  dWeekPence: number;
  /** In the person's liked meals; false means a meal they haven't rated. */
  liked: boolean;
  withinSpend: boolean;
}

/** Ranked same-course alternatives for one meal. In-band days first, then within the spend limit, then liked, then the smallest change. */
export function swapOptions(plan: Plan, dayIndex: number, mealIndex: number, input: PlanInput, limit = 6): SwapOption[] {
  const day = plan.days[dayIndex];
  const cur = day?.meals[mealIndex];
  if (!cur) return [];
  const course = cur.slot as Course;
  const skipped = new Set(input.skipped ?? []), liked = new Set(input.liked);
  const inDay = new Set(day.meals.map((m) => m.recipeId));
  const usedElsewhere = new Set(plan.days.flatMap((d, i) => (i === dayIndex ? [] : d.meals.filter((m) => m.slot === cur.slot).map((m) => m.recipeId))));
  const cap = input.budget && input.budget !== 'high' ? ['low', 'medium', 'high'].indexOf(input.budget) : null;
  const dislike = (r: Recipe) => {
    const text = (r.n + ' ' + r.fresh.map(([k]) => PRODUCTS[k]?.n ?? k).join(' ')).toLowerCase();
    return input.dislikes.some((d) => text.includes(d.toLowerCase().replace(/s$/, '')));
  };
  const weekBefore = buildShopping(plan).totalPence;

  const options = safeRecipes(input.allergies)
    .filter((r) => r.c === course && !inDay.has(r.id) && !skipped.has(r.id) && !dislike(r))
    .map((r): SwapOption & { rank: number } => {
      const ids = day.meals.map((m, i) => (i === mealIndex ? r.id : m.recipeId));
      const next = refitDay(input, day, ids);
      const days = plan.days.map((d, i) => (i === dayIndex ? next : d));
      const dKcal = next.kcal - day.kcal, dProtein = next.protein - day.protein;
      const withinSpend = cap === null || !r.b || ['low', 'medium', 'high'].indexOf(r.b) <= cap;
      const rank = (next.inBand ? 0 : 1000) + (withinSpend ? 0 : 300) + (liked.has(r.id) ? 0 : 60) + (usedElsewhere.has(r.id) ? 40 : 0) + Math.abs(dKcal) * 0.5 + Math.abs(dProtein) * 3;
      return { recipe: r, day: next, dKcal, dProtein, dWeekPence: buildShopping({ ...plan, days }).totalPence - weekBefore, liked: liked.has(r.id), withinSpend, rank };
    })
    .sort((a, b) => a.rank - b.rank)
    .slice(0, limit);
  return options.map(({ rank: _rank, ...o }) => o);
}

/** The plan with one meal replaced and its day re-fitted. Meal order and count are unchanged, so eaten-ticks stay valid. */
export function applySwap(plan: Plan, dayIndex: number, mealIndex: number, recipeId: string, input: PlanInput): Plan {
  const day = plan.days[dayIndex];
  if (!day?.meals[mealIndex] || !byId.has(recipeId)) return plan;
  const ids = day.meals.map((m, i) => (i === mealIndex ? recipeId : m.recipeId));
  return { ...plan, days: plan.days.map((d, i) => (i === dayIndex ? refitDay(input, day, ids) : d)) };
}
