import { ALLERGENS } from '../allergens';
import type { IngredientDef, Issue, RecipeDef } from './types';

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const COURSES = ['breakfast', 'lunch', 'snack', 'dinner'];
const STATUSES = ['draft', 'verified', 'live'];
const ALLERGEN_KEYS = new Set<string>(ALLERGENS.map(([k]) => k));
/** Declared vs computed kcal tolerance when every ingredient has CoFID data. */
export const KCAL_TOLERANCE = 0.15;
/** Stricter bar to count as verified (protein gets 1.5x this). */
export const VERIFY_TOLERANCE = 0.1;

/** Quantity in g/ml for macro maths: g/ml units as-is, count units via `unit_g`, otherwise null (not computable). */
export function baseQty(d: IngredientDef | undefined, qty: number): number | null {
  if (!d) return null;
  if (d.unit === 'g' || d.unit === 'ml') return qty;
  return d.unit_g && d.unit_g > 0 ? qty * d.unit_g : null;
}

export function validateContent(ingredients: IngredientDef[], recipes: RecipeDef[]): Issue[] {
  const issues: Issue[] = [];
  const err = (where: string, message: string) => issues.push({ where, level: 'error', message });
  const warn = (where: string, message: string) => issues.push({ where, level: 'warning', message });

  const ing = new Map<string, IngredientDef>();
  for (const i of ingredients) {
    const w = `ingredient ${i.slug}`;
    if (!SLUG.test(i.slug)) err(w, 'slug must be lowercase kebab-case');
    if (ing.has(i.slug)) err(w, 'duplicate slug');
    ing.set(i.slug, i);
    if (!i.name) err(w, 'missing name');
    for (const a of i.allergens ?? []) if (!ALLERGEN_KEYS.has(a)) err(w, `unknown allergen "${a}"`);
    if (i.product && !(i.product.price_pence >= 0 && i.product.pack_size > 0)) err(w, 'product needs price_pence >= 0 and pack_size > 0');
    if (i.unit_g != null && !(i.unit_g > 0)) err(w, 'unit_g must be > 0');
    if (!i.cupboard && !i.product) warn(w, 'not mapped to a retailer product yet (will be unpriced)');
  }

  const slugs = new Set<string>(), names = new Set<string>();
  for (const r of recipes) {
    const w = `recipe ${r.slug ?? '(no slug)'}`;
    if (!SLUG.test(r.slug ?? '')) err(w, 'slug must be lowercase kebab-case');
    if (slugs.has(r.slug)) err(w, 'duplicate slug');
    slugs.add(r.slug);
    const nk = (r.name ?? '').trim().toLowerCase();
    if (!nk) err(w, 'missing name'); else if (names.has(nk)) err(w, `duplicate name "${r.name}"`);
    names.add(nk);
    if (!COURSES.includes(r.course)) err(w, `course must be one of ${COURSES.join(', ')}`);
    if (!STATUSES.includes(r.status)) err(w, `status must be one of ${STATUSES.join(', ')}`);
    if (!Number.isInteger(r.serves) || r.serves < 1) err(w, 'serves must be a whole number >= 1');

    const m = r.per_portion;
    if (!m || !(m.kcal > 0) || !(m.protein_g >= 0)) err(w, 'per_portion needs kcal > 0 and protein_g');
    else {
      const lo = r.course === 'snack' ? 40 : 150;
      if (m.kcal < lo || m.kcal > 1200) warn(w, `${m.kcal} kcal per portion looks off for a ${r.course}`);
      if (m.protein_g * 4 > m.kcal) err(w, 'protein calories exceed total kcal');
      if (m.carbs_g != null && m.fat_g != null) {
        const sum = m.protein_g * 4 + m.carbs_g * 4 + m.fat_g * 9;
        if (Math.abs(sum - m.kcal) / m.kcal > 0.15) warn(w, `P/C/F sum to ${Math.round(sum)} kcal vs declared ${m.kcal}`);
      }
    }

    if (!r.ingredients?.length && !r.macros_only) err(w, 'needs at least one ingredient (or macros_only: true)');
    const seen = new Set<string>();
    for (const l of r.ingredients ?? []) {
      const d = ing.get(l.ingredient);
      if (!d) { err(w, `unknown ingredient "${l.ingredient}"`); continue; }
      if (d.cupboard) warn(w, `"${l.ingredient}" is a cupboard item; list it under cupboard`);
      if (seen.has(l.ingredient)) err(w, `ingredient "${l.ingredient}" listed twice`);
      seen.add(l.ingredient);
      if (!(l.qty > 0)) err(w, `quantity for "${l.ingredient}" must be > 0`);
    }
    for (const c of r.cupboard ?? []) {
      const d = ing.get(c);
      if (!d) err(w, `unknown cupboard item "${c}"`);
      else if (!d.cupboard) err(w, `"${c}" is not flagged as a cupboard item`);
    }
    for (const [k, g] of Object.entries(r.cupboard_g ?? {})) {
      if (!(r.cupboard ?? []).includes(k)) err(w, `cupboard_g "${k}" is not listed under cupboard`);
      if (!(g > 0)) err(w, `cupboard_g for "${k}" must be > 0`);
    }
    for (const a of r.extra_allergens ?? []) if (!ALLERGEN_KEYS.has(a)) err(w, `unknown allergen "${a}"`);
    if (r.course !== 'snack' && !r.macros_only && !r.method?.length) warn(w, 'no method steps');

    // Declared macros vs ingredient data, only when fully computable (g/ml units, all CoFID present). Skipped for grandfathered
    // PoC recipes: their cupboard staples (rice, pasta, cheese) have no quantities, so the computed figure would be incomplete.
    const lines = (r.ingredients ?? []).map((l) => ({ l, d: ing.get(l.ingredient) }));
    const cups = Object.entries(r.cupboard_g ?? {}).map(([k, g]) => ({ g, d: ing.get(k) }));
    if (r.source !== 'poc' && lines.length && lines.every(({ d }) => d?.per100 && baseQty(d, 1) !== null) && cups.every(({ d }) => d?.per100)) {
      const total = (lines.reduce((s, { l, d }) => s + (d!.per100!.kcal * baseQty(d, l.qty)!) / 100, 0)
        + cups.reduce((s, { g, d }) => s + (d!.per100!.kcal * g) / 100, 0)) / r.serves;
      if (m?.kcal && Math.abs(total - m.kcal) / m.kcal > KCAL_TOLERANCE)
        warn(w, `declared ${m.kcal} kcal but ingredients compute to ~${Math.round(total)} per portion`);
    }

    if (r.status === 'verified' || (r.status === 'live' && r.source !== 'poc')) {
      const v = verifyRecipe(r, ing);
      if (!r.macros_only && !v.verified) err(w, `${r.status} recipes need CoFID-verified ingredients: ${v.reason}`);
    } else if (r.status === 'live' && !r.macros_only) warn(w, 'live but macros not CoFID-verified (grandfathered PoC)');
    if (r.status === 'live') {
      for (const { l, d } of lines) if (d && !d.cupboard && !d.product) err(w, `live recipes need priced ingredients; "${l.ingredient}" has no product`);
    }
  }
  return issues;
}

/** Union of ingredient + cupboard allergens, plus any manual extras. Sorted, stable. */
export function deriveAllergens(r: RecipeDef, ingredients: Map<string, IngredientDef>): string[] {
  const out = new Set<string>(r.extra_allergens ?? []);
  for (const k of [...r.ingredients.map((l) => l.ingredient), ...r.cupboard]) ingredients.get(k)?.allergens.forEach((a) => out.add(a));
  return [...out].sort();
}

export interface Verification {
  verified: boolean;
  reason: string;
  /** Share of ingredient lines with verified per-100 data (0–1). */
  coverage: number;
  computedKcal: number | null;
  computedProtein: number | null;
}

/** Verified = every ingredient line (and any `cupboard_g` item) has verified CoFID data in g/ml (or a `unit_g` weight) and computed macros match the declared ones. */
export function verifyRecipe(r: RecipeDef, ing: Map<string, IngredientDef>): Verification {
  const lines = (r.ingredients ?? []).map((l) => ({ l, d: ing.get(l.ingredient) }));
  const ok = lines.filter(({ d }) => d?.per100 && d.cofid?.verified && baseQty(d, 1) !== null);
  const coverage = lines.length ? ok.length / lines.length : 0;
  if (!lines.length) return { verified: false, reason: 'no ingredients', coverage, computedKcal: null, computedProtein: null };
  const cups = Object.entries(r.cupboard_g ?? {}).map(([k, g]) => ({ k, g, d: ing.get(k) }));
  const cupOk = cups.filter(({ d }) => d?.per100 && d.cofid?.verified);
  if (ok.length < lines.length || cupOk.length < cups.length) {
    const missing = [...lines.filter((x) => !ok.includes(x)).map(({ l }) => l.ingredient), ...cups.filter((x) => !cupOk.includes(x)).map(({ k }) => k)].join(', ');
    return { verified: false, reason: `missing verified CoFID data for ${missing}`, coverage, computedKcal: null, computedProtein: null };
  }
  const sum = (f: (p: NonNullable<IngredientDef['per100']>) => number) =>
    (ok.reduce((s, { l, d }) => s + (f(d!.per100!) * baseQty(d, l.qty)!) / 100, 0)
      + cupOk.reduce((s, { g, d }) => s + (f(d!.per100!) * g) / 100, 0)) / r.serves;
  const kcal = sum((p) => p.kcal), protein = sum((p) => p.protein_g);
  const kOff = Math.abs(kcal - r.per_portion.kcal) / r.per_portion.kcal;
  const pOff = r.per_portion.protein_g ? Math.abs(protein - r.per_portion.protein_g) / r.per_portion.protein_g : 0;
  const good = kOff <= VERIFY_TOLERANCE && pOff <= VERIFY_TOLERANCE * 1.5;
  return {
    verified: good, coverage, computedKcal: Math.round(kcal), computedProtein: Math.round(protein),
    reason: good ? 'ok' : `computed ${Math.round(kcal)} kcal / ${Math.round(protein)}g vs declared ${r.per_portion.kcal} / ${r.per_portion.protein_g}g`,
  };
}
