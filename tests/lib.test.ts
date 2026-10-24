import { describe, expect, it } from 'vitest';
import { PRODUCTS, RECIPES, CUPBOARD } from '@/data';
import { isSafeFor, recipeAllergens, safeRecipes } from '@/lib/allergens';
import { createMockBackend, MOCK_CODE } from '@/lib/db/mock';
import type { KV } from '@/lib/db/types';
import {
  advance, back, canContinue, MIN_LIKES, setAllergies, skipStat, swipe, tasteProgress,
} from '@/lib/onboarding';
import { emptyProfile, type Profile } from '@/lib/profile';
import { computeTargets, KCAL_FLOOR } from '@/lib/targets';
import { cmToFtIn, ftInToCm, kgToStLb, stLbToKg } from '@/lib/units';

const mem = (): KV => {
  const m = new Map<string, string>();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v), removeItem: (k) => void m.delete(k) };
};

describe('seed data', () => {
  it('has every referenced product and cupboard item', () => {
    for (const r of RECIPES) {
      r.fresh.forEach(([k]) => expect(PRODUCTS[k], `${r.id} → ${k}`).toBeDefined());
      r.cup.forEach((k) => expect(CUPBOARD[k], `${r.id} → ${k}`).toBeDefined());
      expect(new Set(r.fresh.map(([k]) => k)).size, `${r.id} duplicate product`).toBe(r.fresh.length);
    }
  });
});

describe('targets', () => {
  it('matches the PoC formula', () => {
    // BMR = 10*74 + 6.25*168 - 5*34 - 161 = 1459 ; *1.375 = 2006 ; -500 => 1506 -> 1510
    const t = computeTargets('lose', { sex: 'f', age: 34, heightCm: 168, weightKg: 74, activity: 1.375 });
    expect(t.maintenance).toBe(2006);
    expect(t.target).toBe(1510);
    expect(t.band).toEqual([1410, 1570]);
    expect(t.protein).toBe(133);
    expect(t.estimated).toBe(false);
  });
  it('falls back to defaults without stats and never goes below the floor', () => {
    const d = computeTargets('lose', { activity: 1.2 });
    expect(d.estimated).toBe(true);
    expect(d.target).toBe(1500);
    const tiny = computeTargets('lose', { sex: 'f', age: 90, heightCm: 100, weightKg: 30, activity: 1.2 });
    expect(tiny.target).toBe(KCAL_FLOOR);
  });
});

describe('units', () => {
  it('round-trips', () => {
    expect(ftInToCm(5, 10)).toBe(178);
    expect(cmToFtIn(178)).toEqual({ ft: 5, inch: 10 });
    expect(kgToStLb(stLbToKg(11, 7))).toEqual({ st: 11, lb: 7 });
  });
});

describe('allergens', () => {
  it('hard-excludes household allergens', () => {
    const prawn = RECIPES.find((r) => r.id === 'LR')!;
    expect(recipeAllergens(prawn)).toContain('crustaceans');
    expect(isSafeFor(prawn, ['crustaceans'])).toBe(false);
    expect(safeRecipes(['milk']).every((r) => !recipeAllergens(r).includes('milk'))).toBe(true);
  });
});

describe('onboarding', () => {
  const stats = { sex: 'f' as const, age: 34, heightCm: 168, weightKg: 74, activity: 1.375 };

  it('gates each step', () => {
    let p = emptyProfile();
    expect(canContinue(p, 'goal')).toBe(false);
    p = { ...p, goal: 'lose' };
    expect(canContinue(p, 'goal')).toBe(true);
    expect(canContinue(p, 'height')).toBe(false);
    expect(canContinue({ ...p, stats }, 'height')).toBe(true);
    expect(canContinue({ ...p, stats: { ...stats, age: 12 } }, 'age')).toBe(false);
    expect(canContinue(p, 'allergies')).toBe(false);
    expect(canContinue({ ...p, noAllergies: true }, 'allergies')).toBe(true);
  });

  it('skipping a stat clears it, remembers the skip and moves on', () => {
    let p: Profile = { ...emptyProfile(), goal: 'lose', stats, step: 'weight' };
    p = advance(skipStat(p, 'weight'));
    expect(p.stats.weightKg).toBeUndefined();
    expect(p.skipped.weight).toBe(true);
    expect(p.step).toBe('age');
    expect(back(p).step).toBe('weight');
  });

  it('allergy changes drop likes that are no longer safe', () => {
    let p = swipe(emptyProfile(), 'LR', true);
    expect(p.likedRecipes).toEqual(['LR']);
    p = setAllergies(p, ['crustaceans']);
    expect(p.likedRecipes).toEqual([]);
  });

  it('requires >= MIN_LIKES per planned meal type, ignoring macros-only meals', () => {
    let p: Profile = { ...emptyProfile(), step: 'taste' };
    p.meals = { ...p.meals, breakfast: { mode: 'macros', extraServings: 0 } };
    expect(canContinue(p, 'taste')).toBe(false);
    for (const c of ['lunch', 'dinner']) {
      RECIPES.filter((r) => r.c === c).slice(0, MIN_LIKES).forEach((r) => (p = swipe(p, r.id, true)));
    }
    expect(tasteProgress(p).breakfast.needed).toBe(0);
    expect(canContinue(p, 'taste')).toBe(true);
  });

  it('caps the requirement at what is available after allergy filtering', () => {
    const p = setAllergies(emptyProfile(), ['gluten', 'milk', 'eggs']);
    const prog = tasteProgress(p);
    for (const m of ['breakfast', 'lunch', 'dinner'] as const) expect(prog[m].needed).toBeLessThanOrEqual(prog[m].available);
  });

  it('finishing the last step completes onboarding', () => {
    expect(advance({ ...emptyProfile(), step: 'taste' }).completed).toBe(true);
  });
});

describe('mock backend', () => {
  it('signs in with the right code only and persists across instances', async () => {
    const kv = mem();
    const b = createMockBackend(kv);
    await expect(b.auth.sendCode('nope')).rejects.toThrow();
    await b.auth.sendCode('Jo@Example.com');
    await expect(b.auth.verifyCode('jo@example.com', '000000')).rejects.toThrow();
    const s = await b.auth.verifyCode('jo@example.com', MOCK_CODE);
    expect((await createMockBackend(kv).auth.getSession())?.userId).toBe(s.userId);

    const p = { ...emptyProfile(), goal: 'gain' as const, step: 'sex' as const };
    await b.profiles.save(s.userId, p);
    expect(await createMockBackend(kv).profiles.load(s.userId)).toEqual(p);

    await b.profiles.erase(s.userId);
    expect(await b.profiles.load(s.userId)).toBeNull();
    await b.auth.signOut();
    expect(await b.auth.getSession()).toBeNull();
  });
});
