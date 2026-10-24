// npm run extension:zip: packs extension/ into a zip you can send to testers (or upload to the Chrome Web Store).
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const out = path.resolve(process.argv[2] ?? 'table-plan-morrisons-extension.zip');
const manifest = JSON.parse(fs.readFileSync('extension/manifest.json', 'utf8'));
fs.rmSync(out, { force: true });
execFileSync('zip', ['-r', '-q', out, '.', '-x', 'README.md', '.DS_Store'], { cwd: 'extension', stdio: 'inherit' });
console.log(`wrote ${out} (v${manifest.version})`);
