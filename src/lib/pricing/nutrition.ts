/** Pack-label nutrition read from a Morrisons product page's "Nutritional Data" table. Per 100 g (or ml) as sold. */
export interface LabelNutrition {
  kcal: number; protein_g: number; carbs_g: number; fat_g: number;
  /** What the first per-100 column was headed, e.g. "(as sold) per 100g". */
  basis: string;
}

const text = (s: string) => s.replace(/<[^>]*>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
/** "5g" → 5, "nil"/"trace" → 0, "<0.1g" → 0 (we never invent precision the label doesn't give). */
const grams = (s: string): number | null => {
  const t = s.toLowerCase();
  if (/^(nil|trace|-|0)\b/.test(t) || t.startsWith('<')) return 0;
  const m = t.match(/(\d+(?:\.\d+)?)\s*g/);
  return m ? Number(m[1]) : null;
};

export function parseNutritionTable(html: string): LabelNutrition | null {
  const table = html.match(/<table[^>]*class="nutrition"[^>]*>([\s\S]*?)<\/table>/i)?.[1];
  if (!table) return null;
  const rows = [...table.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)].map((r) => [...r[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((c) => text(c[1])));
  const head = rows.find((r) => r.some((c) => /^typical|^per|per 100/i.test(c)));
  if (!head) return null;
  // First column that is a per-100 g/ml amount (labels may also have per-portion and "as prepared" columns).
  const col = head.findIndex((c, i) => i > 0 && /per\s*100\s*(g|ml)/i.test(c));
  if (col < 0) return null;

  let kcal: number | null = null, protein: number | null = null, carbs: number | null = null, fat: number | null = null;
  for (const r of rows) {
    const label = r[0]?.toLowerCase() ?? '';
    const cell = r[col] ?? '';
    // kcal sits either in the energy cell ("753kJ/179kcal") or on the next row with an empty label ("367kcal").
    const k = cell.match(/(\d+(?:\.\d+)?)\s*kcal/i);
    if (k && (label === 'energy' || label === '') && kcal == null) kcal = Number(k[1]);
    if (label === 'fat') fat = grams(cell);
    else if (label === 'carbohydrate' || label === 'carbohydrates') carbs = grams(cell);
    else if (label === 'protein') protein = grams(cell);
  }
  if (kcal == null || protein == null || carbs == null || fat == null) return null;
  return { kcal, protein_g: protein, carbs_g: carbs, fat_g: fat, basis: head[col] };
}

/** The 14 UK allergens, matched against the bold terms in a label's ingredients list (allergens are bold by law). */
const LEXICON: [string, RegExp][] = [
  ['gluten', /wheat|barley|rye|oat|spelt|kamut|gluten|malt/i],
  ['milk', /milk|cream|butter|cheese|whey|lactose|yoghurt|yogurt|casein|buttermilk/i],
  ['eggs', /\begg/i],
  ['soya', /soy/i],
  ['celery', /celery/i],
  ['mustard', /mustard/i],
  ['sesame', /sesame/i],
  ['peanuts', /peanut|groundnut/i],
  ['nuts', /almond|hazelnut|walnut|cashew|pecan|pistachio|brazil|macadamia|\bnuts?\b/i],
  ['fish', /\bfish|cod\b|salmon|tuna|anchov|haddock|pollock|mackerel|sardine/i],
  ['crustaceans', /crustacean|prawn|shrimp|crab|lobster/i],
  ['molluscs', /mollusc|mussel|oyster|squid|clam|scallop/i],
  ['lupin', /lupin/i],
  ['sulphites', /sulphite|sulphur dioxide|sulfite|metabisulphite/i],
];

/** Allergens declared in bold in the product's ingredients list. null = the page has no ingredients list (e.g. loose produce). */
export function parseDeclaredAllergens(html: string): string[] | null {
  const h = html.indexOf('Ingredients (ingredients and allergens may be subject');
  if (h < 0) return null;
  const start = html.indexOf('</h2>', h);
  const end = html.indexOf('</div>', start);
  if (start < 0 || end < 0) return null;
  const block = html.slice(start, end);
  const bold = [...block.matchAll(/<(?:b|strong)>([\s\S]*?)<\/(?:b|strong)>/gi)].map((m) => text(m[1]));
  const found = new Set<string>();
  for (const term of bold) for (const [key, re] of LEXICON) if (re.test(term)) found.add(key);
  return [...found].sort();
}
