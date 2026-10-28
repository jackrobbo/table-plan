import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { afterAll, describe, expect, it } from 'vitest';
import { buildVariants, checkSource } from '../scripts/images-lib';
import { hexColour, IMAGE_WIDTHS, mealImageSrc, mealImageSrcSet } from '@/lib/images';
import type { IngredientDef, RecipeDef } from '@/lib/content/types';
import { validateContent } from '@/lib/content/validate';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tp-images-'));
afterAll(() => fs.rmSync(tmp, { recursive: true, force: true }));
const make = async (name: string, w: number, h: number, rgb = { r: 200, g: 120, b: 40 }) => {
  const f = path.join(tmp, name);
  await sharp({ create: { width: w, height: h, channels: 3, background: rgb } }).jpeg().toFile(f);
  return f;
};

describe('image urls', () => {
  it('builds one file per width and a srcset the browser can choose from', () => {
    expect(mealImageSrc('beef-tacos')).toBe('/meals/beef-tacos-960.webp');
    expect(mealImageSrcSet('beef-tacos')).toBe('/meals/beef-tacos-480.webp 480w, /meals/beef-tacos-960.webp 960w, /meals/beef-tacos-1440.webp 1440w');
    expect(hexColour({ r: 255, g: 0, b: 16.4 })).toBe('#ff0010');
    expect(hexColour({ r: -5, g: 300, b: 0 })).toBe('#00ff00');
  });
});

describe('source photo checks', () => {
  it('rejects small or oddly shaped originals, and says why', () => {
    expect(checkSource(4032, 3024, 3e6)).toEqual([]);
    expect(checkSource(1000, 750, 1e5)[0].message).toMatch(/too small/);
    expect(checkSource(1200, 3000, 1e5).some((p) => /too tall/.test(p.message))).toBe(true);
    expect(checkSource(4000, 1200, 1e5).some((p) => /too wide/.test(p.message))).toBe(true);
    expect(checkSource(4032, 3024, 30e6)[0]).toMatchObject({ level: 'warning' });
  });
});

describe('buildVariants', () => {
  it('writes every width cropped to 4:3 and returns the photo\'s average colour', async () => {
    const src = await make('porridge.jpg', 2400, 1800, { r: 200, g: 120, b: 40 });
    const out = path.join(tmp, 'out');
    const entry = await buildVariants(src, 'banana-porridge', out);
    for (const w of IMAGE_WIDTHS) {
      const m = await sharp(path.join(out, `banana-porridge-${w}.webp`)).metadata();
      expect([m.width, m.height, m.format]).toEqual([w, Math.round((w * 3) / 4), 'webp']);
    }
    expect(entry).toMatchObject({ width: 2400, height: 1800, source: 'porridge.jpg' });
    expect(entry.colour).toMatch(/^#[0-9a-f]{6}$/);
    const r = parseInt(entry.colour.slice(1, 3), 16), b = parseInt(entry.colour.slice(5, 7), 16);
    expect(r).toBeGreaterThan(b);   // an orange photo gives an orange placeholder
  });
  it('crops a wide photo rather than squashing it', async () => {
    const out = path.join(tmp, 'out2');
    await buildVariants(await make('wide.jpg', 3000, 1500), 'wide', out);
    const m = await sharp(path.join(out, 'wide-960.webp')).metadata();
    expect([m.width, m.height]).toEqual([960, 720]);
  });
  it('refuses a photo that is too small', async () => {
    await expect(buildVariants(await make('tiny.jpg', 800, 600), 'tiny', path.join(tmp, 'out3'))).rejects.toThrow(/too small/);
  });
});

describe('image rules in content validation', () => {
  const ing: IngredientDef = { slug: 'egg', name: 'Egg', unit: 'g', cupboard: false, allergens: ['eggs'], per100: { kcal: 130, protein_g: 12, carbs_g: 0, fat_g: 9 }, cofid: { verified: true }, product: { retailer: 'morrisons', name: 'Eggs', price_pence: 100, pack_size: 100, slug: 'x/1' } };
  const rec = (over: Partial<RecipeDef> = {}): RecipeDef => ({ slug: 'omelette', name: 'Omelette', course: 'breakfast', serves: 1, status: 'live', ingredients: [{ ingredient: 'egg', qty: 150 }], cupboard: [], method: ['Cook.'], time: { prep: 3, cook: 5 }, ...over });
  const errs = (r: RecipeDef, images?: Record<string, unknown>) => validateContent([ing], [r], images).filter((i) => i.level === 'error').map((i) => i.message);

  it('does not check photos when no manifest is given', () => { expect(errs(rec({ image: { alt: 'x' } }))).toEqual([]); });
  it('needs alt text that actually describes the photo', () => {
    expect(errs(rec({ image: { alt: 'egg' } }), { omelette: {} })[0]).toMatch(/at least 12 characters/);
    expect(errs(rec({ image: { alt: 'A folded omelette on a white plate' } }), { omelette: {} })).toEqual([]);
  });
  it('fails when the alt text has no built photo, or a photo has no alt text', () => {
    expect(errs(rec({ image: { alt: 'A folded omelette on a white plate' } }), {})[0]).toMatch(/no photo is built/);
    expect(errs(rec(), { omelette: {} })[0]).toMatch(/no image\.alt/);
  });
  it('only warns about a photo with no recipe', () => {
    const issues = validateContent([ing], [rec()], { ghost: {} });
    expect(issues.filter((i) => i.level === 'error')).toEqual([]);
    expect(issues.some((i) => i.level === 'warning' && /no recipe/.test(i.message))).toBe(true);
  });
});
