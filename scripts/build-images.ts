// npm run images:build — makes the sized photos for every meal that has an original in content/images/originals/<slug>.(jpg|jpeg|png|webp)
// and records them in content/images/manifest.json. Only changed originals are re-processed. Originals are not committed
// (they are big); keep them in your own storage. The sized files in public/meals/ and the manifest are committed.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { buildVariants, type ImageEntry } from './images-lib';

const ORIG = 'content/images/originals', OUT = 'public/meals', MANIFEST = 'content/images/manifest.json';
type Stored = ImageEntry & { hash: string };

async function main() {
  fs.mkdirSync(ORIG, { recursive: true });
  const manifest: Record<string, Stored> = fs.existsSync(MANIFEST) ? JSON.parse(fs.readFileSync(MANIFEST, 'utf8')) : {};
  const files = fs.readdirSync(ORIG).filter((f) => /\.(jpe?g|png|webp)$/i.test(f)).sort();
  let built = 0, kept = 0, failed = 0;
  for (const f of files) {
    const slug = f.replace(/\.[^.]+$/, '');
    const hash = crypto.createHash('sha256').update(fs.readFileSync(path.join(ORIG, f))).digest('hex').slice(0, 12);
    if (manifest[slug]?.hash === hash && fs.existsSync(path.join(OUT, `${slug}-960.webp`))) { kept++; continue; }
    try { manifest[slug] = { ...(await buildVariants(path.join(ORIG, f), slug, OUT)), hash }; built++; console.log(`  built ${slug}`); }
    catch (e) { failed++; console.error(`  ✖ ${(e as Error).message}`); }
  }
  // A manifest entry whose original has gone is dropped, with its files, so nothing stale ships.
  for (const slug of Object.keys(manifest)) {
    if (files.some((f) => f.replace(/\.[^.]+$/, '') === slug)) continue;
    for (const w of [480, 960, 1440]) fs.rmSync(path.join(OUT, `${slug}-${w}.webp`), { force: true });
    delete manifest[slug]; console.log(`  removed ${slug} (original is gone)`);
  }
  fs.writeFileSync(MANIFEST, JSON.stringify(Object.fromEntries(Object.entries(manifest).sort()), null, 1) + '\n');
  console.log(`images: ${built} built, ${kept} unchanged, ${failed} failed, ${Object.keys(manifest).length} in the manifest`);
  if (failed) process.exit(1);
}
main();
