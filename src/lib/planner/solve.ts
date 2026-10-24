import { PRODUCTS, RECIPES, TOPUPS, type Recipe, type Topup } from '@/data';
import { safeRecipes } from '../allergens';
import { computeTargets } from '../targets';
import { rng } from './rng';
import { buildShopping } from './shopping';
import { DAY_NAMES, type Plan, type PlanInput, type PlannedDay, type PlannedMeal, type Slot } from './types';

/** How far a cooked meal's portion may be resized to land a day in band (before top-ups). */
export const SCALE_MIN = 0.8;
export const SCALE_MAX = 1.4;
/** Share of the daily band held for a "macros only" meal. */
export const RESERVE_SHARE = { breakfast: 0.25, lunch: 0.3, dinner: 0.35 } as const;

const DISLIKE_WEIGHT = 120;   // kcal-equivalents per disliked ingredient/name match
const REPEAT_WEIGHT = 40;
const RESIZE_WEIGHT = 220;    // prefer unadjusted portions
const SHARE_BONUS = 25;       // reuse of a product already bought this week
const TRIALS = 400;
/** Top-up combinations tried per candidate day: none, any one, any two. */
const TOPUP_SETS: Topup[][] = [[], ...TOPUPS.map((t) => [t]), ...TOPUPS.flatMap((a, i) => TOPUPS.slice(i + 1).map((b) => [a, b]))];

const round1 = (x: number) => Math.round(x * 100) / 100;

function dislikeHits(r: Recipe, dislikes: readonly string[]): number {
  if (!dislikes.length) return 0;
  const text = (r.n + ' ' + r.fresh.map(([k]) => PRODUCTS[k]?.n ?? k).join(' ')).toLowerCase();
  return dislikes.filter((d) => text.includes(d.toLowerCase().replace(/s$/, ''))).length;
}

interface Pools { breakfast: Recipe[]; lunch: Recipe[]; dinner: Recipe[]; snack: Recipe[] }

function pools(input: PlanInput): Pools {
  const safe = safeRecipes(input.allergies);
  const liked = new Set(input.liked);
  const planned = (c: 'breakfast' | 'lunch' | 'dinner') => (input.meals[c].mode === 'plan' ? safe.filter((r) => r.c === c && liked.has(r.id)) : []);
  return { breakfast: planned('breakfast'), lunch: planned('lunch'), dinner: planned('dinner'), snack: safe.filter((r) => r.c === 'snack') };
}

export function generatePlan(input: PlanInput, seed = 1): Plan {
  const T = computeTargets(input.goal, input.stats);
  const R = rng(seed);
  const P = pools(input);
  const issues: string[] = [];

  let reserveK = 0, reserveP = 0;
  for (const c of ['breakfast', 'lunch', 'dinner'] as const) {
    if (input.meals[c].mode === 'macros') { reserveK += T.target * RESERVE_SHARE[c]; reserveP += T.protein * RESERVE_SHARE[c]; }
  }
  const lo = T.band[0] - reserveK, hi = T.band[1] - reserveK, mid = (lo + hi) / 2, needP = T.protein - reserveP;

  for (const c of ['breakfast', 'lunch', 'dinner'] as const) {
    if (input.meals[c].mode === 'plan' && !P[c].length) issues.push(`No ${c} recipes available after allergies and taste choices.`);
  }
  if (!P.snack.length) issues.push('No snacks available after allergies.');
  if (issues.length) return { seed, days: [], issues };

  const dinners: Recipe[] = [];
  if (input.meals.dinner.mode === 'plan') {
    const order = R.shuffle(P.dinner).sort((a, b) => dislikeHits(a, input.dislikes) - dislikeHits(b, input.dislikes));
    for (let i = 0; i < DAY_NAMES.length; i++) dinners.push(order[i % order.length]);
  }

  const useCount: Record<string, number> = {};
  const bought = new Set<string>();
  const days: PlannedDay[] = [];

  for (let d = 0; d < DAY_NAMES.length; d++) {
    const din = dinners[d] ?? null;
    let best: { day: PlannedDay; score: number } | null = null;
    let closest: { day: PlannedDay; miss: number } | null = null;

    for (let t = 0; t < TRIALS; t++) {
      const b = P.breakfast.length ? R.pick(P.breakfast) : null;
      const l = P.lunch.length ? R.pick(P.lunch) : null;
      // Snacks auto-fill: usually one, more when the day needs the calories.
      const snacks = R.shuffle(P.snack).slice(0, R.pick([1, 1, 2, 3]));
      const all = [b, l, din, ...snacks];
      const flexible = [l, din].filter((x): x is Recipe => !!x);
      const fixedK = (b?.k ?? 0) + snacks.reduce((a, x) => a + x.k, 0), fixedP = (b?.p ?? 0) + snacks.reduce((a, x) => a + x.p, 0);
      const flexK = flexible.reduce((a, r) => a + r.k, 0), flexP = flexible.reduce((a, r) => a + r.p, 0);

      // Resize cooked meals toward the middle of the band, within limits.
      const scale = flexK ? Math.min(SCALE_MAX, Math.max(SCALE_MIN, (mid - fixedK) / flexK)) : 1;
      for (const tu of TOPUP_SETS) {
        const tuK = tu.reduce((a, x) => a + x.k, 0), tuP = tu.reduce((a, x) => a + x.p, 0);
        for (const sc of flexK ? [1, scale] : [1]) {
          const K = fixedK + sc * flexK + tuK;
          const Pn = fixedP + sc * flexP + tuP;
          const miss = Math.max(0, lo - K) + Math.max(0, K - hi) + Math.max(0, needP - Pn) * 8;
          const inBand = miss === 0;
          if (!inBand && closest && miss >= closest.miss) continue;

          const products = all.flatMap((r) => r?.fresh.map(([k]) => k) ?? []);
          const shared = products.filter((k) => bought.has(k)).length;
          const rep = [b, l, ...snacks].reduce((a, r) => a + (r ? useCount[r.id] ?? 0 : 0), 0);
          const dis = all.reduce((a, r) => a + (r ? dislikeHits(r, input.dislikes) : 0), 0);
          const score = Math.abs(mid - K) * 0.5 + rep * REPEAT_WEIGHT + dis * DISLIKE_WEIGHT + Math.abs(sc - 1) * RESIZE_WEIGHT + tu.length * 30 - shared * SHARE_BONUS;
          if (inBand && best && score >= best.score) continue;

          const meal = (slot: Slot, r: Recipe, scl: number): PlannedMeal => ({
            slot, recipeId: r.id, scale: round1(scl), extra: slot === 'snack' ? 0 : input.meals[slot].extraServings,
            kcal: Math.round(r.k * scl), protein: Math.round(r.p * scl),
          });
          const meals: PlannedMeal[] = [];
          if (b) meals.push(meal('breakfast', b, 1));
          if (l) meals.push(meal('lunch', l, sc));
          for (const sn of snacks) meals.push(meal('snack', sn, 1));
          if (din) meals.push(meal('dinner', din, sc));
          const day: PlannedDay = {
            day: DAY_NAMES[d], meals, topups: tu, kcal: Math.round(K + reserveK), protein: Math.round(Pn + reserveP),
            reserved: { kcal: Math.round(reserveK), protein: Math.round(reserveP) },
            inBand, adjusted: Math.abs(sc - 1) > 0.02 || tu.length > 0,
          };
          if (inBand) best = { day, score }; else closest = { day, miss };
        }
      }
    }

    if (!best) {
      // Couldn't land in band with the recipes available (e.g. a very high calorie target): keep the closest
      // attempt and say so, rather than pretending.
      issues.push(`${DAY_NAMES[d]} is outside your band; like a few more meals for more room.`);
      best = { day: closest!.day, score: 0 };
    }

    for (const m of best.day.meals) {
      if (m.slot !== 'dinner') useCount[m.recipeId] = (useCount[m.recipeId] ?? 0) + 1;
      RECIPES.find((r) => r.id === m.recipeId)?.fresh.forEach(([k]) => bought.add(k));
    }
    best.day.topups.forEach((t) => bought.add(t.prod));
    days.push(best.day);
  }
  return { seed, days, issues };
}

/**
 * Waste consolidation: build several candidate weeks and keep the one whose shopping list is cheapest
 * (fewest wasted pack leftovers), preferring weeks where every day lands in band.
 */
export function planWeek(input: PlanInput, candidates = 24, baseSeed = 1): Plan {
  let best: { plan: Plan; cost: number } | null = null;
  for (let i = 0; i < candidates; i++) {
    const plan = generatePlan(input, baseSeed + i * 7919);
    if (!plan.days.length) return plan;
    const misses = plan.days.filter((d) => !d.inBand).length;
    const cost = buildShopping(plan).totalPence + misses * 100000;
    if (!best || cost < best.cost) best = { plan, cost };
  }
  return best!.plan;
}
