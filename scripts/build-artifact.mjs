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
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=Karla:wght@400;500;600;700&family=Spline+Sans+Mono:wght@400;500;600&display=swap">
<style>
${css}
.wrap{padding-left:max(16px,env(safe-area-inset-left,0px)); padding-right:max(16px,env(safe-area-inset-right,0px));}
body{font-size:16px; line-height:1.55; min-height:100%;}
</style>
<div id="root"></div>
<script>${js}</script>
`;
fs.writeFileSync(out, html);
console.log(out, (html.length / 1024).toFixed(0) + ' KB');
