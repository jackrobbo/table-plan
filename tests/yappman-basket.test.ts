import { describe, expect, it } from 'vitest';
import type { IngredientDef } from '../src/lib/content/types';
import { buildItems, packText, toRows } from '../scripts/yappman-basket';

const ing = (o: Partial<IngredientDef>) => ({ slug: 'x', name: 'Morrisons X', unit: 'g', cupboard: false, allergens: [], ...o }) as IngredientDef;

describe('yappman basket helpers', () => {
  it('writes pack sizes the way shops do', () => {
    expect(packText(1000, 'g')).toBe('1kg');
    expect(packText(250, 'g')).toBe('250g');
    expect(packText(2272, 'ml')).toBe('2272ml');
    expect(packText(1500, 'ml')).toBe('1.5L');
    expect(packText(6, 'egg')).toBeUndefined();
  });

  it('sends only bought products, in file order, with a neutral name', () => {
    const { items, slugs } = buildItems([
      ing({ slug: 'breast', display: 'British Chicken Breast Fillets', product: { retailer: 'morrisons', name: 'n', price_pence: 699, pack_size: 1000, slug: 'a/1' } }),
      ing({ slug: 'oil', cupboard: true }),
      ing({ slug: 'eggs', unit: 'egg', product: { retailer: 'morrisons', name: 'n', price_pence: 200, pack_size: 6, slug: 'b/2' } }),
    ]);
    expect(slugs).toEqual(['breast', 'eggs']);
    expect(items).toEqual([{ name: 'British Chicken Breast Fillets', packSize: '1kg' }, { name: 'Morrisons X' }]);
  });

  it('turns the answer into one row per matched line and skips unmatched or unpriced ones', () => {
    const rows = toRows({ retailers: [
      { retailer: 'tesco', lines: [{ index: 0, matched: { retailerProductId: '1', name: 'A', price: 7, ean: ['5'] } }, { index: 1, matched: { retailerProductId: '2', name: 'B', price: 0 } }], unmatched: [] },
      { retailer: 'aldi', lines: [{ index: 0, matched: { retailerProductId: '3', name: 'C', price: 1 } }] },
    ] }, ['breast', 'eggs']);
    expect(rows.tesco).toHaveLength(1);
    expect(rows.tesco[0]).toMatchObject({ retailerProductId: '1', price: 7, ean: '5', askedFor: 'breast' });
    expect(rows.sainsburys).toHaveLength(0);
  });
});

import { buildRetryItems, simplifyName } from '../scripts/yappman-basket';
describe('second pass', () => {
  it('uses plain names', () => {
    expect(simplifyName('British Carrots')).toBe('carrots');
    expect(simplifyName('Straight Cut Chips (Frozen)')).toBe('straight cut chips frozen');
    expect(simplifyName('Fresh Red Chillies')).toBe('red chillies');
  });
  it('asks for staples and anything a store missed, but not what all three already matched', () => {
    const mk = (o: Partial<IngredientDef>) => ({ slug: 'x', name: 'N', unit: 'g', cupboard: false, allergens: [], ...o }) as IngredientDef;
    const prod = { retailer: 'morrisons', name: 'n', price_pence: 1, pack_size: 1, slug: 'a/1' };
    const all = new Set(['done', 'part']);
    const { slugs } = buildRetryItems(
      [mk({ slug: 'done', product: prod }), mk({ slug: 'part', product: prod }), mk({ slug: 'oil', cupboard: true }), mk({ slug: 'new', product: prod })],
      { tesco: all, sainsburys: new Set(['done']), asda: all });
    expect(slugs).toEqual(['part', 'oil', 'new']);
  });
});
