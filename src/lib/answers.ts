import { canContinue, swipeCourses, tasteProgress, type SkippableStep } from './onboarding';
import type { Profile } from './profile';
import { computeTargets } from './targets';

/** The answers Settings edits. Everything else (weeks, reminders, onboarding position) is deliberately left out. */
export const answersOf = (p: Profile) => ({
  goal: p.goal, heightUnit: p.heightUnit, weightUnit: p.weightUnit, stats: p.stats, skipped: p.skipped, meals: p.meals,
  allergies: p.allergies, noAllergies: p.noAllergies, dislikes: p.dislikes, budget: p.budget, likedRecipes: p.likedRecipes, skippedRecipes: p.skippedRecipes,
});
export type Answers = ReturnType<typeof answersOf>;

/** Saves edited answers onto the stored profile without touching planned weeks, reminders or where onboarding was up to. */
export const applyAnswers = (p: Profile, edited: Profile): Profile => ({ ...p, ...answersOf(edited) });

export const answersChanged = (a: Profile, b: Profile) => JSON.stringify(answersOf(a)) !== JSON.stringify(answersOf(b));

export const STAT_STEPS: SkippableStep[] = ['height', 'weight', 'age', 'sex'];
export const STAT_NAME: Record<SkippableStep, string> = { height: 'height', weight: 'weight', age: 'age (18 or over)', sex: 'sex' };

/** What stops these answers being saved (empty = fine). A stat may be left out only if the person chose to. */
export function answerProblems(p: Profile): string[] {
  return [
    p.goal === null && 'Choose a goal.',
    ...STAT_STEPS.filter((s) => !(canContinue(p, s) || p.skipped[s])).map((s) => `Check your ${STAT_NAME[s]}, or remove your stats to use a typical target.`),
    swipeCourses(p).length === 0 && 'Plan at least one meal.',
    !(p.noAllergies || p.allergies.length > 0) && 'Pick any allergies, or say no one has any.',
  ].filter((x): x is string => !!x);
}

/** Planned courses that don't yet have enough liked meals. */
export const coursesNeedingLikes = (p: Profile) => {
  const prog = tasteProgress(p);
  return swipeCourses(p).filter((m) => prog[m].liked < prog[m].needed);
};

/** Daily target before/after, for the "Was …" line. */
export const targetsDiffer = (a: Profile, b: Profile) => {
  const x = computeTargets(a.goal ?? 'lose', a.stats), y = computeTargets(b.goal ?? 'lose', b.stats);
  return x.band[0] !== y.band[0] || x.band[1] !== y.band[1] || x.protein !== y.protein;
};
