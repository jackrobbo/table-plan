import { describe, expect, it } from 'vitest';
import { timeLabel } from '../src/lib/cookTime';
import { RECIPES } from '../src/data';

describe('cooking time', () => {
  it('formats minutes as an estimate', () => {
    expect(timeLabel(25)).toBe('≈ 25 min');
    expect(timeLabel(60)).toBe('≈ 1 hr');
    expect(timeLabel(65)).toBe('≈ 1 hr 5 min');
  });
  it('shows nothing for ready-to-eat or unknown', () => {
    expect(timeLabel(0)).toBeNull();
    expect(timeLabel(undefined)).toBeNull();
  });
  it('every live recipe carries a sane time', () => {
    for (const r of RECIPES) {
      if (r.macros_only) continue;
      expect(r.t, r.id).toBeDefined();
      expect(r.t!, r.id).toBeGreaterThanOrEqual(0);
      expect(r.t!, r.id).toBeLessThanOrEqual(240);
      if (r.c !== 'snack') expect(r.t!, r.id).toBeGreaterThan(0);
    }
  });
});

import { validateContent } from '@/lib/content/validate';
import type { RecipeDef } from '@/lib/content/types';

describe('time validation', () => {
  const ing = [{ slug: 'egg', name: 'Egg', unit: 'each', cupboard: false, allergens: ['egg'], per100: { kcal: 140, protein_g: 12, carbs_g: 0, fat_g: 10 }, gramsPerUnit: 60, cofid: { verified: true }, product: { retailer: 'morrisons', name: 'Eggs', price_pence: 200, pack_size: 6, slug: 'eggs' } }] as never;
  const rec = (over: Partial<RecipeDef>): RecipeDef => ({ slug: 'omelette', name: 'Omelette', course: 'breakfast', serves: 1, status: 'live', ingredients: [{ ingredient: 'egg', qty: 2 }], cupboard: [], method: ['Cook.'], ...over });
  const errors = (r: RecipeDef) => validateContent(ing, [r]).filter((i) => i.level === 'error' && /time/i.test(i.message));
  it('requires a time on live recipes', () => { expect(errors(rec({}))).toHaveLength(1); });
  it('accepts whole minutes', () => { expect(errors(rec({ time: { prep: 3, cook: 5 } }))).toHaveLength(0); });
  it('rejects fractions and negatives', () => {
    expect(errors(rec({ time: { prep: 2.5, cook: 5 } }))).toHaveLength(1);
    expect(errors(rec({ time: { prep: -1, cook: 5 } }))).toHaveLength(1);
  });
  it('lets only snacks take no time', () => {
    expect(errors(rec({ time: { prep: 0, cook: 0 } }))).toHaveLength(1);
    expect(errors(rec({ course: 'snack', time: { prep: 0, cook: 0 } }))).toHaveLength(0);
  });
});
