import { describe, expect, it } from 'vitest';
import { PRODUCTS, RECIPES, CUPBOARD } from '@/data';
import { ALLERGENS, isSafeFor, recipeAllergens, safeRecipes } from '@/lib/allergens';
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
    expect(t.protein).toBe(132); // 1.8 g/kg = 133, capped at 35% of 1,510 kcal
    expect(t.estimated).toBe(false);
    expect(t.fat * 9 + t.carbs * 4 + t.protein * 4).toBeGreaterThan(t.target - 60);
    expect(t.fat * 9 + t.carbs * 4 + t.protein * 4).toBeLessThan(t.target + 60);
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
    const prawn = RECIPES.find((r) => r.id === 'prawn-salad')!;
    expect(recipeAllergens(prawn)).toContain('crustaceans');
    expect(isSafeFor(prawn, ['crustaceans'])).toBe(false);
    expect(safeRecipes(['milk']).every((r) => !recipeAllergens(r).includes('milk'))).toBe(true);
  });

  it('keeps a usable bank for a household avoiding any one of the 14 allergens', () => {
    for (const [a] of ALLERGENS) {
      const safe = safeRecipes([a]);
      const n = (c: string) => safe.filter((r) => r.c === c).length;
      for (const c of ['breakfast', 'lunch', 'dinner']) expect(n(c), `${a}: ${c}`).toBeGreaterThanOrEqual(5);
      expect(n('snack'), `${a}: snack`).toBeGreaterThanOrEqual(3); // the planner needs a snack every day
    }
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
    let p = swipe(emptyProfile(), 'prawn-salad', true);
    expect(p.likedRecipes).toEqual(['prawn-salad']);
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

import fs from 'node:fs';
import type { IngredientDef, RecipeDef } from '@/lib/content/types';
import { validateContent } from '@/lib/content/validate';

describe('content validation', () => {
  const ingredients = JSON.parse(fs.readFileSync('content/ingredients.json', 'utf8')) as IngredientDef[];
  const recipe = (over: Partial<RecipeDef> = {}): RecipeDef => ({
    slug: 'test-bowl', name: 'Test Bowl', course: 'lunch', serves: 1, status: 'draft',
    per_portion: { kcal: 400, protein_g: 30 }, ingredients: [{ ingredient: 'eggs', qty: 2 }], cupboard: [], method: ['Cook.'],
    ...over,
  });
  const errs = (r: RecipeDef[]) => validateContent(ingredients, r).filter((i) => i.level === 'error').map((i) => i.message);

  it('accepts the shipped content', () => {
    const dir = 'content/recipes';
    const all = fs.readdirSync(dir).map((f) => JSON.parse(fs.readFileSync(`${dir}/${f}`, 'utf8')) as RecipeDef);
    expect(errs(all)).toEqual([]);
  });
  it('flags bad recipes', () => {
    expect(errs([recipe({ ingredients: [{ ingredient: 'nope', qty: 1 }] })])).toContain('unknown ingredient "nope"');
    expect(errs([recipe({ cupboard: ['eggs'] })])).toContain('"eggs" is not flagged as a cupboard item');
    expect(errs([recipe({ per_portion: { kcal: 100, protein_g: 40 } })])).toContain('protein calories exceed total kcal');
    expect(errs([recipe(), recipe({ slug: 'other' })])).toContain('duplicate name "Test Bowl"');
    expect(errs([recipe({ ingredients: [{ ingredient: 'eggs', qty: 0 }] })])).toContain('quantity for "eggs" must be > 0');
  });
  it('blocks live recipes with unpriced ingredients', () => {
    const unpriced: IngredientDef[] = [...ingredients, { slug: 'mystery', name: 'Mystery', unit: 'g', cupboard: false, allergens: [], per100: null, product: null }];
    const e = validateContent(unpriced, [recipe({ status: 'live', ingredients: [{ ingredient: 'mystery', qty: 5 }] })]);
    expect(e.some((i) => i.level === 'error' && i.message.includes('no product'))).toBe(true);
  });
});

import { verifyRecipe } from '@/lib/content/validate';

describe('CoFID verification', () => {
  const mk = (kcal: number): [IngredientDef[], RecipeDef] => [
    [{ slug: 'oats', name: 'Oats', unit: 'g', cupboard: false, allergens: ['gluten'], cofid: { verified: true },
      per100: { kcal: 370, protein_g: 11, carbs_g: 60, fat_g: 8 },
      product: { retailer: 'morrisons', name: 'Oats', price_pence: 100, pack_size: 1000, slug: 'oats' } }],
    { slug: 'porridge', name: 'Porridge', course: 'breakfast', serves: 1, status: 'verified',
      per_portion: { kcal, protein_g: 7 }, ingredients: [{ ingredient: 'oats', qty: 60 }], cupboard: [], method: ['Cook.'] },
  ];
  it('passes when computed macros match, fails when they do not', () => {
    const [i, r] = mk(222);
    expect(verifyRecipe(r, new Map(i.map((x) => [x.slug, x]))).verified).toBe(true);
    const [i2, r2] = mk(400);
    expect(verifyRecipe(r2, new Map(i2.map((x) => [x.slug, x]))).verified).toBe(false);
    expect(validateContent(i2, [r2]).some((x) => x.level === 'error' && x.message.includes('CoFID'))).toBe(true);
  });
  it('warns on declared-vs-computed gaps for new recipes but not for grandfathered PoC ones', () => {
    const [i, r] = mk(400); // 60 g oats compute to 222 kcal, declared 400
    const gap = (x: RecipeDef) => validateContent(i, [x]).some((w) => w.level === 'warning' && w.message.includes('ingredients compute to'));
    expect(gap({ ...r, status: 'draft' })).toBe(true);
    expect(gap({ ...r, status: 'live', source: 'poc' })).toBe(false);
  });
  it('rejects verified status without CoFID data, but allows macros-only entries', () => {
    const [i, r] = mk(222);
    i[0].cofid = { verified: false };
    expect(validateContent(i, [r]).some((x) => x.level === 'error')).toBe(true);
    const eatOut: RecipeDef = { ...r, slug: 'pub-roast', name: 'Pub Roast', ingredients: [], method: [], macros_only: true, status: 'live' };
    expect(validateContent(i, [eatOut]).filter((x) => x.level === 'error')).toEqual([]);
  });
  it('counts count-based units (eggs, slices) via unit_g, and refuses them without it', () => {
    const egg = (unit_g?: number): IngredientDef => ({
      slug: 'eggs', name: 'Eggs', unit: 'eggs', ...(unit_g ? { unit_g } : {}), cupboard: false, allergens: ['eggs'], cofid: { verified: true },
      per100: { kcal: 131, protein_g: 12.6, carbs_g: 0, fat_g: 9 },
      product: { retailer: 'morrisons', name: 'Eggs', price_pence: 180, pack_size: 6, slug: 'eggs/1' },
    });
    const r: RecipeDef = { slug: 'eggs-on-toast', name: 'Eggs', course: 'breakfast', serves: 1, status: 'verified',
      per_portion: { kcal: 197, protein_g: 19 }, ingredients: [{ ingredient: 'eggs', qty: 3 }], cupboard: [], method: ['Cook.'] };
    const withWeight = verifyRecipe(r, new Map([['eggs', egg(50)]]));
    expect(withWeight.verified).toBe(true);
    expect(withWeight.computedKcal).toBe(197); // 3 x 50 g x 131 kcal/100 g
    expect(verifyRecipe(r, new Map([['eggs', egg()]])).verified).toBe(false);
    expect(validateContent([egg(-1)], []).some((x) => x.level === 'error' && x.message.includes('unit_g'))).toBe(true);
  });
  it('counts cupboard grams (oil, honey) in verification, and needs their CoFID data', () => {
    const oil = (verified: boolean): IngredientDef => ({ slug: 'oil', name: 'Oil', unit: 'g', cupboard: true, allergens: [], cofid: { verified },
      per100: { kcal: 899, protein_g: 0, carbs_g: 0, fat_g: 99.9 }, product: null });
    const [i, r] = mk(222);
    const withOil: RecipeDef = { ...r, cupboard: ['oil'], cupboard_g: { oil: 10 }, per_portion: { kcal: 312, protein_g: 7 } }; // 60 g oats + 10 g oil
    const ok = verifyRecipe(withOil, new Map([...i, oil(true)].map((x) => [x.slug, x])));
    expect(ok.verified).toBe(true);
    expect(ok.computedKcal).toBe(312);
    expect(verifyRecipe({ ...withOil, per_portion: { kcal: 222, protein_g: 7 } }, new Map([...i, oil(true)].map((x) => [x.slug, x]))).verified).toBe(false);
    expect(verifyRecipe(withOil, new Map([...i, oil(false)].map((x) => [x.slug, x]))).reason).toMatch(/missing verified CoFID data for oil/);
    const bad = validateContent([...i, oil(true)], [{ ...withOil, cupboard_g: { butter: 5, oil: 0 } }]).filter((x) => x.level === 'error').map((x) => x.message);
    expect(bad).toContain('cupboard_g "butter" is not listed under cupboard');
    expect(bad).toContain('cupboard_g for "oil" must be > 0');
  });
});
