import type { Goal, Targets, UserStats } from "./types";

const GOAL_OFFSET: Record<Goal, number> = { lose: -500, maintain: 0, gain: 300 };
const GOAL_DEFAULT: Record<Goal, number> = { lose: 1500, maintain: 2000, gain: 2400 };

/**
 * Mifflin–St Jeor TDEE + goal offset → a personal calorie band and protein floor.
 * Falls back to a sensible default when stats are missing (`est: true`).
 */
export function computeTargets(goal: Goal, s: UserStats): Targets {
  let tdee: number | null = null;
  if (s.sex && s.age && s.ht && s.wt) {
    const bmr = 10 * s.wt + 6.25 * s.ht - 5 * s.age + (s.sex === "m" ? 5 : -161);
    tdee = Math.round(bmr * s.act);
  }
  let target = tdee ? tdee + GOAL_OFFSET[goal] : GOAL_DEFAULT[goal];
  target = Math.max(1300, Math.round(target / 10) * 10);
  const protein = s.wt
    ? Math.round(s.wt * (goal === "maintain" ? 1.6 : 1.8))
    : Math.round((target * (goal === "maintain" ? 0.25 : 0.3)) / 4);
  const band: [number, number] = [target - 100, target + 60];
  return { target, band, protein, est: !tdee };
}
