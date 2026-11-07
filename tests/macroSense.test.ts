import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type { IngredientDef, RecipeDef } from '@/lib/content/types';
import { computePerPortion, gramsOf, recipeLines } from '@/lib/content/macros';
import { verifyRecipe } from '@/lib/content/validate';

// Checks that nutrition is logical from the ingredients up: each ingredient's own numbers add up, every ingredient a new
// recipe uses has verified data (so a recipe is never quietly missing calories), and each recipe's totals look like real food.
const root = path.resolve(__dirname, '..');
const ingredients = JSON.parse(fs.readFileSync(path.join(root, 'content/ingredients.json'), 'utf8')) as IngredientDef[];
const ing = new Map(ingredients.map((i) => [i.slug, i]));
const recipes = fs.readdirSync(path.join(root, 'content/recipes')).filter((f) => f.endsWith('.json')).flatMap((f) => {
  const v = JSON.parse(fs.readFileSync(path.join(root, 'content/recipes', f), 'utf8')) as RecipeDef | RecipeDef[];
  return Array.isArray(v) ? v : [v];
}).filter((r) => !r.macros_only);
const outlineKeys = new Set(Object.keys(JSON.parse(fs.readFileSync(path.join(root, 'tests/fixtures/method-outlines.json'), 'utf8')) as Record<string, unknown>));
const isNew = (r: RecipeDef) => r.status !== 'live' || outlineKeys.has(r.slug);
const src = JSON.parse(fs.readFileSync(path.join(root, 'tests/fixtures/source-nutrition.json'), 'utf8')) as Record<string, { kcal: number; source: string; tolerance: number; note?: string }>;

// Known gaps in live meals that use branded items we have no data for yet (tracked in design/todo.md). New recipes may not use them.
const KNOWN_NO_DATA = new Set(['grenade', 'granola', 'seafood', 'isolate']);

describe('ingredient nutrition is internally consistent', () => {
  for (const i of ingredients.filter((x) => x.per100)) {
    it(i.slug, () => {
      const p = i.per100!;
      expect(p.kcal).toBeGreaterThanOrEqual(0);
      expect(p.kcal, 'under 900 kcal per 100 g (pure fat)').toBeLessThanOrEqual(900);
      expect(p.protein_g + p.carbs_g + p.fat_g, 'macros cannot weigh more than 100 g').toBeLessThanOrEqual(101);
      const est = 4 * p.protein_g + 4 * p.carbs_g + 9 * p.fat_g;
      expect(Math.abs(est - p.kcal) <= Math.max(20, 0.25 * p.kcal), `kcal ${p.kcal} vs ${Math.round(est)} from P/C/F`).toBe(true);
    });
  }
  it('dry staples are held as dry weight (recipes quantities are as-bought)', () => {
    for (const k of ['rice', 'spaghetti', 'fusilli', 'noodles', 'lasagne', 'oats', 'flour']) {
      const p = ing.get(k)?.per100;
      if (p) expect(p.kcal, `${k} per 100 g dry`).toBeGreaterThan(300);
    }
  });
});

describe('every recipe is costed from verified ingredients', () => {
  const needed = (r: RecipeDef) => recipeLines(r, ing).map((l) => l.slug);
  for (const r of recipes.filter(isNew)) {
    it(`${r.slug}: every ingredient has verified data`, () => {
      const bad = needed(r).filter((k) => { const d = ing.get(k); return d && !d.negligible && !(d.per100 && d.cofid?.verified); });
      expect(bad, `no verified nutrition for: ${bad.join(', ')}`).toEqual([]);
      expect(verifyRecipe(r, ing).coverage).toBe(1);
    });
  }
  it('live meals only miss data for the known branded items', () => {
    for (const r of recipes.filter((x) => !isNew(x))) {
      const bad = needed(r).filter((k) => { const d = ing.get(k); return d && !d.negligible && !(d.per100 && d.cofid?.verified); });
      expect(bad.filter((k) => !KNOWN_NO_DATA.has(k)), `${r.slug} is missing data for`).toEqual([]);
    }
  });
});

describe('recipe totals look like real food', () => {
  for (const r of recipes.filter((x) => (x.course === 'dinner' || x.course === 'lunch' || x.course === 'breakfast') && isNew(x))) {
    it(r.slug, () => {
      const c = computePerPortion(r, ing);
      expect(c.missing).toEqual([]);
      // Plate weight: ingredients as bought (raw, dry), so a dinner is 200 to 700 g per person.
      const grams = recipeLines(r, ing).reduce((a, l) => a + (gramsOf(ing.get(l.slug)!, l.qty) ?? 0), 0) / r.serves;
      expect(grams, `${Math.round(grams)} g per portion`).toBeGreaterThan(r.course === 'dinner' ? 200 : 120);
      expect(grams).toBeLessThan(750);
      const density = c.kcal / grams;
      expect(density, `${density.toFixed(2)} kcal per g`).toBeGreaterThan(0.6);
      expect(density).toBeLessThan(2.6);
      expect(c.fat_g * 9 / c.kcal, 'fat is under 50% of the calories').toBeLessThan(0.5);
      expect(c.protein_g * 4 / c.kcal, 'protein is at least 10% of the calories').toBeGreaterThan(0.1);
      expect(c.protein_g * 4 / c.kcal, 'protein is under 60% of the calories').toBeLessThan(0.6);
    });
  }
});

describe('computed calories match the original recipe where it states them', () => {
  for (const [slug, o] of Object.entries(src)) {
    if (slug === '_about') continue;
    it(`${slug} (${o.source})`, () => {
      const r = recipes.find((x) => x.slug === slug)!;
      expect(r).toBeTruthy();
      const ours = computePerPortion(r, ing).kcal;
      expect(Math.abs(ours - o.kcal) / o.kcal, `ours ${ours} kcal vs original ${o.kcal}${o.note ? ' (' + o.note + ')' : ''}`).toBeLessThanOrEqual(o.tolerance);
    });
  }
});
