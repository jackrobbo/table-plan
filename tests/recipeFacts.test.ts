import { describe, expect, it } from 'vitest';
import { RECIPES, type Recipe } from '@/data';
import { allergenNames, cupboardLines } from '@/lib/recipeFacts';

const base = (over: Partial<Recipe>): Recipe => ({ id: 'x', c: 'dinner', e: '🍽️', n: 'X', p: 1, k: 1, serves: 1, fresh: [], cup: [], m: [], allergens: [], ...over });

describe('recipe sheet facts', () => {
  it('names allergens in plain words', () => {
    expect(allergenNames(base({ allergens: ['milk', 'nuts'] }))).toEqual(['Milk', 'Tree nuts']);
    expect(allergenNames(base({}))).toEqual([]);
  });
  it('shows cupboard items with the amount used, and without one when the recipe has none', () => {
    expect(cupboardLines(base({ cup: ['rice', 'oil'], cq: { rice: 150 } }))).toEqual(['Easy Cook Long Grain Rice 150 g', 'Vegetable Oil']);
  });
  it('never shows a pack size or a raw slug for any live recipe', () => {
    for (const r of RECIPES) for (const line of cupboardLines(r)) {
      expect(line, r.id).not.toMatch(/\b\d+\s?(kg|ml|cl)\b/);
      expect(line, r.id).not.toMatch(/^[a-z]+$/); // an unknown slug would fall through as lowercase
    }
  });
  it('every recipe with cupboard items has an amount for each', () => {
    for (const r of RECIPES.filter((x) => x.cup.length)) for (const k of r.cup) expect(r.cq?.[k], `${r.id}/${k}`).toBeGreaterThan(0);
  });
});
