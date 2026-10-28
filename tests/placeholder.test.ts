import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { RECIPES } from '../src/data';
import { placeholderKey } from '../src/lib/content/placeholder';
import { IMAGE_WIDTHS } from '../src/lib/images';

const manifest = JSON.parse(fs.readFileSync('content/images/placeholders.json', 'utf8')) as Record<string, { alt: string; by: string; page: string; colour?: string }>;

describe('stand-in meal photos', () => {
  it('every live meal without its own photo gets a stand-in that exists on disk', () => {
    for (const r of RECIPES) {
      if (r.macros_only) continue;
      expect(r.img, r.id).toBeDefined();
      if (!r.img!.ph) continue;   // has its own photo
      expect(manifest[r.img!.ph], r.id).toBeDefined();
      for (const w of IMAGE_WIDTHS) expect(fs.existsSync(`public/meals/ph-${r.img!.ph}-${w}.webp`), `${r.id} ${w}`).toBe(true);
    }
  });
  it('every photo is credited with a source page and has alt text', () => {
    for (const [k, v] of Object.entries(manifest)) {
      expect(v.by, k).toBeTruthy();
      expect(v.page, k).toMatch(/^https:\/\/unsplash\.com\/photos\//);
      expect(v.alt.length, k).toBeGreaterThan(11);
    }
  });
  it('maps by name, falling back to the course', () => {
    expect(placeholderKey({ slug: 'spaghetti-bolognese', course: 'dinner' })).toBe('food-pasta');
    expect(placeholderKey({ slug: 'something-new', course: 'snack' })).toBe('food-snack');
  });
});
