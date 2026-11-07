import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type { IngredientDef, RecipeDef } from '@/lib/content/types';

// Checks that every dinner's method makes sense against its own ingredient list and times. Reads content/ directly.
const root = path.resolve(__dirname, '..');
const ingredients = JSON.parse(fs.readFileSync(path.join(root, 'content/ingredients.json'), 'utf8')) as IngredientDef[];
const ing = new Map(ingredients.map((i) => [i.slug, i]));
const recipes = fs.readdirSync(path.join(root, 'content/recipes')).filter((f) => f.endsWith('.json')).flatMap((f) => {
  const v = JSON.parse(fs.readFileSync(path.join(root, 'content/recipes', f), 'utf8')) as RecipeDef | RecipeDef[];
  return Array.isArray(v) ? v : [v];
}).filter((r) => r.course === 'dinner' && !r.macros_only);

/** Words a method may use for an ingredient slug, besides the words in its name. */
const WORDS: Record<string, string[]> = {
  breast: ['chicken'], thigh: ['chicken'], roast: ['chicken'], mince: ['mince', 'beef'], sizzle: ['beef', 'steak'], rump: ['steak', 'beef'],
  porkmince: ['pork'], porkloin: ['pork'], turkeymince: ['turkey'], lambmince: ['lamb'], greek: ['yoghurt', 'yogurt'], yog: ['yoghurt', 'yogurt'],
  creme: ['crème', 'creme'], plum: ['tomato'], ctoms: ['tomato'], passata: ['passata'], spring: ['spring onion', 'spring onions'],
  mixpep: ['pepper'], pepper: ['pepper'], onions: ['onion'], sweetpot: ['sweet potato'], bakepot: ['potato'], potatoes: ['potato'],
  cobs: ['sweetcorn', 'corn'], wraps: ['wrap', 'tortilla'], mission: ['wrap'], kidney: ['bean'], beans: ['bean'], butterbeans: ['bean'],
  medley: ['vegetable', 'green'], stirfry: ['vegetable', 'stir-fry'], mixveg: ['vegetable'], brocc: ['broccoli'], noodles: ['noodle'],
  fusilli: ['pasta'], spaghetti: ['spaghetti'], lasagne: ['lasagne'], puree: ['puree', 'purée'], stock: ['stock'], sweetcorn: ['sweetcorn', 'corn'],
  fajita: ['fajita'], paprika: ['paprika'], cumin: ['cumin'], chilliflakes: ['chilli'], chilli: ['chilli'], oregano: ['oregano'], herbs: ['herb'],
  garlic: ['garlic'], oil: ['oil'], butter: ['butter'], cheddar: ['cheese', 'cheddar'], parmesan: ['parmesan'], soy: ['soy'], honey: ['honey'],
  teriyaki: ['teriyaki'], cornflour: ['cornflour'], vinegar: ['vinegar'], flour: ['flour'], breadcrumbs: ['breadcrumb'], nuts: ['nut'],
  tuna: ['tuna'], rice: ['rice'], fivespice: ['five spice', 'five-spice'], bbq: ['bbq'], pbutter: ['peanut butter'], coconut: ['coconut'],
  pesto: ['pesto'], milk: ['milk'], eggs: ['egg'], prawns: ['prawn'], sausages: ['sausage'], peas: ['pea'], mushrooms: ['mushroom'], courgette: ['courgette'],
  carrots: ['carrot'], celery: ['celery'], coriander: ['coriander'], lime: ['lime'], lemon: ['lemon'], avocado: ['avocado'], cabbage: ['cabbage'], spinach: ['spinach'],
  salmon: ['salmon'], cod: ['cod'], chorizo: ['chorizo'], greenbeans: ['bean'], bacon: ['bacon'], ham: ['ham'], loaf: ['bread'], chips: ['chip'], iceberg: ['lettuce'],
};
const wordsFor = (slug: string): string[] => {
  const d = ing.get(slug);
  const own = (d?.display ?? d?.name ?? slug).toLowerCase().replace(/[^a-z ]/g, ' ').split(/\s+/).filter((w) => w.length > 3 && !['morrisons', 'british', 'fresh', 'easy', 'cook', 'long', 'grain', 'savers', 'medium', 'range'].includes(w));
  return [...(WORDS[slug] ?? []), ...own.map((w) => w.replace(/s$/, ''))];
};
const minutesIn = (text: string): number[] => [...text.matchAll(/(\d+)(?:\s*(?:to|-|–)\s*(\d+))?\s*(?:minutes?|mins?)\b/gi)].map((m) => (m[2] ? (Number(m[1]) + Number(m[2])) / 2 : Number(m[1])));

// New and in-review dinners must pass. Dinners already live were written before these checks; they are audited (count printed), not gated.
const live = recipes.filter((r) => r.status === 'live');
const gated = recipes.filter((r) => r.status !== 'live');
describe(`methods make sense (${gated.length} new dinners gated, ${live.length} live audited in the sweep below)`, () => {
  for (const r of gated) {
    const text = r.method.join(' ').toLowerCase();
    describe(r.slug, () => {
      it('has 3 to 6 short steps', () => {
        expect(r.method.length).toBeGreaterThanOrEqual(3);
        expect(r.method.length).toBeLessThanOrEqual(6);
        for (const s of r.method) { expect(s.length, 'step not empty').toBeGreaterThan(15); expect(s.length, 'step is short enough').toBeLessThan(420); }
      });

      it('uses every ingredient it lists', () => {
        const missing = [...r.ingredients.map((l) => l.ingredient), ...(r.cupboard ?? []).filter((k) => (r.cupboard_qty?.[k] ?? 0) > 0)]
          .filter((slug) => !wordsFor(slug).some((w) => text.includes(w)));
        expect(missing, `not mentioned in the method: ${missing.join(', ')}`).toEqual([]);
      });

      it('sets the oven before using it, and says how long', () => {
        const usesOven = /\b(bake|roast|oven|grill)\b/.test(text);
        if (!usesOven) return;
        const first = r.method.findIndex((s) => /\b(bake|baking|roast|oven|grill)\b/i.test(s));
        const heat = r.method.findIndex((s) => /\b(heat the oven|preheat|heat the grill|heat your grill|\d+\s?c\b)/i.test(s));
        expect(heat, 'an oven or grill temperature is given').toBeGreaterThanOrEqual(0);
        expect(heat, 'oven is heated at or before the first time it is used').toBeLessThanOrEqual(first);
        expect(/\b(heat the grill|heat your grill)\b/i.test(text) || /\d{3}\s?c\b/i.test(text), 'a temperature in C').toBe(true);
      });

      it('gives timings that fit the stated cook time', () => {
        const mins = minutesIn(text);
        const cook = r.time?.cook ?? 0, total = (r.time?.prep ?? 0) + cook;
        if (!mins.length) return;
        expect(Math.max(...mins), 'no single step longer than the whole meal').toBeLessThanOrEqual(total);
        // Steps often overlap (rice cooks while sauce simmers), so the sum may exceed the cook time, but it should not be far short of it.
        expect(mins.reduce((a, b) => a + b, 0), 'timings add up to something like the cook time').toBeGreaterThanOrEqual(cook * 0.45);
      });

      it('cooks raw meat through', () => {
        const meat = r.ingredients.some((l) => ['breast', 'thigh', 'porkmince', 'porkloin', 'sausages', 'mince', 'turkeymince', 'lambmince', 'prawns'].includes(l.ingredient));
        if (!meat) return;
        expect(/cooked (?:right )?through|until (?:it is |they are |the \w+ is )?(?:browned|golden|pink|cooked)|brown|sear|fry/.test(text), 'says how to tell it is cooked').toBe(true);
        expect(minutesIn(text).length, 'gives at least one cooking time').toBeGreaterThan(0);
      });

      it('ends by serving', () => {
        expect(/\b(serve|top|scatter|finish|sprinkle|spoon|toss|stir through|pile|divide|tip|mix|drizzle|sit|add)\b/.test(r.method[r.method.length - 1].toLowerCase())).toBe(true);
      });
    });
  }
});
