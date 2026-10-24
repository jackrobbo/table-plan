// One-off: lifts the verified PoC data (products, cupboard, recipes, top-ups) into src/data/*.json
import fs from 'node:fs';
const html = fs.readFileSync('public/poc/index.html', 'utf8');
const grab = (name) => {
  const m = html.match(new RegExp(`const ${name}=([\\s\\S]*?);\\s*\\n\\s*(?=const|\\/\\*)`));
  return Function(`return (${m[1]})`)();
};
fs.mkdirSync('src/data', { recursive: true });
for (const [name, file] of [['P', 'products'], ['CUPBOARD_INFO', 'cupboard'], ['R', 'recipes'], ['TOPUPS', 'topups']]) {
  const v = grab(name);
  fs.writeFileSync(`src/data/${file}.json`, JSON.stringify(v, null, 1) + '\n');
  console.log(file, Array.isArray(v) ? v.length : Object.keys(v).length);
}
