export type Goal = 'lose' | 'maintain' | 'gain';
export type Sex = 'f' | 'm';

export interface Stats {
  sex?: Sex; age?: number; heightCm?: number; weightKg?: number;
  /** Activity multiplier: 1.2 sitting, 1.375 light, 1.55 active, 1.725 very active. */
  activity: number;
}

export interface Targets {
  target: number;
  band: [number, number];
  protein: number;
  /** Provisional split (27% fat, rest carbs) pending dietitian review. */
  carbs: number;
  fat: number;
  maintenance: number | null;
  /** true when no stats were given and defaults were used */
  estimated: boolean;
}

const OFFSET: Record<Goal, number> = { lose: -500, maintain: 0, gain: 300 };
const DEFAULT_KCAL: Record<Goal, number> = { lose: 1500, maintain: 2000, gain: 2400 };
/** Never plan below this regardless of inputs (1,200-kcal floor is the dietitian-review item). */
export const KCAL_FLOOR = 1300;
/** Protein is capped at this share of daily calories. */
export const PROTEIN_MAX_SHARE = 0.35;

/** Mifflin–St Jeor; ported unchanged from the PoC. */
export function computeTargets(goal: Goal, s: Stats): Targets {
  const { sex, age, heightCm: ht, weightKg: wt, activity } = s;
  let maintenance: number | null = null;
  if (sex && age && ht && wt) {
    const bmr = 10 * wt + 6.25 * ht - 5 * age + (sex === 'm' ? 5 : -161);
    maintenance = Math.round(bmr * activity);
  }
  const raw = maintenance !== null ? maintenance + OFFSET[goal] : DEFAULT_KCAL[goal];
  const target = Math.max(KCAL_FLOOR, Math.round(raw / 10) * 10);
  // g/kg of bodyweight, but never more than 35% of calories: on a small deficit a heavier person's 1.8 g/kg
  // would be nearly half their food. Provisional pending dietitian review.
  const perKg = wt ? Math.round(wt * (goal === 'maintain' ? 1.6 : 1.8)) : Infinity;
  const fromKcal = Math.round((target * (goal === 'maintain' ? 0.25 : 0.3)) / 4);
  const protein = Math.min(perKg, Math.round((target * PROTEIN_MAX_SHARE) / 4), wt ? Infinity : fromKcal);
  const fat = Math.round((target * 0.27) / 9 / 5) * 5;
  const carbs = Math.max(0, Math.round((target - protein * 4 - fat * 9) / 4 / 5) * 5);
  return { target, carbs, fat, band: [target - 100, target + 60], protein, maintenance, estimated: maintenance === null };
}
