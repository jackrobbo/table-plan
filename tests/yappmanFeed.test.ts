import { describe, expect, it } from 'vitest';
import { estimateCost, matchStability, morrisonsId, normaliseRow, otherStoreUrl, validateRows, type FeedRow } from '../scripts/yappman-feed';

const row = (o: Partial<FeedRow> = {}): FeedRow => ({ store: 'morrisons', productRef: '1', name: 'X', pricePence: 100, wasPricePence: null, loyaltyPricePence: null, promoText: null, inStock: true, packSize: '500g', url: null, pricedAt: '2026-11-03T02:00:00Z', ...o });
const now = new Date('2026-11-05T12:00:00Z');

describe('yappman feed: reading rows', () => {
  it('turns pounds into whole pence and keeps the retailer id', () => {
    const r = normaliseRow('tesco', { retailerProductId: 323658459, name: 'Chicken', price: 7, loyaltyPrice: 6.5, promotionText: 'Clubcard', inStock: true, packSize: '1kg', pricedAt: '2026-11-01T02:00:23Z' }, 'breast')!;
    expect(r.pricePence).toBe(700); expect(r.loyaltyPricePence).toBe(650); expect(r.productRef).toBe('323658459'); expect(r.askedFor).toBe('breast'); expect(r.promoText).toBe('Clubcard');
  });
  it('rounds awkward floats and rejects rows with no usable price or id', () => {
    expect(normaliseRow('asda', { retailerProductId: '9', price: 1.1 + 2.2 })!.pricePence).toBe(330);
    expect(normaliseRow('asda', { retailerProductId: '9', price: 0 })).toBeNull();
    expect(normaliseRow('asda', { price: 2 })).toBeNull();
    expect(normaliseRow('asda', { retailerProductId: '9', price: 'free' })).toBeNull();
  });
  it('finds the Morrisons id at the end of a product slug or url', () => {
    expect(morrisonsId('morrisons-red-pesto-190g/104557698')).toBe('104557698');
    expect(morrisonsId('https://groceries.morrisons.com/products/x/123/')).toBe('123');
    expect(normaliseRow('morrisons', { url: 'https://groceries.morrisons.com/products/x/123', price: 2 })!.productRef).toBe('123');
  });
});

describe('yappman feed: checks on a run', () => {
  const exp = [{ ref: '1', slug: 'a', lastPricePence: 100 }, { ref: '2', slug: 'b', lastPricePence: 200 }];
  it('reports full coverage and no issues for a clean run', () => {
    const v = validateRows('morrisons', [row({ productRef: '1' }), row({ productRef: '2', pricePence: 205 })], exp, { now });
    expect(v.coverage).toBe(1); expect(v.issues.filter((i) => i.level !== 'info')).toEqual([]);
  });
  it('flags a missing product as an error', () => {
    const v = validateRows('morrisons', [row({ productRef: '1' })], exp, { now });
    expect(v.coverage).toBe(0.5); expect(v.issues.find((i) => i.level === 'error')?.slug).toBe('b');
  });
  it('holds a price move over 50% and warns on one over 15%', () => {
    const v = validateRows('morrisons', [row({ productRef: '1', pricePence: 190 }), row({ productRef: '2', pricePence: 250 })], exp, { now });
    expect(v.issues.some((i) => i.level === 'error' && /held for review/.test(i.text))).toBe(true);
    expect(v.issues.some((i) => i.level === 'warn' && /price moved 25%/.test(i.text))).toBe(true);
  });
  it('flags out of stock, doubled rows, a changed pack size and old vendor prices', () => {
    const e = [{ ref: '1', slug: 'a', lastPricePence: 100, lastPackSize: '500g' }];
    const v = validateRows('morrisons', [row({ inStock: false, packSize: '400g', pricedAt: '2026-10-20T00:00:00Z' }), row()], e, { now });
    const t = v.issues.map((i) => i.text).join(' | ');
    expect(t).toMatch(/out of stock/); expect(t).toMatch(/2 rows for the same product/); expect(t).toMatch(/pack size changed/); expect(t).toMatch(/days old/);
  });
  it('notes extra rows and never counts them as matched', () => {
    const v = validateRows('morrisons', [row({ productRef: '1' }), row({ productRef: '99' })], [exp[0]], { now });
    expect(v.matched).toBe(1); expect(v.issues.some((i) => i.level === 'info')).toBe(true);
  });
  it('detects match drift for the basket stores', () => {
    const rows = [row({ store: 'tesco', productRef: '555', askedFor: 'breast', name: 'Other chicken' }), row({ store: 'tesco', productRef: '777', askedFor: 'milk' })];
    const d = matchStability('tesco', rows, { breast: '323658459', milk: '777' });
    expect(d).toHaveLength(1); expect(d[0].slug).toBe('breast');
  });
});

describe('yappman feed: which page we ask for', () => {
  it('builds Tesco pages from the id, and uses seen pages for the other stores', () => {
    expect(otherStoreUrl('tesco', '323658459')).toBe('https://www.tesco.com/shop/en-GB/products/323658459');
    expect(otherStoreUrl('sainsburys', '123456')).toBeNull();
    expect(otherStoreUrl('sainsburys', '123456', { '123456': 'https://example.test/p/123456' })).toBe('https://example.test/p/123456');
    expect(otherStoreUrl('tesco', 'not-an-id')).toBeNull();
  });
});

describe('yappman feed: cost guard', () => {
  it('matches the published rates', () => {
    expect(estimateCost({ morrisonsRows: 90, basketLines: 0, stores: 0 })).toBeCloseTo(0.005 + 90 * 0.0025, 6);
    expect(estimateCost({ morrisonsRows: 0, basketLines: 100, stores: 3 })).toBeCloseTo(0.6, 6);
    expect(estimateCost({ morrisonsRows: 0, basketLines: 0, stores: 0 })).toBe(0);
  });
});

import { morrisonsRecipeCosts, parsePack } from '../scripts/feed-to-sql';
import type { IngredientDef, RecipeDef } from '../src/lib/content/types';

describe('feed to sql: packs and recipe costs', () => {
  it('reads pack sizes in grams and millilitres', () => {
    expect(parsePack('1kg')).toEqual({ size: 1000, unit: 'g' });
    expect(parsePack('250G')).toEqual({ size: 250, unit: 'g' });
    expect(parsePack('1.5L')).toEqual({ size: 1500, unit: 'ml' });
    expect(parsePack('75cl')).toEqual({ size: 750, unit: 'ml' });
    expect(parsePack('6 pack')).toBeNull();
    expect(parsePack(null)).toBeNull();
  });
  it('prices a recipe from the run, and lists an ingredient with no price', () => {
    const mk = (slug: string, price: number | null): IngredientDef => ({ slug, name: slug, unit: 'g', cupboard: false, allergens: [], per100: { kcal: 100, protein_g: 10, carbs_g: 0, fat_g: 1 }, product: price == null ? null : { retailer: 'morrisons', name: slug, price_pence: price, pack_size: 100, slug: `${slug}/${slug === 'a' ? 111 : 222}` } });
    const ing = [mk('a', 100), mk('b', null)];
    const r = { slug: 'x', name: 'X', course: 'dinner', emoji: '', serves: 2, status: 'live', ingredients: [{ ingredient: 'a', qty: 200 }], cupboard: [], method: [] } as unknown as RecipeDef;
    const priced = morrisonsRecipeCosts(ing, [r], new Map([['111', 150]]));
    expect(priced[0].cost).toBe(150);          // 200 g of a 100 g / 150p product, for 2 portions
    expect(priced[0].missing).toEqual([]);
    const r2 = { ...r, slug: 'y', ingredients: [{ ingredient: 'a', qty: 100 }, { ingredient: 'b', qty: 50 }] } as unknown as RecipeDef;
    const incomplete = morrisonsRecipeCosts(ing, [r2], new Map([['111', 150]]));
    expect(incomplete[0].cost).toBeNull(); expect(incomplete[0].missing).toEqual(['b']);
  });
});
