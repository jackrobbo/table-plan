import { emptyProfile, type Profile } from '../profile';
import type { OnboardingStep } from '../profile';

/** Shape of a `profiles` row (see supabase/migrations/0001_init.sql). */
export interface ProfileRow {
  user_id: string;
  goal: Profile['goal'];
  height_unit: Profile['heightUnit'];
  weight_unit: Profile['weightUnit'];
  height_cm: number | null;
  weight_kg: number | null;
  age: number | null;
  sex: 'f' | 'm' | null;
  activity: number;
  skipped_stats: string[];
  meals: Profile['meals'];
  allergies: Profile['allergies'];
  no_allergies: boolean;
  dislikes: string[];
  liked_recipes: string[];
  skipped_recipes: string[];
  onboarding_step: string;
  completed: boolean;
  weeks: Profile['weeks'];
  budget: Profile['budget'];
  reminders: Profile['reminders'];
  consent: Profile['consent'];
}

const SKIP_KEYS = ['height', 'weight', 'age', 'sex'] as const;

export function profileToRow(userId: string, p: Profile): ProfileRow {
  return {
    user_id: userId, goal: p.goal, height_unit: p.heightUnit, weight_unit: p.weightUnit,
    height_cm: p.stats.heightCm ?? null, weight_kg: p.stats.weightKg ?? null, age: p.stats.age ?? null, sex: p.stats.sex ?? null,
    activity: p.stats.activity, skipped_stats: SKIP_KEYS.filter((k) => p.skipped[k]), meals: p.meals,
    allergies: p.allergies, no_allergies: p.noAllergies, dislikes: p.dislikes, liked_recipes: p.likedRecipes,
    skipped_recipes: p.skippedRecipes, onboarding_step: p.step, completed: p.completed, weeks: p.weeks, budget: p.budget, reminders: p.reminders, consent: p.consent,
  };
}

/** Merges over defaults so rows written by older builds still load. */
export function rowToProfile(r: Partial<ProfileRow>): Profile {
  const d = emptyProfile();
  const stats: Profile['stats'] = { activity: r.activity ?? d.stats.activity };
  if (r.height_cm != null) stats.heightCm = Number(r.height_cm);
  if (r.weight_kg != null) stats.weightKg = Number(r.weight_kg);
  if (r.age != null) stats.age = r.age;
  if (r.sex) stats.sex = r.sex;
  return {
    goal: r.goal ?? d.goal, heightUnit: r.height_unit ?? d.heightUnit, weightUnit: r.weight_unit ?? d.weightUnit, stats,
    skipped: Object.fromEntries((r.skipped_stats ?? []).map((k) => [k, true])) as Profile['skipped'],
    meals: { ...d.meals, ...(r.meals ?? {}) }, allergies: r.allergies ?? d.allergies, noAllergies: r.no_allergies ?? d.noAllergies,
    dislikes: r.dislikes ?? d.dislikes, likedRecipes: r.liked_recipes ?? d.likedRecipes, skippedRecipes: r.skipped_recipes ?? d.skippedRecipes,
    step: (r.onboarding_step as OnboardingStep) ?? d.step, completed: r.completed ?? d.completed,
    weeks: r.weeks ?? d.weeks, budget: r.budget ?? d.budget, reminders: { ...d.reminders, ...(r.reminders ?? {}) }, consent: r.consent ?? null,
  };
}
