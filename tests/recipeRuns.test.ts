import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type { Recipe } from '@/data';
import { buildShopping } from '@/lib/planner/shopping';
import type { Plan, PlannedMeal } from '@/lib/planner/types';
import { computePerPortion, costPerPortion } from '@/lib/content/macros';
import { verifyRecipe } from '@/lib/content/validate';
import type { IngredientDef, RecipeDef } from '@/lib/content/types';

// Runs every dinner (draft and live) through the same shopping-list code the app uses, at several household sizes and
// portion sizes, and checks the sums. Reads content/ directly, so drafts are covered before they are imported.
const root = path.resolve(__dirname, '..');
const ingredients = JSON.parse(fs.readFileSync(path.join(root, 'content/ingredients.json'), 'utf8')) as IngredientDef[];
const ing = new Map(ingredients.map((i) => [i.slug, i]));
const recipes = fs.readdirSync(path.join(root, 'content/recipes')).filter((f) => f.endsWith('.json')).flatMap((f) => {
  const v = JSON.parse(fs.readFileSync(path.join(root, 'content/recipes', f), 'utf8')) as RecipeDef | RecipeDef[];
  return Array.isArray(v) ? v : [v];
}).filter((r) => !r.macros_only);
// All dinners, plus lunches that are new (not live yet, or part of the sourced set with a recorded outline); older live lunches predate these checks.
const outlineKeys = new Set(Object.keys(JSON.parse(fs.readFileSync(path.join(root, 'tests/fixtures/method-outlines.json'), 'utf8')) as Record<string, unknown>));
const inScope = (r: RecipeDef) => r.course === 'dinner' || (r.course === 'lunch' && (r.status !== 'live' || outlineKeys.has(r.slug)));

const scoped = recipes.filter(inScope);
const products = Object.fromEntries(ingredients.filter((i) => i.product).map((i) => [i.slug, { n: i.product!.name, pr: i.product!.price_pence, pack: i.product!.pack_size, u: i.unit, s: i.product!.slug, c: i.category ?? 'Other' }]));
const toApp = (r: RecipeDef): Recipe => ({
  id: r.slug, c: r.course, e: r.emoji, n: r.name, p: 0, k: 0, serves: r.serves,
  fresh: r.ingredients.map((l) => [l.ingredient, l.qty] as [string, number]), cup: r.cupboard ?? [], m: r.method, allergens: [],
} as unknown as Recipe);

// [my portion size, extra servings for others]: just me, a pair, a family of four, a smaller and a bigger portion, and a mix.
const RUNS: [number, number][] = [[1, 0], [1, 1], [1, 3], [0.75, 0], [1.25, 0], [1.25, 2]];
const planFor = (id: string, scale: number, extra: number): Plan => {
  const meal: PlannedMeal = { slot: 'dinner', recipeId: id, scale, extra, kcal: 0, protein: 0 } as PlannedMeal;
  return { seed: 1, days: [{ day: 'Monday', meals: [meal], topups: [], kcal: 0, protein: 0, reserved: { kcal: 0, protein: 0 }, inBand: true, adjusted: false }], issues: [] };
};

describe(`every dinner and new lunch, ${RUNS.length} runs each (${scoped.length} recipes)`, () => {
  for (const r of scoped) {
    describe(r.slug, () => {
      const app = toApp(r);
      const map = new Map([[app.id, app]]);

      it('has a priced product for every fresh ingredient and a unit that converts', () => {
        for (const l of r.ingredients) {
          const d = ing.get(l.ingredient);
          expect(d, `${l.ingredient} exists`).toBeTruthy();
          expect(products[l.ingredient], `${l.ingredient} priced`).toBeTruthy();
          expect(l.qty, `${l.ingredient} qty`).toBeGreaterThan(0);
        }
        for (const k of r.cupboard ?? []) expect(ing.get(k)?.cupboard, `${k} is a cupboard item`).toBe(true);
      });

      for (const [scale, extra] of RUNS) {
        const portions = scale + extra;
        it(`run: portion x${scale}, +${extra} others (${portions} portions)`, () => {
          const s = buildShopping(planFor(r.slug, scale, extra), map, products as never, {});
          expect(s.lines.length).toBe(r.ingredients.length);
          let marginal = 0;
          for (const l of s.lines) {
            const line = r.ingredients.find((x) => x.ingredient === l.key)!;
            expect(l.needed).toBeCloseTo((line.qty * portions) / r.serves, 6);
            expect(l.bought).toBeGreaterThanOrEqual(l.needed - 1e-6);
            expect(l.packs).toBeGreaterThanOrEqual(1);
            expect(Number.isFinite(l.costPence)).toBe(true);
            marginal += (l.needed * products[l.key].pr) / products[l.key].pack;
          }
          expect(s.totalPence).toBeGreaterThan(0);
          expect(s.totalPence).toBeGreaterThanOrEqual(Math.round(marginal) - 1);
          expect(s.wastePence).toBeGreaterThanOrEqual(0);
        });
      }

      it('macros and cost are finite, positive and sensible per portion', () => {
        const c = computePerPortion(r, ing), cost = costPerPortion(r, ing);
        expect(c.kcal).toBeGreaterThan(150);
        expect(c.kcal).toBeLessThan(1000);
        expect(c.protein_g).toBeGreaterThan(8);
        expect(c.carbs_g).toBeGreaterThanOrEqual(0);
        expect(c.fat_g).toBeGreaterThanOrEqual(0);
        expect(cost).not.toBeNull();
        expect(cost!).toBeGreaterThan(50);
        expect(cost!).toBeLessThan(700);
        // 4 kcal/g protein+carbs, 9 kcal/g fat should land near the stated kcal (allows for fibre, rounding, CoFID differences).
        const est = 4 * c.protein_g + 4 * c.carbs_g + 9 * c.fat_g;
        expect(Math.abs(est - c.kcal) / c.kcal).toBeLessThan(0.2);
        expect(verifyRecipe(r, ing).coverage).toBeGreaterThan(0.8);
      });
    });
  }
});
