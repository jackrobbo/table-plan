import type { Profile } from '../profile';
import type { PlanInput } from './types';

export function planInputFrom(p: Profile): PlanInput {
  return { goal: p.goal ?? 'lose', stats: p.stats, meals: p.meals, allergies: p.allergies, dislikes: p.dislikes, liked: p.likedRecipes };
}
