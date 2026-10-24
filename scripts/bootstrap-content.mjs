// One-off: converts the lifted PoC data into the canonical content/ format.
import fs from 'node:fs';
const j = (f) => JSON.parse(fs.readFileSync(`src/data/${f}.json`, 'utf8'));
const A = {
  prawns: ['crustaceans'], eggs: ['eggs'], milk: ['milk'], yog: ['milk'], greek: ['milk'], creme: ['milk'],
  babybel: ['milk'], pouch: ['milk'], loaf: ['gluten'], wraps: ['gluten'], mission: ['gluten', 'soya'],
  pittas: ['gluten'], houm: ['sesame'], grenade: ['milk', 'soya', 'gluten', 'nuts', 'peanuts'],
  wafer: ['milk', 'soya', 'gluten', 'nuts', 'peanuts'], pops: ['milk', 'soya'],
  spaghetti: ['gluten'], fusilli: ['gluten'], noodles: ['gluten', 'eggs'], lasagne: ['gluten', 'eggs'],
  granola: ['gluten', 'nuts', 'milk'], butter: ['milk'], tuna: ['fish'], peri: ['celery', 'mustard', 'sulphites'],
  soy: ['soya', 'gluten'], teriyaki: ['soya', 'gluten', 'sesame'], mayo: ['eggs', 'mustard'],
  seafood: ['eggs', 'mustard'], cheddar: ['milk'], nuts: ['nuts', 'peanuts'], parmesan: ['milk'],
  isolate: ['milk', 'soya'], fajita: ['sulphites'],
};
const kebab = (s) => s.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const products = j('products'), cupboard = j('cupboard');
const ingredients = [];
for (const [k, p] of Object.entries(products)) ingredients.push({
  slug: k, name: p.n, unit: p.u, cupboard: false, allergens: A[k] ?? [], per100: null,
  product: { retailer: 'morrisons', name: p.n, price_pence: p.pr, pack_size: p.pack, slug: p.s },
});
for (const [k, info] of Object.entries(cupboard)) ingredients.push({
  slug: k, name: info.split(' · ')[0], unit: 'g', cupboard: true, note: info, allergens: A[k] ?? [], per100: null, product: null,
});
fs.writeFileSync('content/ingredients.json', JSON.stringify(ingredients, null, 1) + '\n');
const slugs = new Set();
for (const r of j('recipes')) {
  let slug = kebab(r.n); if (slugs.has(slug)) slug += '-' + r.id.toLowerCase(); slugs.add(slug);
  const out = {
    slug, name: r.n, course: r.c, emoji: r.e, serves: r.serves, status: 'live',
    per_portion: { kcal: r.k, protein_g: r.p },
    ingredients: r.fresh.map(([ing, qty]) => ({ ingredient: ing, qty })),
    cupboard: r.cup, method: r.m, source: 'poc',
  };
  fs.writeFileSync(`content/recipes/${slug}.json`, JSON.stringify(out, null, 1) + '\n');
}
console.log(ingredients.length, 'ingredients', slugs.size, 'recipes');
