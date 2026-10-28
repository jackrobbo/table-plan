import { describe, expect, it } from 'vitest';
import type { IngredientDef, RecipeDef } from '@/lib/content/types';
import { validateContent } from '@/lib/content/validate';
import { applyDecisions, neededIngredients } from '@/lib/matching/apply';
import { packInUnit, parsePack } from '@/lib/matching/pack';
import { ingredientTier, rowTier, scoreRow, suggest, tokens } from '@/lib/matching/score';
import { normaliseRows, parseCsv } from '@/lib/matching/sources';
import type { SourceRow } from '@/lib/matching/types';

// Every product below is INVENTED to exercise the matcher; none is real retailer data.
const ing = (over: Partial<IngredientDef> & { slug: string; name: string; unit: string }): IngredientDef => ({ cupboard: false, allergens: [], per100: null, product: null, ...over });
const breast = ing({ slug: 'breast', name: 'Morrisons British Chicken Breast Fillets 1kg', display: 'British Chicken Breast Fillets', unit: 'g', product: { retailer: 'morrisons', name: 'Morrisons British Chicken Breast Fillets 1kg', price_pence: 699, pack_size: 1000, slug: 'x/1' } });
const eggs = ing({ slug: 'eggs', name: 'Morrisons Medium Free Range Eggs 6 Pack', display: 'Medium Free Range Eggs', unit: 'eggs', gramsPerUnit: 50, product: { retailer: 'morrisons', name: 'Morrisons Medium Free Range Eggs 6 Pack', price_pence: 160, pack_size: 6, slug: 'x/2' } });
const mixpep = ing({ slug: 'mixpep', name: 'Morrisons Savers Mixed Peppers 3 Pack', display: 'Mixed Peppers', unit: 'peppers', gramsPerUnit: 150, product: { retailer: 'morrisons', name: 'Morrisons Savers Mixed Peppers 3 Pack', price_pence: 175, pack_size: 3, slug: 'x/3' } });
const banana = ing({ slug: 'banana', name: 'Fyffes Bananas 5 Pack', display: 'Bananas', unit: 'bananas', gramsPerUnit: 100, product: { retailer: 'morrisons', name: 'Fyffes Bananas 5 Pack', price_pence: 95, pack_size: 5, slug: 'x/4' } });
const row = (o: Partial<SourceRow> & { productId: string; name: string; price: number }): SourceRow => ({ store: 'tesco', inStock: true, ...o });

describe('pack sizes', () => {
  it('reads weights, volumes, counts and multipacks', () => {
    expect(parsePack('1kg')).toEqual({ grams: 1000 });
    expect(parsePack('1.2 kg')).toEqual({ grams: 1200 });
    expect(parsePack('500g')).toEqual({ grams: 500 });
    expect(parsePack('750ml')).toEqual({ ml: 750 });
    expect(parsePack('2L')).toEqual({ ml: 2000 });
    expect(parsePack('4 pint').ml).toBeCloseTo(2273.04, 0);
    expect(parsePack('6 pack')).toEqual({ count: 6 });
    expect(parsePack('6pk')).toEqual({ count: 6 });
    expect(parsePack('4 x 145g')).toEqual({ count: 4, grams: 580 });
    expect(parsePack('4×145g')).toEqual({ count: 4, grams: 580 });
    expect(parsePack('each')).toEqual({ count: 1 });
    expect(parsePack('')).toEqual({});
  });
  it('expresses a pack in the ingredient\'s own unit', () => {
    expect(packInUnit({ grams: 1000 }, 'g')).toBe(1000);
    expect(packInUnit({ ml: 500 }, 'ml')).toBe(500);
    expect(packInUnit({ count: 6 }, 'eggs')).toBe(6);
    expect(packInUnit({ grams: 450 }, 'peppers', 150)).toBe(3);   // by weight, counted via grams per unit
    expect(packInUnit({ grams: 500 }, 'g' )).toBe(500);
    expect(packInUnit({ count: 6 }, 'g')).toBeNull();            // a count can't become grams
  });
});

describe('names and tiers', () => {
  it('drops sizes, store brands and filler, and folds plurals', () => {
    expect(tokens('Morrisons Savers Mixed Peppers 3 Pack')).toEqual(['mixed', 'pepper']);
    expect(tokens('Tesco Everyday Value Mixed Peppers 3 Pack')).toEqual(['mixed', 'pepper']);
    expect(tokens('Tomatoes 400g')).toEqual(['tomato']);
  });
  it('tells value, own-brand, brand and premium apart', () => {
    expect(ingredientTier(mixpep).tier).toBe('value');
    expect(ingredientTier(breast).tier).toBe('own');
    expect(ingredientTier(banana)).toEqual({ tier: 'brand', brand: 'fyffes' });
    expect(rowTier(row({ productId: '1', name: 'Tesco Finest Chicken Breast', price: 1, brand: 'Tesco' }))).toBe('premium');
    expect(rowTier(row({ productId: '2', name: 'Tesco Everyday Value Peppers', price: 1 }))).toBe('value');
  });
});

describe('matching', () => {
  const rows = [
    row({ productId: '300000001', name: 'Tesco British Chicken Breast Fillets 1kg', brand: 'Tesco', packSize: '1kg', price: 710 }),
    row({ productId: '300000002', name: 'Tesco Finest British Chicken Breast Fillets 1kg', brand: 'Tesco Finest', packSize: '1kg', price: 1100 }),
    row({ productId: '300000003', name: 'Tesco Smoked Chicken Breast Slices 120g', brand: 'Tesco', packSize: '120g', price: 190 }),
    row({ productId: '300000004', name: 'Tesco British Chicken Breast Fillets 500g', brand: 'Tesco', packSize: '500g', price: 400 }),
    row({ productId: '300000005', name: 'Tesco Everyday Value Mixed Peppers 3 Pack', packSize: '3 pack', price: 160 }),
    row({ productId: '300000006', name: 'Tesco Medium Free Range Eggs 6 Pack', brand: 'Tesco', packSize: '6 pack', price: 165 }),
    row({ productId: '300000007', name: 'Fyffes Bananas 5 Pack', brand: 'Fyffes', packSize: '5 pack', price: 100 }),
    row({ productId: '300000008', name: 'Tesco Loose Bananas', packSize: 'each', price: 20 }),
  ];
  it('puts the same product at the same size first, and flags premium, smoked and odd sizes', () => {
    const s = suggest(breast, rows);
    expect(s[0].row.productId).toBe('300000001');
    expect(s[0].confidence).toBe('high');
    expect(s[0].reasons.join()).toMatch(/same pack size/);
    const premium = s.find((x) => x.row.productId === '300000002')!;
    expect(premium.score).toBeLessThan(s[0].score);
    expect(premium.warnings.join()).toMatch(/premium/);
    expect(s.find((x) => x.row.productId === '300000003')!.warnings.join()).toMatch(/smoked/);
    expect(s.find((x) => x.row.productId === '300000004')!.score).toBeLessThan(s[0].score);
  });
  it('matches a value line to a value line, and counts to counts', () => {
    expect(suggest(mixpep, rows)[0].row.productId).toBe('300000005');
    expect(suggest(eggs, rows)[0].row.productId).toBe('300000006');
  });
  it('insists on the same brand for a branded ingredient', () => {
    const s = suggest(banana, rows);
    expect(s[0].row.productId).toBe('300000007');
    expect(scoreRow(banana, rows[7]).score).toBeLessThan(s[0].score);
  });
  it('never rates the wrong product highly, however well pack, tier and price line up', () => {
    const thigh = ing({ slug: 'thigh', name: 'Morrisons British Boneless Chicken Thigh Fillets 1kg', display: 'British Boneless Chicken Thigh Fillets', unit: 'g', product: { retailer: 'morrisons', name: 'x', price_pence: 725, pack_size: 1000, slug: 'x/5' } });
    const lamb = ing({ slug: 'lambmince', name: 'Morrisons Lamb Mince 500g', display: 'Lamb Mince', unit: 'g', product: { retailer: 'morrisons', name: 'x', price_pence: 500, pack_size: 500, slug: 'x/6' } });
    const beefMince = row({ productId: '300000010', name: 'Tesco Lean Beef Steak Mince 5% Fat 500g', brand: 'Tesco', packSize: '500g', price: 390 });
    const s1 = suggest(thigh, rows)[0], s2 = suggest(lamb, [beefMince])[0];
    expect(s1.confidence).not.toBe('high');
    expect(s2.confidence).toBe('low');
    expect(s2.score).toBeLessThan(40);
    for (const i of [thigh, lamb, banana]) expect(suggest(i, [row({ productId: '300000011', name: 'Tesco Porridge Oats 1kg', brand: 'Tesco', packSize: '1kg', price: 120 })])[0].confidence).toBe('low');
  });
  it('is not fooled by a price far from Morrisons', () => {
    const odd = scoreRow(breast, row({ productId: '300000009', name: 'Tesco British Chicken Breast Fillets 1kg', brand: 'Tesco', packSize: '1kg', price: 4000 }));
    expect(odd.warnings.join()).toMatch(/unit price/);
    expect(odd.score).toBeLessThan(scoreRow(breast, rows[0]).score);
  });
});

describe('reading a source file', () => {
  it('normalises a Yappman-style row and uses the shelf price, not loyalty', () => {
    const out = normaliseRows([
      { retailer: 'tesco', retailerProductId: '123456789', name: 'Chicken', brand: 'Tesco', packSize: '1kg', price: 7.1, loyaltyPrice: 6.5, wasPrice: 8, unitPrice: '£0.71/100g', ean: '5000000000000', inStock: true, scrapedAt: '2026-10-28T05:30:00Z' },
      { retailer: 'asda', retailerProductId: '99', name: 'Other store', price: 1 },
      { retailer: 'tesco', retailerProductId: '5', name: 'No price' },
    ], { store: 'tesco', source: 'yappman' });
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ productId: '123456789', price: 710, brand: 'Tesco', packSize: '1kg', ean: '5000000000000', inStock: true, unitPence: 71 });
  });
  it('reads CSV with quotes, and a column map', () => {
    const csv = 'external_id,title,size,price_gbp\n"12345678","Tesco ""Special"" Eggs, 6 pack","6 pack","1.65"\n';
    const rows = normaliseRows(parseCsv(csv), { store: 'tesco', map: { productId: 'external_id' } });
    expect(rows).toEqual([expect.objectContaining({ productId: '12345678', name: 'Tesco "Special" Eggs, 6 pack', packSize: '6 pack', price: 165 })]);
  });
});

describe('applying decisions', () => {
  const recipe = (over: Partial<RecipeDef>): RecipeDef => ({ slug: 'r', name: 'R', course: 'dinner', serves: 2, status: 'live', ingredients: [{ ingredient: 'breast', qty: 500 }], cupboard: [], method: [], ...over });
  const good: SourceRow = row({ productId: '300000001', name: 'Tesco British Chicken Breast Fillets 1kg', packSize: '1kg', price: 710, scrapedAt: '2026-10-28T05:30:00Z' });
  it('writes products.<store> and a price entry, leaves Morrisons alone, and the result validates', () => {
    const r = applyDecisions([breast, eggs], 'tesco', { breast: { status: 'confirmed', row: good, decidedAt: 'x' } }, {});
    expect(r.problems).toEqual([]);
    const b = r.ingredients.find((i) => i.slug === 'breast')!;
    expect(b.products!.tesco).toEqual({ retailer: 'tesco', name: good.name, price_pence: 710, pack_size: 1000, slug: '300000001' });
    expect(b.product).toEqual(breast.product);
    expect(r.prices.breast).toMatchObject({ price_pence: 710, checked_at: '2026-10-28T05:30:00Z', status: 'ok' });
    expect(validateContent(r.ingredients, [recipe({})]).filter((i) => i.level === 'error' && i.where === 'ingredient breast')).toEqual([]);
    expect(breast.products).toBeUndefined();   // the input was not mutated
  });
  it('refuses a match it can\'t size or whose id is wrong, and removes a mapping when there is no equivalent', () => {
    const bad = applyDecisions([breast], 'tesco', { breast: { status: 'confirmed', row: { ...good, packSize: 'big', name: 'Chicken' }, decidedAt: 'x' } }, {});
    expect(bad.problems.join()).toMatch(/pack size/);
    const badId = applyDecisions([breast], 'tesco', { breast: { status: 'confirmed', row: { ...good, productId: 'abc' }, decidedAt: 'x' } }, {});
    expect(badId.problems.join()).toMatch(/doesn't look like/);
    const mapped = applyDecisions([breast], 'tesco', { breast: { status: 'confirmed', row: good, decidedAt: 'x' } }, {}).ingredients;
    const gone = applyDecisions(mapped, 'tesco', { breast: { status: 'no_equivalent', decidedAt: 'x' } }, {});
    expect(gone.removed).toEqual(['breast']);
    expect(gone.ingredients[0].products).toBeUndefined();
  });
  it('works out which ingredients live meals need priced', () => {
    const need = neededIngredients([recipe({}), recipe({ status: 'draft', ingredients: [{ ingredient: 'eggs', qty: 2 }] }), recipe({ cupboard: ['rice'] })]);
    expect([...need].sort()).toEqual(['breast', 'rice']);
  });
});
