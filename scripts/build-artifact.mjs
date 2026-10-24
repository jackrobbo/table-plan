// node scripts/build-artifact.mjs <out.html> — single-file preview of the app (mock backend, in-memory routing).
import fs from 'node:fs';
import path from 'node:path';
import { build } from 'esbuild';
const out = process.argv[2];
const r = await build({
  entryPoints: ['scripts/artifact/entry.tsx'], bundle: true, write: false, minify: true, format: 'iife', jsx: 'automatic',
  define: { 'process.env.NODE_ENV': '"production"' },
  alias: {
    '@': path.resolve('src'),
    'next/navigation': path.resolve('scripts/artifact/shim-navigation.ts'),
    'next/link': path.resolve('scripts/artifact/shim-link.tsx'),
  },
});
const js = r.outputFiles[0].text.replace(/<\/script/g, '<\\/script');
const css = fs.readFileSync('src/app/globals.css', 'utf8');
const html = `<title>Table Plan</title>
<meta name="claude:viewport-fit-sides" content="cover">
<style>
${css}
</style>
<div id="root"></div>
<script>${js}</script>
`;
fs.writeFileSync(out, html);
console.log(out, (html.length / 1024).toFixed(0) + ' KB');
