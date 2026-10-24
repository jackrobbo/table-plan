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
const TRIALS = 100;
/** Typical split of a day's calories; snacks take the rest. Only steers sampling, never a constraint. */
const KCAL_SHARE = { breakfast: 0.27, lunch: 0.3, dinner: 0.33, snack: 0.1 } as const;
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

  // Where a day's calories usually go, used to steer sampling (breakfast/lunch/dinner share what snacks leave).
  const planned = (['breakfast', 'lunch', 'dinner'] as const).filter((c) => input.meals[c].mode === 'plan');
  const totalShare = planned.reduce((a, c) => a + KCAL_SHARE[c], 0) + KCAL_SHARE.snack;
  const slotTarget = { breakfast: (mid * KCAL_SHARE.breakfast) / totalShare, lunch: (mid * KCAL_SHARE.lunch) / totalShare, dinner: (mid * KCAL_SHARE.dinner) / totalShare };
  const proteinPerKcal = needP / Math.max(mid, 1);
  /** Sampling weight: close to the target size (log scale, so too big and too small are equally bad) and protein-dense enough. */
  const fit = (r: Recipe, target: number) => {
    const z = Math.log(r.k / Math.max(target, 1));
    return Math.exp(-(z * z) / (2 * 0.45 * 0.45)) * (0.4 + Math.min(1.6, r.p / r.k / Math.max(proteinPerKcal, 1e-6)));
  };
  /** Every set of 1–3 distinct snacks, for the exhaustive fallback. */
  const SNACK_SETS = P.snack
    .flatMap((a, i) => [[a], ...P.snack.slice(i + 1).flatMap((b, j) => [[a, b], ...P.snack.slice(i + j + 2).map((c) => [a, b, c])])])
    .map((items) => ({ items, k: items.reduce((a, x) => a + x.k, 0), p: items.reduce((a, x) => a + x.p, 0) }));
  const MAX_TOPUP_K = TOPUPS.map((t) => t.k).sort((a, b) => b - a).slice(0, 2).reduce((a, k) => a + k, 0);
  const AVG_SNACK_KCAL = P.snack.reduce((a, x) => a + x.k, 0) / Math.max(1, P.snack.length);

  const dinners: Recipe[] = [];
  if (input.meals.dinner.mode === 'plan') {
    const order = R.weightedShuffle(P.dinner, (r) => fit(r, slotTarget.dinner)).sort((a, b) => dislikeHits(a, input.dislikes) - dislikeHits(b, input.dislikes));
    for (let i = 0; i < DAY_NAMES.length; i++) dinners.push(order[i % order.length]);
  }

  const useCount: Record<string, number> = {};
  const bought = new Set<string>();
  const days: PlannedDay[] = [];

  for (let d = 0; d < DAY_NAMES.length; d++) {
    let din = dinners[d] ?? null;
    let best: { day: PlannedDay; score: number } | null = null;
    let closest: { day: PlannedDay; miss: number } | null = null;

    /** Scores one candidate day (b, l, snacks + every top-up set at the best portion scale) and keeps it if it beats the current best. */
    const consider = (b: Recipe | null, l: Recipe | null, snacks: Recipe[], snackK = snacks.reduce((a, x) => a + x.k, 0), snackP = snacks.reduce((a, x) => a + x.p, 0)) => {
      const all = [b, l, din, ...snacks];
      const flexible = [l, din].filter((x): x is Recipe => !!x);
      const fixedK = (b?.k ?? 0) + snackK, fixedP = (b?.p ?? 0) + snackP;
      const flexK = flexible.reduce((a, r) => a + r.k, 0), flexP = flexible.reduce((a, r) => a + r.p, 0);

      for (const tu of TOPUP_SETS) {
        const tuK = tu.reduce((a, x) => a + x.k, 0), tuP = tu.reduce((a, x) => a + x.p, 0);
        const baseK = fixedK + tuK, baseP = fixedP + tuP;
        // Resize the cooked meals as little as possible: the portion scale that puts both calories and protein in range
        // (nearest 1), else the scale aimed at the middle of the band as the best effort.
        const scales = new Set<number>([1]);
        if (flexK) {
          const minS = Math.max(SCALE_MIN, (lo - baseK) / flexK, flexP ? (needP - baseP) / flexP : 0);
          const maxS = Math.min(SCALE_MAX, (hi - baseK) / flexK);
          if (minS <= maxS) scales.add(Math.min(maxS, Math.max(minS, 1)));
          scales.add(Math.min(SCALE_MAX, Math.max(SCALE_MIN, (mid - baseK) / flexK)));
        }
        for (const raw of scales) {
          const sc = Math.abs(raw - 1) <= 0.02 ? 1 : raw;   // not worth flagging a 2% nudge
          const K = baseK + sc * flexK;
          const Pn = baseP + sc * flexP;
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
            inBand, adjusted: sc !== 1 || tu.length > 0,
          };
          if (inBand) best = { day, score }; else closest = { day, miss };
        }
      }
    };

    for (let t = 0; t < TRIALS; t++) {
      // Sample meals whose size and protein density suit this person's day, not uniformly: with a bank of ~100 meals, uniform
      // sampling rarely lands a tight (small, high-protein) day. Everything is still random, so weeks vary.
      const b = P.breakfast.length ? R.pickWeighted(P.breakfast, (r) => fit(r, slotTarget.breakfast)) : null;
      const l = P.lunch.length ? R.pickWeighted(P.lunch, (r) => fit(r, slotTarget.lunch)) : null;
      // Snacks auto-fill: as many as the day's calorie gap calls for (1–3), give or take one.
      const gap = mid - ((b?.k ?? 0) + (l?.k ?? 0) + (din?.k ?? 0));
      const n = Math.min(3, Math.max(1, Math.round(gap / AVG_SNACK_KCAL)));
      const count = R.pick([n, n, n, Math.max(1, n - 1), Math.min(3, n + 1)]);
      const snacks: Recipe[] = [];
      for (let i = 0; i < count && snacks.length < P.snack.length; i++) {
        const left = P.snack.filter((x) => !snacks.includes(x));
        snacks.push(R.pickWeighted(left, (x) => fit(x, Math.max(60, gap / count))));
      }
      consider(b, l, snacks);
    }

    /** Every breakfast × lunch × snack-set that could possibly land in band with the current dinner (pruned by calories first). */
    const exhaustive = () => {
      let sinceBest = 0;   // once something lands in band, a few hundred more candidates are plenty to pick a good one
      for (const b of P.breakfast.length ? P.breakfast : [null]) {
        for (const l of P.lunch.length ? P.lunch : [null]) {
          const flex = (l?.k ?? 0) + (din?.k ?? 0);
          const lowK = lo - (b?.k ?? 0) - SCALE_MAX * flex - MAX_TOPUP_K, highK = hi - (b?.k ?? 0) - SCALE_MIN * flex;
          for (const set of SNACK_SETS) {
            if (set.k < lowK || set.k > highK) continue;
            if (best && ++sinceBest > 400) return;
            consider(b, l, set.items, set.k, set.p);
          }
        }
      }
    };
    if (!best) {
      // Sampling found nothing in band. Check every combination with this dinner, and if the dinner itself is the problem
      // (too big or too small for the day) swap it, trying dinners not yet used this week first. Rare, so the cost is fine.
      exhaustive();
      if (!best && input.meals.dinner.mode === 'plan') {
        const used = new Set(days.map((x) => x.meals.find((m) => m.slot === 'dinner')?.recipeId));
        const alts = P.dinner.filter((x) => x !== din).sort((a, b) => Number(used.has(a.id)) - Number(used.has(b.id)) || fit(b, slotTarget.dinner) - fit(a, slotTarget.dinner));
        for (const alt of alts) { din = alt; exhaustive(); if (best) break; }
      }
    }

    if (!best) {
      // Couldn't land in band with the recipes available (e.g. a very high calorie target): keep the closest
      // attempt and say so, rather than pretending.
      best = { day: closest!.day, score: 0 };
    }

    for (const m of best.day.meals) {
      if (m.slot !== 'dinner') useCount[m.recipeId] = (useCount[m.recipeId] ?? 0) + 1;
      RECIPES.find((r) => r.id === m.recipeId)?.fresh.forEach(([k]) => bought.add(k));
    }
    best.day.topups.forEach((t) => bought.add(t.prod));
    days.push(best.day);
  }
  issues.push(...explainMisses(days, T.band, T.protein));
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

const list = (names: string[]) => (names.length <= 2 ? names.join(' and ') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`);

/**
 * Plain-language reasons for days that could not be landed in band, grouped by cause so a week of misses is
 * one message, not five. Says what actually limits the plan instead of blaming the user's choices.
 */
export function explainMisses(days: PlannedDay[], band: [number, number], protein: number): string[] {
  const off = days.filter((d) => !d.inBand);
  const out: string[] = [];
  const low = off.filter((d) => d.kcal < band[0]);
  const high = off.filter((d) => d.kcal > band[1]);
  const lean = off.filter((d) => d.kcal >= band[0] && d.kcal <= band[1] && d.protein < protein);
  const range = (ds: PlannedDay[]) => { const k = ds.map((d) => d.kcal); return Math.min(...k) === Math.max(...k) ? `${k[0]}` : `${Math.min(...k)}–${Math.max(...k)}`; };
  if (low.length) {
    out.push(`${list(low.map((d) => d.day))} land short of your ${band[0]}–${band[1]} kcal target (about ${range(low)} kcal). `
      + 'Our recipe bank can\'t reach a target this high on every day yet, so those days will be lighter than your target. Bigger portions and more recipes are on the way.');
  }
  if (high.length) {
    out.push(`${list(high.map((d) => d.day))} run over your ${band[0]}–${band[1]} kcal band (about ${range(high)} kcal). Liking a few lighter meals would give the planner more room.`);
  }
  if (lean.length) {
    out.push(`${list(lean.map((d) => d.day))} are in your calorie band but under your ${protein}g protein floor. Liking more high-protein meals would help.`);
  }
  return out;
}
