import type { Profile } from './profile';

/** "Never suggest this again": out of the liked meals, into the skipped ones, so no future week plans or offers it. */
export function neverAgain(p: Profile, id: string): Profile {
  return { ...p, likedRecipes: p.likedRecipes.filter((x) => x !== id), skippedRecipes: p.skippedRecipes.includes(id) ? p.skippedRecipes : [...p.skippedRecipes, id] };
}

/** Undo for the above (and for a change of mind): back to neither liked nor skipped, i.e. unrated. */
export function forgetRating(p: Profile, id: string): Profile {
  return { ...p, likedRecipes: p.likedRecipes.filter((x) => x !== id), skippedRecipes: p.skippedRecipes.filter((x) => x !== id) };
}

/** "Liked it": keeps the meal in the pool the planner draws from. */
export function likeMeal(p: Profile, id: string): Profile {
  return { ...p, likedRecipes: p.likedRecipes.includes(id) ? p.likedRecipes : [...p.likedRecipes, id], skippedRecipes: p.skippedRecipes.filter((x) => x !== id) };
}
