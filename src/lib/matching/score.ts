import type { IngredientDef } from '../content/types';
import { packInUnit, parsePack } from './pack';
import type { SourceRow, Suggestion } from './types';

const STOP = new Set(['the', 'and', 'with', 'in', 'of', 'a', 'pack', 'pk', 'x', 'per', 'each', 'loose', 'fresh', 'whole', 'approx', 'about', 'bunch', 'pot', 'bag', 'tin', 'can']);
const STORE_WORDS = new Set(['tesco', 'morrisons', 'asda', 'sainsburys', "sainsbury's", 'ocado', 'waitrose', 'aldi', 'lidl', 'savers', 'everyday', 'value', 'finest', 'essentials', 'basics', 'just', 'extra', 'special', 'taste', 'difference', 'best', 'wholefoods']);
const SYN: Record<string, string> = { yoghurt: 'yogurt', zucchini: 'courgette', hummus: 'houmous', scallion: 'spring', minced: 'mince' };
/** Words that change what a product is. A candidate with one the ingredient lacks is probably a different thing (smoked, breaded, cooked...). */
const MODIFIERS = new Set(['smoked', 'breaded', 'battered', 'marinated', 'flavour', 'flavoured', 'stuffed', 'cooked', 'roast', 'roasted', 'dried', 'ready', 'sweetened', 'crispy', 'spicy', 'bbq', 'kiev', 'kievs', 'sauce', 'ready-to-eat', 'chilled', 'meal', 'sandwich']);
const PREMIUM = /\b(finest|extra special|taste the difference|the best|signature|premium|reserve|organic)\b/i;
const VALUE = /\b(everyday value|just essentials|basics|savers|smart ?price|essentials|value)\b/i;
const OWN = /\b(tesco|asda|sainsbury'?s|morrisons|ocado|waitrose|aldi|lidl)\b/i;
const KNOWN_BRANDS = ['fyffes', 'mission', 'grenade', 'myprotein', 'novo', 'babybel', "nando's", 'fuel10k'];

const stem = (w: string) => {
  w = SYN[w] ?? w;
  if (w.endsWith('ies') && w.length > 4) return w.slice(0, -3) + 'y';
  if (w.endsWith('oes')) return w.slice(0, -2);
  if (w.endsWith('s') && !w.endsWith('ss') && w.length > 3) return w.slice(0, -1);
  return w;
};

/** Meaningful words of a product name: no sizes, store brands or filler, plurals folded. */
export function tokens(name: string): string[] {
  const clean = name.toLowerCase().replace(/\(.*?\)/g, ' ').replace(/\d+(?:[.,]\d+)?\s*(?:x\s*)?(?:kg|g|ml|cl|l|pints?|pk|pack)\b/g, ' ').replace(/[^a-z0-9%' -]/g, ' ');
  return clean.split(/\s+/).map((w) => w.replace(/^'|'$/g, '')).filter((w) => w && !STOP.has(w) && !STORE_WORDS.has(w) && !/^\d+$/.test(w)).map(stem);
}

export type Tier = 'value' | 'own' | 'premium' | 'brand' | 'generic';
/** What kind of product the Morrisons mapping is: its Savers line, its own brand, a named brand, or an unbranded item. */
export function ingredientTier(i: IngredientDef): { tier: Tier; brand?: string } {
  const n = (i.product?.name ?? i.name).toLowerCase();
  if (/\bsavers\b/.test(n)) return { tier: 'value' };
  if (/^morrisons\b/.test(n)) return { tier: 'own' };
  const b = KNOWN_BRANDS.find((k) => n.includes(k));
  return b ? { tier: 'brand', brand: b } : { tier: 'generic' };
}
export function rowTier(r: SourceRow): Tier {
  const text = `${r.brand ?? ''} ${r.name}`;
  if (PREMIUM.test(text) && !/organic/i.test(text)) return 'premium';
  if (VALUE.test(text)) return 'value';
  if (OWN.test(text)) return 'own';
  return r.brand ? 'brand' : 'generic';
}

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

/** How alike two pack sizes are, 0..1 (1 = identical), or null if they can't be compared. */
const sizeLike = (a: number | null, b: number | null) => (a && b ? Math.min(a, b) / Math.max(a, b) : null);

/** Scores one source row as a stand-in for the Morrisons product behind an ingredient. */
export function scoreRow(i: IngredientDef, r: SourceRow): Suggestion {
  const reasons: string[] = [], warnings: string[] = [];
  const want = tokens(i.display ?? i.name), have = new Set(tokens(`${r.name} ${r.brand ?? ''}`));
  let score = 0;

  // Name: how much of what the ingredient is appears in the candidate (most weight), and how little else it is.
  const hit = want.filter((w) => have.has(w)).length;
  const recall = want.length ? hit / want.length : 0;
  const precision = have.size ? hit / have.size : 0;
  score += recall * 38 + precision * 10;
  if (recall >= 0.99) reasons.push('name matches'); else if (recall >= 0.6) reasons.push(`name partly matches (${hit}/${want.length} words)`); else warnings.push('name is a weak match');
  const extra = [...have].filter((w) => MODIFIERS.has(w) && !want.includes(w));
  if (extra.length) { score -= 12 * Math.min(2, extra.length); warnings.push(`also says "${extra.join(', ')}"`); }

  // Brand tier: own-brand equivalent of the Morrisons line, or the same named brand.
  const me = ingredientTier(i), they = rowTier(r);
  if (me.tier === 'brand') {
    const same = `${r.brand ?? ''} ${r.name}`.toLowerCase().includes(me.brand!);
    score += same ? 14 : -30;
    (same ? reasons : warnings).push(same ? `same brand (${me.brand})` : `not the ${me.brand} brand`);
  } else if (me.tier === 'generic') {
    if (they === 'premium') { score -= 10; warnings.push('premium line'); } else score += 8;
  } else if (they === me.tier) { score += 15; reasons.push(me.tier === 'value' ? 'value-line equivalent' : 'own-brand equivalent'); }
  else if (they === 'premium') { score -= 18; warnings.push('premium line, dearer tier than ours'); }
  else if ((me.tier === 'value' && they === 'own') || (me.tier === 'own' && they === 'value')) { score += 7; reasons.push('own-brand, a tier apart'); }
  else if (they === 'brand') { score -= 6; warnings.push('named brand, not an own-brand line'); }
  else score += 3;

  // Pack size, in the ingredient's own unit.
  const pack = packInUnit(parsePack(r.packSize ?? r.name), i.unit, i.gramsPerUnit);
  const ours = i.product?.pack_size ?? null;
  const like = sizeLike(pack, ours);
  if (like == null) { warnings.push('pack size unclear'); score += 2; }
  else {
    score += like * 22;
    if (like >= 0.99) reasons.push('same pack size');
    else if (like >= 0.6) reasons.push(`pack ${pack} vs ${ours}`);
    else warnings.push(`pack ${pack} vs ours ${ours}`);
  }

  // Price sanity: per unit of the ingredient, should be in the same region as Morrisons. Far off usually means a different product.
  if (pack && ours && i.product && i.product.price_pence > 0) {
    const mine = i.product.price_pence / ours, theirs = r.price / pack, ratio = theirs / mine;
    if (ratio > 0.6 && ratio < 1.6) { score += 15; reasons.push(`unit price ${Math.round(ratio * 100)}% of Morrisons`); }
    else { score -= 12; warnings.push(`unit price ${Math.round(ratio * 100)}% of Morrisons`); }
  }

  if (r.inStock === false) { score -= 10; warnings.push('out of stock'); }
  if (!(r.price > 0)) { score -= 40; warnings.push('no price'); }

  // The name gates the rest: a product that isn't the right thing can't be rescued by the right pack size, tier and price.
  const gate = recall >= 0.85 ? 1 : recall >= 0.5 ? 0.6 : 0.3;
  score = clamp(Math.round(score * gate), 0, 100);
  return { row: r, score, nameMatch: recall, confidence: 'low', packInUnit: pack, reasons, warnings };
}

/** The best candidates for an ingredient, best first. "high" means a clear lead over the next one. */
export function suggest(i: IngredientDef, rows: SourceRow[], limit = 6): Suggestion[] {
  const out = rows.map((r) => scoreRow(i, r)).sort((a, b) => b.score - a.score || a.row.price - b.row.price).slice(0, limit);
  out.forEach((s, k) => {
    const lead = s.score - (out[k + 1]?.score ?? 0);
    // High needs every name word, a strong score and a clear lead; medium at least most of the name.
    s.confidence = s.nameMatch >= 0.99 && s.score >= 72 && k === 0 && lead >= 6 ? 'high' : s.nameMatch >= 0.6 && s.score >= 45 ? 'medium' : 'low';
  });
  return out;
}
