// Turns an original photo into the sized files the app serves. Used by build-images.ts and the tests.
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { hexColour, IMAGE_MIN, IMAGE_RATIO, IMAGE_WIDTHS } from '../src/lib/images';

export interface ImageEntry { colour: string; width: number; height: number; source: string }
export interface Problem { level: 'error' | 'warning'; message: string }

/** Checks a source photo is big enough and a sensible shape to crop to 4:3. Pure, so it is easy to test. */
export function checkSource(width: number, height: number, bytes: number): Problem[] {
  const out: Problem[] = [];
  if (width < IMAGE_MIN.width || height < IMAGE_MIN.height) out.push({ level: 'error', message: `${width}x${height} is too small; need at least ${IMAGE_MIN.width}x${IMAGE_MIN.height}` });
  const ratio = width / height;
  if (ratio < 1 || ratio > 2.2) out.push({ level: 'error', message: `aspect ${ratio.toFixed(2)} is too ${ratio < 1 ? 'tall' : 'wide'} to crop to 4:3 (use landscape, between 1:1 and 2.2:1)` });
  if (bytes > 25 * 1024 * 1024) out.push({ level: 'warning', message: `${(bytes / 1048576).toFixed(0)} MB original; fine, but export smaller next time` });
  return out;
}

/** Writes <slug>-<w>.webp for every width into outDir (4:3, centre-weighted on the interesting part) and returns the manifest entry. */
export async function buildVariants(srcFile: string, slug: string, outDir: string): Promise<ImageEntry> {
  const img = sharp(srcFile, { failOn: 'error' }).rotate();   // respect phone EXIF orientation
  const meta = await img.metadata();
  const { width = 0, height = 0 } = meta;
  const problems = checkSource(width, height, fs.statSync(srcFile).size).filter((p) => p.level === 'error');
  if (problems.length) throw new Error(`${path.basename(srcFile)}: ${problems.map((p) => p.message).join('; ')}`);
  fs.mkdirSync(outDir, { recursive: true });
  for (const w of IMAGE_WIDTHS) {
    await sharp(srcFile).rotate()
      .resize({ width: w, height: Math.round(w / IMAGE_RATIO), fit: 'cover', position: sharp.strategy.attention })
      .webp({ quality: 78, effort: 5 }).toFile(path.join(outDir, `${slug}-${w}.webp`));
  }
  const { dominant } = await sharp(srcFile).rotate().resize(64, 48, { fit: 'cover' }).stats();
  return { colour: hexColour(dominant), width, height, source: path.basename(srcFile) };
}
