// npm run images:placeholders -- <folder of <key>.jpg originals>
// Stand-in photos (Unsplash, free licence) used for any meal that has no photo of its own yet, and by the welcome page.
// Reads content/images/placeholders.json (key -> alt, photographer, source page), writes public/meals/ph-<key>-<w>.webp and
// each photo's average colour back into that file. Real photos (content/images/originals + `npm run images:build`) replace them per meal.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import sharp from 'sharp';
import { buildVariants } from './images-lib';

const src = process.argv[2];
if (!src || !fs.existsSync(src)) { console.error('usage: tsx scripts/build-placeholders.ts <folder with <key>.jpg originals>'); process.exit(1); }
const file = 'content/images/placeholders.json';
const manifest = JSON.parse(fs.readFileSync(file, 'utf8')) as Record<string, { alt: string; by: string; page: string; colour?: string }>;

(async () => {
  for (const key of Object.keys(manifest)) {
    const f = ['.jpg', '.jpeg', '.png', '.webp'].map((e) => path.join(src, key + e)).find((p) => fs.existsSync(p));
    if (!f) { console.error(`✖ ${key}: no original in ${src}`); process.exit(1); }
    // Stock photos can be portrait; the real-photo pipeline rejects those, but a stand-in just gets a landscape crop.
    const { width = 0, height = 0 } = await sharp(f).rotate().metadata();
    let use = f;
    if (width < height * 1.05) {
      use = path.join(os.tmpdir(), `tp-ph-${key}.jpg`);
      await sharp(f).rotate().resize({ width: 1600, height: 1200, fit: 'cover', position: sharp.strategy.attention }).jpeg({ quality: 90 }).toFile(use);
    }
    const e = await buildVariants(use, `ph-${key}`, 'public/meals');
    manifest[key].colour = e.colour;
    console.log(`✓ ${key} ${e.width}x${e.height} ${e.colour}`);
  }
  fs.writeFileSync(file, JSON.stringify(manifest, null, 1) + '\n');
})();
