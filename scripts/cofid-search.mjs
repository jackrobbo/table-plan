// node scripts/cofid-search.mjs [-n 3] "chicken breast" "rice basmati" ...   → CoFID matches with per-100g macros
import fs from 'node:fs';
const foods = JSON.parse(fs.readFileSync('content/cofid/cofid.json', 'utf8'));
const args = process.argv.slice(2);
let n = 4;
if (args[0] === '-n') { n = Number(args[1]); args.splice(0, 2); }
for (const q of args) {
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  const hits = foods.filter((f) => words.every((w) => f[1].toLowerCase().includes(w)))
    .sort((a, b) => a[1].length - b[1].length).slice(0, n);
  console.log(`## ${q}`);
  for (const [code, name, , kcal, p, fat, c] of hits) console.log(`  ${code} ${name.slice(0, 62)} | ${kcal}k P${p} F${fat} C${c}`);
}
