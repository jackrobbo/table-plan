// npm run nutrition:apply — fills per100 / cofid / gramsPerUnit / negligible / allergens on content/ingredients.json from
//   content/cofid-map.json (which CoFID food each ingredient is, plus unit weights),
//   content/cofid/cofid.json (the CoFID 2021 dataset, OGL) and
//   content/nutrition-labels.json (pack labels of the mapped Morrisons products, from `npm run labels:fetch`).
// Rule: a pack label that agrees with its CoFID food is used (it is the exact product); a label that disagrees is NOT trusted
// and is reported for review (CoFID is used, unverified). Labels stated "as consumed/boiled/drained" are ignored unless the
// map says labelOk, because recipe quantities are as-sold weights.
import fs from 'node:fs';
import type { IngredientDef } from '../src/lib/content/types';

type Food = [code: string, name: string, group: string, kcal: number, protein: number, fat: number, carbs: number];
interface MapEntry { code?: string; gpu?: number; negligible?: boolean; prefer?: 'label' | 'cofid'; labelOk?: boolean; approx?: string; scale?: number; why?: string }
interface Label { kcal?: number; protein_g?: number; carbs_g?: number; fat_g?: number; basis?: string; allergens?: string[] }

const read = <T>(f: string, fallback: T): T => (fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : fallback);
const ingredients = read<IngredientDef[]>('content/ingredients.json', []);
const map = read<Record<string, MapEntry>>('content/cofid-map.json', {});
const foods = new Map(read<Food[]>('content/cofid/cofid.json', []).map((f) => [f[0], f]));
const labels = read<Record<string, Label>>('content/nutrition-labels.json', {});

const AS_CONSUMED = /boiled|cooked|consumed|prepared|drained/i;
const near = (a: number, b: number, abs: number, rel: number) => Math.abs(a - b) <= Math.max(abs, rel * b);

const report = { mismatch: [] as string[], labelOnly: [] as string[], approx: [] as string[], none: [] as string[], allergen: [] as string[], ignoredLabel: [] as string[] };

for (const i of ingredients) {
  const m = map[i.slug] ?? {};
  if (m.gpu) i.gramsPerUnit = m.gpu; else delete i.gramsPerUnit;
  if (m.negligible) i.negligible = true; else delete i.negligible;

  const food = m.code ? foods.get(m.code) : undefined;
  if (m.code && !food) throw new Error(`${i.slug}: CoFID code ${m.code} not found`);
  const l = labels[i.slug];
  const hasLabel = l?.kcal != null && l.protein_g != null && l.carbs_g != null && l.fat_g != null;
  const labelUsable = hasLabel && (!AS_CONSUMED.test(l!.basis ?? '') || !!m.labelOk);
  if (hasLabel && !labelUsable) report.ignoredLabel.push(`${i.slug}: label is "${l!.basis}", recipes use as-sold weights`);

  const fromLabel = () => ({ kcal: l!.kcal!, protein_g: l!.protein_g!, carbs_g: l!.carbs_g!, fat_g: l!.fat_g! });
  const fromFood = () => ({ kcal: food![3], protein_g: food![4], carbs_g: food![6], fat_g: food![5] });
  const code = food?.[0], name = food?.[1];

  if (food && labelUsable) {
    const agree = near(l!.kcal!, food[3], 15, 0.25) && near(l!.protein_g!, food[4], 2, 0.3);
    if (m.prefer === 'cofid') { i.per100 = fromFood(); i.cofid = { code, name, verified: true, basis: 'cofid' }; }
    else if (m.prefer === 'label' || agree) { i.per100 = fromLabel(); i.cofid = { code, name, verified: true, basis: 'label' }; }
    else {
      i.per100 = fromFood(); i.cofid = { code, name, verified: false, basis: 'cofid' };
      report.mismatch.push(`${i.slug}: label ${l!.kcal} kcal / ${l!.protein_g}g P / ${l!.fat_g}g F  vs  CoFID "${name}" ${food[3]} / ${food[4]} / ${food[5]}`);
    }
  } else if (labelUsable) {
    i.per100 = fromLabel(); i.cofid = { name: 'Pack label (no CoFID cross-check)', verified: true, basis: 'label' };
    report.labelOnly.push(i.slug);
  } else if (food) {
    i.per100 = fromFood(); i.cofid = { code, name, verified: true, basis: 'cofid' };
  } else if (!m.negligible) {
    i.per100 = null; delete i.cofid;
    report.none.push(i.slug);
  }
  if (i.per100 && m.scale) {
    const k = m.scale; const p = i.per100;
    i.per100 = { kcal: +(p.kcal * k).toFixed(1), protein_g: +(p.protein_g * k).toFixed(1), carbs_g: +(p.carbs_g * k).toFixed(1), fat_g: +(p.fat_g * k).toFixed(1) };
  }
  if (i.cofid && m.approx) { i.cofid.approx = m.approx; report.approx.push(`${i.slug}: ${m.approx}`); }
  if (i.cofid && m.why) i.cofid.note = m.why;

  // Allergens: the label's bold allergens are added to anything already set (never removed).
  const declared = (l?.allergens ?? []) as IngredientDef['allergens'];
  const merged = [...new Set([...i.allergens, ...declared])].sort() as IngredientDef['allergens'];
  const added = merged.filter((a) => !i.allergens.includes(a));
  if (added.length) report.allergen.push(`${i.slug}: + ${added.join(', ')}`);
  i.allergens = merged;
}

fs.writeFileSync('content/ingredients.json', JSON.stringify(ingredients, null, 1) + '\n');
const show = (t: string, a: string[]) => { if (a.length) { console.log(`\n${t} (${a.length})`); a.forEach((x) => console.log('  ' + x)); } };
show('LABEL vs CoFID DISAGREE — CoFID used, unverified; needs a decision', report.mismatch);
show('label ignored (as-consumed basis)', report.ignoredLabel);
show('no nutrition data at all', report.none);
show('label-only (no CoFID cross-check)', report.labelOnly);
show('approximate CoFID match (dietitian to confirm)', report.approx);
show('allergens added from the label', report.allergen);
const verified = ingredients.filter((i) => i.per100 && i.cofid?.verified).length;
console.log(`\n${verified}/${ingredients.filter((i) => !i.negligible).length} ingredients with verified per-100 data`);
