import { describe, expect, it } from 'vitest';
import { basketItems, basketUrl, MAX_PACKS } from '@/lib/basket';
import type { Shopping } from '@/lib/planner/shopping';

const line = (key: string, slug: string, packs: number, name = key) => ({ key, name, slug, packs, costPence: 100, needed: 1, bought: 1, unit: 'g', usedBy: [], category: 'Other' });
const shopping = (lines: ReturnType<typeof line>[]): Shopping => ({ lines, totalPence: 0, wastePence: 0, cupboard: [] });

describe('basket hand-off', () => {
  it('lists every line still to buy, with its pack count', () => {
    const s = shopping([line('oats', 'morrisons-porridge-oats/105489771', 2, 'Porridge oats'), line('milk', 'milk/111', 1)]);
    expect(basketItems(s, ['milk'])).toEqual([{ s: 'morrisons-porridge-oats/105489771', q: 2, n: 'Porridge oats' }]);
  });
  it('skips lines without a usable product page and clamps the quantity to what Morrisons allows', () => {
    const s = shopping([line('a', 'a-b/1', 99), line('b', '', 1), line('c', 'not a path', 1), line('d', '../x/1', 1)]);
    expect(basketItems(s)).toEqual([{ s: 'a-b/1', q: MAX_PACKS, n: 'a' }]);
  });
  it('builds a Morrisons product link carrying the list in the fragment, decodable by the extension', () => {
    const items = [{ s: 'morrisons-porridge-oats/105489771', q: 2, n: 'Porridge oats £1' }, { s: 'x-y/22', q: 1, n: 'Crème fraîche' }];
    const url = basketUrl(items)!;
    expect(url.startsWith('https://groceries.morrisons.com/products/morrisons-porridge-oats/105489771#tableplan=')).toBe(true);
    const frag = url.split('#tableplan=')[1];
    expect(frag).toMatch(/^[A-Za-z0-9_-]+$/);
    // the same decode the extension does
    const bin = atob(frag.replace(/-/g, '+').replace(/_/g, '/'));
    const d = JSON.parse(new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0))));
    expect(d).toEqual({ v: 1, items });
  });
  it('has nothing to hand over when everything is already in the cupboard', () => {
    expect(basketUrl([])).toBeNull();
  });
});

import { AISLES, byAisle } from '@/lib/planner/shopping';
describe('shopping list by aisle', () => {
  it('groups in shop order and puts the dearest first inside each aisle', () => {
    const mk = (key: string, category: string, costPence: number) => ({ ...line(key, `${key}/1`, 1), category, costPence });
    const g = byAisle([mk('a', 'Meat & fish', 300), mk('b', 'Fruit & veg', 100), mk('c', 'Meat & fish', 500), mk('d', 'Mystery', 50)]);
    expect(g.map((x) => x.aisle)).toEqual(['Fruit & veg', 'Meat & fish', 'Mystery']);
    expect(g[1].lines.map((l) => l.key)).toEqual(['c', 'a']);
  });
  it('every product in the catalogue has a real aisle', async () => {
    const { PRODUCTS } = await import('@/data');
    for (const [k, p] of Object.entries(PRODUCTS)) expect(AISLES, k).toContain(p.c);
  });
});
