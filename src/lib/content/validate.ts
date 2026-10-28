import { ALLERGENS } from '../allergens';
import { computePerPortion, costPerPortion, gramsOf, recipeLines, resolvePerPortion } from './macros';
import type { IngredientDef, Issue, RecipeDef } from './types';

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const COURSES = ['breakfast', 'lunch', 'snack', 'dinner'];
const STATUSES = ['draft', 'verified', 'live'];
const ALLERGEN_KEYS = new Set<string>(ALLERGENS.map(([k]) => k));
/** Words in an ingredient's name that imply an allergen. A safety net: allergens drive hard exclusions, so a miss must fail the import. */
const NAME_IMPLIES: [RegExp, string][] = [
  [/\b(cod|salmon|tuna|haddock|fish|anchov\w*|mackerel|sardine\w*)\b/i, 'fish'],
  [/\b(prawns?|shrimps?|crab|lobster)\b/i, 'crustaceans'],
  [/\b(milk|cheese|cheddar|parmesan|halloumi|feta|mozzarella|yogurt|yoghurt|cream|cr[eè]me|butter|cottage)\b/i, 'milk'],
  [/\beggs?\b/i, 'eggs'],
  [/\bpeanut\b/i, 'peanuts'],
  [/\bsoy\b/i, 'soya'],
  [/\b(bread|loaf|wraps?|tortilla|pittas?|bagels?|naans?|pasta|spaghetti|fusilli|lasagne|noodles|crackers?|flour|oats)\b/i, 'gluten'],
];
/** Declared vs computed kcal tolerance when every ingredient has CoFID data. */
export const KCAL_TOLERANCE = 0.15;
/** Stricter bar to count as verified (protein gets 1.5x this). */
export const VERIFY_TOLERANCE = 0.1;

/** `images` is content/images/manifest.json (slug -> built photo). Leave it out to skip the photo checks. */
export function validateContent(ingredients: IngredientDef[], recipes: RecipeDef[], images?: Record<string, unknown>): Issue[] {
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
    if (!i.cupboard && !i.product) warn(w, 'not mapped to a retailer product yet (will be unpriced)');
    for (const [re, a] of NAME_IMPLIES) {
      // "coconut milk", "peanut butter" and "cream crackers" are not dairy, whatever the words suggest.
      if (re.test(i.name) && !/coconut milk|cornflour|peanut butter|cream crackers/i.test(i.name) && !(i.allergens ?? []).includes(a as never)) err(w, `name suggests "${a}" but it is not in allergens`);
    }
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
    if (r.time) {
      const { prep, cook } = r.time;
      if (!Number.isInteger(prep) || !Number.isInteger(cook) || prep < 0 || cook < 0) err(w, 'time.prep and time.cook must be whole minutes >= 0');
      else if (prep + cook > 240) warn(w, `${prep + cook} minutes looks long for a weeknight meal`);
      else if (prep + cook === 0 && r.course !== 'snack') err(w, 'only snacks can take no time');
    } else if (r.status === 'live' && !r.macros_only) err(w, 'live recipes need an estimated time ({ prep, cook } minutes)');

    // Grandfathered = a PoC recipe still carrying its hand-declared macros; once they are computed it is held to the full bar.
    const poc = r.source === 'poc' && !!r.per_portion;
    const res = resolvePerPortion(r, ing);
    const m = res;
    if (r.macros_only && !r.per_portion) err(w, 'macros_only recipes must declare per_portion');
    else if (res.missing.length) err(w, `cannot compute macros: no nutrition data for ${[...new Set(res.missing)].join(', ')}`);
    else if (!(m.kcal > 0) || !(m.protein_g >= 0)) err(w, 'macros need kcal > 0 and protein_g');
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
    for (const k of Object.keys(r.cupboard_qty ?? {})) if (!(r.cupboard ?? []).includes(k)) err(w, `cupboard_qty has "${k}", which is not in cupboard`);
    if (!poc && !r.macros_only) {
      // New content must be fully computable and costable: quantities for every cupboard item, weights for every counted unit.
      for (const c of r.cupboard ?? []) {
        const d = ing.get(c);
        if (d && !((r.cupboard_qty?.[c] ?? 0) > 0) && !(d.negligible && !d.cupboardPrice)) err(w, `cupboard item "${c}" needs a quantity in cupboard_qty (g/ml)`);
      }
      for (const l of r.ingredients ?? []) {
        const d = ing.get(l.ingredient);
        if (d && !(d.negligible && !d.per100) && gramsOf(d, l.qty) == null) err(w, `"${l.ingredient}" is counted in ${d.unit} but has no gramsPerUnit`);
      }
    }
    for (const a of r.extra_allergens ?? []) if (!ALLERGEN_KEYS.has(a)) err(w, `unknown allergen "${a}"`);
    if (r.course !== 'snack' && !r.macros_only && !r.method?.length) warn(w, 'no method steps');

    // Declared macros vs ingredient data, only when declared and fully computable.
    if (r.per_portion && !r.macros_only) {
      const c = computePerPortion(r, ing);
      if (!c.missing.length && Math.abs(c.kcal - r.per_portion.kcal) / r.per_portion.kcal > KCAL_TOLERANCE)
        warn(w, `declared ${r.per_portion.kcal} kcal but ingredients compute to ~${c.kcal} per portion`);
    }
    const lines = (r.ingredients ?? []).map((l) => ({ l, d: ing.get(l.ingredient) }));

    if (r.status === 'verified' || (r.status === 'live' && !poc)) {
      const v = verifyRecipe(r, ing);
      if (!r.macros_only && !v.verified) err(w, `${r.status} recipes need CoFID-verified ingredients: ${v.reason}`);
    } else if (r.status === 'live' && !r.macros_only) warn(w, 'live but macros not CoFID-verified (grandfathered PoC)');
    if (r.status === 'live' && !r.macros_only) {
      for (const { l, d } of lines) if (d && !d.cupboard && !d.product) err(w, `live recipes need priced ingredients; "${l.ingredient}" has no product`);
      for (const c of r.cupboard ?? []) {
        const d = ing.get(c);
        if (d && !d.product && !d.cupboardPrice && !d.negligible) (poc ? warn : err)(w, `cupboard item "${c}" has no price, so the recipe cannot be costed`);
      }
      if (!poc && !res.missing.length && costPerPortion(r, ing) == null) err(w, 'cannot work out a cost per portion');
    }
  }
  if (images) {
    const bySlug = new Map(recipes.map((r) => [r.slug, r]));
    for (const r of recipes) {
      const w = `recipe ${r.slug}`;
      if (r.image) {
        if ((r.image.alt ?? '').trim().length < 12) err(w, 'image.alt must describe the photo (at least 12 characters), for screen readers');
        if (!images[r.slug]) err(w, `has image.alt but no photo is built: put ${r.slug}.jpg in content/images/originals/ and run npm run images:build`);
      } else if (images[r.slug]) err(w, 'a photo is built for this recipe but it has no image.alt: add "image": { "alt": "..." }');
    }
    for (const slug of Object.keys(images)) if (!bySlug.has(slug)) warn(`image ${slug}`, 'photo has no recipe with that slug');
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

/**
 * Verified = every counted line (fresh and cupboard) has verified per-100 data with a usable weight, every cupboard item has a
 * quantity (or is a pinch-of-spice), and, if macros were declared, they match what the ingredients compute to.
 */
export function verifyRecipe(r: RecipeDef, ing: Map<string, IngredientDef>): Verification {
  const lines = recipeLines(r, ing).map((l) => ({ l, d: ing.get(l.slug) })).filter(({ d }) => !(d?.negligible && !d.per100));
  const unlisted = (r.cupboard ?? []).filter((c) => !((r.cupboard_qty?.[c] ?? 0) > 0) && !ing.get(c)?.negligible);
  if (!lines.length) return { verified: false, reason: 'no ingredients', coverage: 0, computedKcal: null, computedProtein: null };
  const ok = lines.filter(({ l, d }) => d?.per100 && d.cofid?.verified && gramsOf(d, l.qty) != null);
  const coverage = ok.length / (lines.length + unlisted.length);
  if (ok.length < lines.length || unlisted.length) {
    const missing = [...lines.filter((x) => !ok.includes(x)).map(({ l }) => l.slug), ...unlisted.map((c) => `${c} (no quantity)`)].join(', ');
    return { verified: false, reason: `missing verified nutrition data for ${missing}`, coverage, computedKcal: null, computedProtein: null };
  }
  const c = computePerPortion(r, ing);
  if (!r.per_portion) return { verified: true, reason: 'ok', coverage: 1, computedKcal: c.kcal, computedProtein: c.protein_g };
  const kOff = Math.abs(c.kcal - r.per_portion.kcal) / r.per_portion.kcal;
  const pOff = r.per_portion.protein_g ? Math.abs(c.protein_g - r.per_portion.protein_g) / r.per_portion.protein_g : 0;
  const good = kOff <= VERIFY_TOLERANCE && pOff <= VERIFY_TOLERANCE * 1.5;
  return {
    verified: good, coverage: 1, computedKcal: c.kcal, computedProtein: c.protein_g,
    reason: good ? 'ok' : `computed ${c.kcal} kcal / ${c.protein_g}g vs declared ${r.per_portion.kcal} / ${r.per_portion.protein_g}g`,
  };
}
