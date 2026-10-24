// Renders the app icons (the same dark rounded-square "T" as the in-app logo) to public/icons/*.png.
// Full-bleed squares: iOS and Android apply their own corner masks. Run: node scripts/make-icons.mjs
// Uses `sharp`, which Next.js installs for image optimisation (not a direct dependency).
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';

const svg = (size) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#141414"/>
  <g fill="#ffffff">
    <rect x="132" y="142" width="248" height="62" rx="12"/>
    <rect x="225" y="142" width="62" height="228" rx="12"/>
  </g>
</svg>`);

mkdirSync('public/icons', { recursive: true });
const out = { 'icon-192.png': 192, 'icon-512.png': 512, 'icon-maskable-512.png': 512, 'apple-touch-icon.png': 180 };
for (const [file, size] of Object.entries(out)) {
  await sharp(svg(size), { density: 144 }).resize(size, size).png().toFile(`public/icons/${file}`);
  console.log('wrote', file);
}
