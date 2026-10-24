import { describe, expect, it } from 'vitest';
import { profileToRow, rowToProfile } from '@/lib/db/profileRow';
import { emptyProfile } from '@/lib/profile';

describe('profile <-> row mapping', () => {
  it('round-trips a full profile', () => {
    const p = {
      ...emptyProfile(), goal: 'lose' as const, heightUnit: 'ftin' as const, weightUnit: 'stlb' as const,
      stats: { sex: 'f' as const, age: 34, heightCm: 168, weightKg: 74.5, activity: 1.55 },
      skipped: { weight: true as const }, allergies: ['milk' as const], dislikes: ['Liver'], likedRecipes: ['beef-tacos'], skippedRecipes: ['lasagne'],
      step: 'taste' as const, completed: true,
      weeks: { '2026-10-26': { start: '2026-10-26', status: 'planned' as const, plan: null, picks: [], haveAlready: ['eggs'], ticks: { '0:1': true } } },
      budget: 'low' as const, reminders: { on: true, shown: ['2026-11-02:opens'] },
    };
    expect(rowToProfile(profileToRow('u1', p))).toEqual(p);
  });
  it('stores skipped stats as nulls and a key list, and reads them back', () => {
    const p = { ...emptyProfile(), skipped: { height: true as const, age: true as const } };
    const row = profileToRow('u1', p);
    expect(row).toMatchObject({ height_cm: null, age: null, skipped_stats: ['height', 'age'], user_id: 'u1' });
    expect(rowToProfile(row).skipped).toEqual({ height: true, age: true });
  });
  it('reads numeric columns returned as strings and fills defaults for missing fields', () => {
    const p = rowToProfile({ height_cm: '168.5' as unknown as number, completed: true });
    expect(p.stats.heightCm).toBe(168.5);
    expect(p.meals.dinner.extraServings).toBe(1);
    expect(p.weeks).toEqual({});
    expect(p.budget).toBe('medium');   // rows written before budgets existed
  });
});
