import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type { RecipeDef } from '@/lib/content/types';

// Our methods are in our own words, but they must keep the original's cooking: the same steps in the same order, the same
// oven temperatures (within 20C, since fan and conventional differ) and the same key timings (within a third), unless a step
// records a deliberate deviation. The outlines in tests/fixtures/method-outlines.json hold facts only, not the original wording.
const root = path.resolve(__dirname, '..');
interface Step { do: string[]; temp?: number; mins?: [number, number]; deviation?: string }
const outlines = JSON.parse(fs.readFileSync(path.join(root, 'tests/fixtures/method-outlines.json'), 'utf8')) as Record<string, { source: string; steps: Step[] }>;
const recipes = new Map(fs.readdirSync(path.join(root, 'content/recipes')).filter((f) => f.endsWith('.json')).flatMap((f) => {
  const v = JSON.parse(fs.readFileSync(path.join(root, 'content/recipes', f), 'utf8')) as RecipeDef | RecipeDef[];
  return (Array.isArray(v) ? v : [v]).map((r) => [r.slug, r] as const);
}));

const minutesIn = (text: string): [number, number][] => [
  ...[...text.matchAll(/(\d+)(?:\s*(?:to|-|–)\s*(\d+))?\s*(?:minutes?|mins?)\b/gi)].map((m) => [Number(m[1]), Number(m[2] ?? m[1])] as [number, number]),
  ...[...text.matchAll(/\b(?:a|one)\s+(?:minute|min)\b/gi)].map(() => [1, 1] as [number, number]),
];
const temps = (text: string): number[] => [...text.matchAll(/(\d{3})\s?c\b/gi)].map((m) => Number(m[1]));
const has = (sentence: string, words: string[]) => words.some((w) => (w === 'oven' ? /\b(oven|preheat)\b/i : new RegExp(`\\b${w}`, 'i')).test(sentence));

describe('methods keep the original cooking', () => {
  it('has an outline for every new dinner we sourced from a recipe we could read', () => {
    expect(Object.keys(outlines).filter((k) => k !== '_about').length).toBeGreaterThanOrEqual(17);
  });
  for (const [slug, o] of Object.entries(outlines)) {
    if (slug === '_about') continue;
    describe(`${slug} (from ${o.source})`, () => {
      const r = recipes.get(slug);
      it('exists', () => expect(r, `${slug} recipe file`).toBeTruthy());
      if (!r) return;
      const steps = r.method;
      const all = steps.join(' ');

      it('does the same things in the same order', () => {
        let cursor = 0;
        for (const st of o.steps) {
          const at = steps.findIndex((s, i) => i >= cursor && has(s, st.do));
          expect(at, `step "${st.do.join('/')}" appears at or after step ${cursor + 1}`).toBeGreaterThanOrEqual(0);
          cursor = at;
        }
      });

      it('uses the original temperature, unless deliberately changed', () => {
        for (const st of o.steps.filter((x) => x.temp && !x.deviation)) {
          const ours = temps(all);
          expect(ours.some((t) => Math.abs(t - st.temp!) <= 20 || Math.abs(t - (st.temp! - 20)) <= 20), `an oven temperature near ${st.temp}C (we say ${ours.join(', ') || 'none'})`).toBe(true);
        }
      });

      it('keeps the original timings, unless deliberately changed (and says why)', () => {
        const ours = minutesIn(all);
        for (const st of o.steps) {
          if (!st.mins) continue;
          if (st.deviation) { expect(st.deviation.length, 'a deviation explains itself').toBeGreaterThan(20); continue; }
          const [lo, hi] = st.mins;
          const ok = ours.some(([a, b]) => a <= hi * 1.34 && b >= lo * 0.66);
          expect(ok, `a time near ${lo}${hi !== lo ? ' to ' + hi : ''} minutes for "${st.do.join('/')}" (we say ${ours.map((x) => x.join('-')).join(', ')})`).toBe(true);
        }
      });
    });
  }
});
