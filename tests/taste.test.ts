import { describe, expect, it } from 'vitest';
import { forgetRating, likeMeal, neverAgain } from '@/lib/taste';
import { emptyProfile } from '@/lib/profile';

const p = { ...emptyProfile(), likedRecipes: ['a', 'b'], skippedRecipes: ['c'] };

describe('taste signals', () => {
  it('never-again moves a meal from liked to skipped, once', () => {
    const n = neverAgain(p, 'a');
    expect(n.likedRecipes).toEqual(['b']); expect(n.skippedRecipes).toEqual(['c', 'a']);
    expect(neverAgain(n, 'a').skippedRecipes).toEqual(['c', 'a']);
  });
  it('liked-it adds to liked and clears a skip; forgetting leaves a meal unrated', () => {
    const l = likeMeal(p, 'c');
    expect(l.likedRecipes).toEqual(['a', 'b', 'c']); expect(l.skippedRecipes).toEqual([]);
    const f = forgetRating(l, 'a');
    expect(f.likedRecipes).toEqual(['b', 'c']); expect(f.skippedRecipes).toEqual([]);
  });
  it('does not touch the original', () => { neverAgain(p, 'a'); expect(p.likedRecipes).toEqual(['a', 'b']); });
});
