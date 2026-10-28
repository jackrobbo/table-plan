import type { Pack } from './types';

const num = (s: string) => parseFloat(s.replace(',', '.'));
const PINT_ML = 568.26;

/**
 * Reads a pack-size string as sold: "1kg", "500g", "1.2kg", "2L", "750ml", "4 pint", "6 pack", "6pk", "Pack of 6", "4 x 145g", "each".
 * A multipack gives both the count and the total weight or volume. Returns an empty object when nothing usable is found.
 */
export function parsePack(text: string | undefined | null): Pack {
  if (!text) return {};
  const t = text.toLowerCase().replace(/×/g, 'x').replace(/\s+/g, ' ').trim();

  // "4 x 145g", "4x145g", "6 x 20 g", "2 x 1l"
  const multi = t.match(/(\d+)\s*x\s*(\d+(?:[.,]\d+)?)\s*(kg|g|ml|cl|l)\b/);
  if (multi) {
    const n = Number(multi[1]), each = num(multi[2]), u = multi[3];
    const total = n * each;
    return u === 'kg' ? { count: n, grams: total * 1000 } : u === 'g' ? { count: n, grams: total }
      : u === 'l' ? { count: n, ml: total * 1000 } : u === 'cl' ? { count: n, ml: total * 10 } : { count: n, ml: total };
  }

  const out: Pack = {};
  const w = t.match(/(\d+(?:[.,]\d+)?)\s*(kg|g)\b/);
  if (w) out.grams = num(w[1]) * (w[2] === 'kg' ? 1000 : 1);
  const v = t.match(/(\d+(?:[.,]\d+)?)\s*(ml|cl|l|litres?|liters?)\b/);
  if (v) out.ml = num(v[1]) * (v[2] === 'ml' ? 1 : v[2] === 'cl' ? 10 : 1000);
  const pt = t.match(/(\d+(?:[.,]\d+)?)\s*pints?\b/);
  if (pt && out.ml == null) out.ml = num(pt[1]) * PINT_ML;

  const cnt = t.match(/(\d+)\s*(?:pack|pk|pieces?|pcs|count|ct)\b/) || t.match(/\bpack of (\d+)\b/) || t.match(/\bx\s*(\d+)\b/) || t.match(/\b(\d+)\s*x\b/);
  if (cnt) out.count = Number(cnt[1]);
  else if (/\beach\b|\bsingle\b|\bloose\b/.test(t) && out.grams == null && out.ml == null) out.count = 1;
  return out;
}

/**
 * The pack in the ingredient's own unit (what `pack_size` means for that ingredient): grams for "g", millilitres for "ml", and a count
 * for counted units (eggs, wraps, bananas), converting from weight with grams-per-unit when the pack is only given by weight.
 */
export function packInUnit(pack: Pack, unit: string, gramsPerUnit?: number): number | null {
  if (unit === 'g') return pack.grams ?? null;
  if (unit === 'ml') return pack.ml ?? null;
  if (pack.count != null) return pack.count;
  if (pack.grams != null && gramsPerUnit) return Math.round(pack.grams / gramsPerUnit);
  return null;
}
