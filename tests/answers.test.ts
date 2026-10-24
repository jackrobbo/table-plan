import { describe, expect, it } from 'vitest';
import { answerProblems, answersChanged, answersOf, applyAnswers, coursesNeedingLikes } from '@/lib/answers';
import { firstWeek } from '@/lib/cycle/week';
import { safeRecipes } from '@/lib/allergens';
import { skipStat } from '@/lib/onboarding';
import { planWeek } from '@/lib/planner/solve';
import { planInputFrom } from '@/lib/planner/fromProfile';
import { emptyProfile, type Profile } from '@/lib/profile';

const liked = safeRecipes([]).map((r) => r.id);
const done = (over: Partial<Profile> = {}): Profile => ({
  ...emptyProfile(), goal: 'lose', stats: { sex: 'f', age: 34, heightCm: 168, weightKg: 74, activity: 1.375 }, noAllergies: true, likedRecipes: liked, completed: true, step: 'taste', ...over,
});

describe('changing answers in Settings', () => {
  it('saves answers without touching planned weeks, reminders or onboarding position', () => {
    const p = done();
    const week = firstWeek(planWeek(planInputFrom(p), 4, 3), new Date('2026-10-24T10:00:00Z'));
    const stored: Profile = { ...p, weeks: { [week.start]: { ...week, ticks: { '0:0': true }, haveAlready: ['milk'] } }, reminders: { on: true, shown: ['x:y'] } };
    const edited: Profile = { ...stored, goal: 'gain', budget: 'low', dislikes: ['mushrooms'], weeks: {}, reminders: { on: false, shown: [] }, completed: false, step: 'goal' };
    const saved = applyAnswers(stored, edited);
    expect(saved.goal).toBe('gain');
    expect(saved.budget).toBe('low');
    expect(saved.dislikes).toEqual(['mushrooms']);
    expect(saved.weeks).toBe(stored.weeks);
    expect(saved.reminders).toBe(stored.reminders);
    expect(saved.completed).toBe(true);
    expect(saved.step).toBe('taste');
  });

  it('knows when nothing has changed', () => {
    const p = done();
    expect(answersChanged(p, { ...p, weeks: { x: {} as never } })).toBe(false);
    expect(answersChanged(p, { ...p, budget: 'low' })).toBe(true);
    expect(Object.keys(answersOf(p))).not.toContain('weeks');
  });

  it('holds back answers that would break the plan, and says why', () => {
    expect(answerProblems(done())).toEqual([]);
    expect(answerProblems(done({ stats: { activity: 1.375 } }))).toHaveLength(4);   // stats cleared but not "removed on purpose"
    const removed = ['height', 'weight', 'age', 'sex'].reduce((acc, s) => skipStat(acc, s as 'height'), done());
    expect(answerProblems(removed)).toEqual([]);
    expect(answerProblems(done({ stats: { ...done().stats, age: 15 } }))[0]).toMatch(/age/);
    expect(answerProblems(done({ meals: { breakfast: { mode: 'macros', extraServings: 0 }, lunch: { mode: 'macros', extraServings: 0 }, dinner: { mode: 'macros', extraServings: 0 } } }))).toContain('Plan at least one meal.');
    expect(answerProblems(done({ noAllergies: false, allergies: [] }))[0]).toMatch(/allergies/);
  });

  it('asks for more liked meals when a newly planned course has none', () => {
    const p = done({ meals: { ...done().meals, lunch: { mode: 'macros', extraServings: 0 } }, likedRecipes: liked.filter((id) => !id.includes('x-never')) });
    expect(coursesNeedingLikes(p)).toEqual([]);
    const fewer = done({ likedRecipes: [] });
    expect(coursesNeedingLikes(fewer)).toEqual(['breakfast', 'lunch', 'dinner']);
  });
});
