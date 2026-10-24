import { safeRecipes } from './allergens';
import type { Course } from '@/data';
import type { MealTime, OnboardingStep, Profile } from './profile';

export const STEPS: OnboardingStep[] = [
  'goal', 'height', 'weight', 'age', 'sex', 'activity', 'meals', 'allergies', 'target', 'dislikes', 'taste',
];

/** Minimum likes per planned meal type in the taste swipe. No upper limit. */
export const MIN_LIKES = 5;

export const stepIndex = (s: OnboardingStep) => STEPS.indexOf(s);
export const nextStep = (s: OnboardingStep): OnboardingStep | null => STEPS[stepIndex(s) + 1] ?? null;
export const prevStep = (s: OnboardingStep): OnboardingStep | null => STEPS[stepIndex(s) - 1] ?? null;

/** Meal types that appear in the taste swipe (macros-only meals need no recipes). */
export const swipeCourses = (p: Profile): MealTime[] =>
  (['breakfast', 'lunch', 'dinner'] as const).filter((m) => p.meals[m].mode === 'plan');

export function tasteProgress(p: Profile): Record<MealTime, { liked: number; needed: number; available: number }> {
  const safe = safeRecipes(p.allergies);
  const out = {} as Record<MealTime, { liked: number; needed: number; available: number }>;
  for (const m of ['breakfast', 'lunch', 'dinner'] as const) {
    const pool = safe.filter((r) => r.c === (m as Course));
    const liked = pool.filter((r) => p.likedRecipes.includes(r.id)).length;
    const needed = p.meals[m].mode === 'plan' ? Math.min(MIN_LIKES, pool.length) : 0;
    out[m] = { liked, needed, available: pool.length };
  }
  return out;
}

export function canContinue(p: Profile, step: OnboardingStep): boolean {
  const { stats } = p;
  switch (step) {
    case 'goal': return p.goal !== null;
    case 'height': return !!stats.heightCm && stats.heightCm >= 100 && stats.heightCm <= 250;
    case 'weight': return !!stats.weightKg && stats.weightKg >= 30 && stats.weightKg <= 300;
    case 'age': return !!stats.age && stats.age >= 18 && stats.age <= 100;
    case 'sex': return !!stats.sex;
    case 'activity': return true;
    case 'meals': return swipeCourses(p).length > 0;
    case 'allergies': return p.noAllergies || p.allergies.length > 0;
    case 'target':
    case 'dislikes': return true;
    case 'taste': {
      const prog = tasteProgress(p);
      return (['breakfast', 'lunch', 'dinner'] as const).every((m) => prog[m].liked >= prog[m].needed);
    }
  }
}

/** Steps whose stat can be skipped; skipping clears the value so defaults apply. */
export const SKIPPABLE = ['height', 'weight', 'age', 'sex'] as const;
export type SkippableStep = (typeof SKIPPABLE)[number];

export function skipStat(p: Profile, step: SkippableStep): Profile {
  const stats = { ...p.stats };
  if (step === 'height') delete stats.heightCm;
  if (step === 'weight') delete stats.weightKg;
  if (step === 'age') delete stats.age;
  if (step === 'sex') delete stats.sex;
  return { ...p, stats, skipped: { ...p.skipped, [step]: true } };
}

export function setAllergies(p: Profile, allergies: Profile['allergies']): Profile {
  // Allergies change which recipes are safe; drop any likes that are no longer eligible.
  const safe = new Set(safeRecipes(allergies).map((r) => r.id));
  return {
    ...p, allergies, noAllergies: false,
    likedRecipes: p.likedRecipes.filter((id) => safe.has(id)),
    skippedRecipes: p.skippedRecipes.filter((id) => safe.has(id)),
  };
}

export function swipe(p: Profile, id: string, keep: boolean): Profile {
  const likedRecipes = p.likedRecipes.filter((x) => x !== id);
  const skippedRecipes = p.skippedRecipes.filter((x) => x !== id);
  (keep ? likedRecipes : skippedRecipes).push(id);
  return { ...p, likedRecipes, skippedRecipes };
}

export function advance(p: Profile): Profile {
  const n = nextStep(p.step);
  return n ? { ...p, step: n } : { ...p, completed: true };
}

export function back(p: Profile): Profile {
  const b = prevStep(p.step);
  return b ? { ...p, step: b } : p;
}
