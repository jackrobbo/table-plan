import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Product, Recipe } from '@/data';
import { applySnapshot, parseSnapshot, shapeSnapshot, type PriceSnapshot, type PriceTarget } from '@/lib/pricing/snapshot';

const product = (o: Partial<Product> = {}): Product => ({ n: 'X', pr: 100, pack: 500, u: 'g', s: 'x/1', ...o });
const recipe = (o: Partial<Recipe> = {}): Recipe => ({ id: 'r1', c: 'dinner', e: '', n: 'R', p: 30, k: 500, serves: 2, fresh: [], cup: [], m: [], allergens: [], cost: 200, b: 'medium', ...o } as Recipe);
const target = (): PriceTarget => ({
  products: { a: product(), b: product({ pr: 200, pack: 1 }), c: product({ pr: 300 }) },
  recipes: [recipe(), recipe({ id: 'macro', macros_only: true, cost: null, b: null })],
  meta: { checkedAt: '2026-10-25T00:00:00Z', oldestCheckAt: '2026-10-25T00:00:00Z', unavailable: [], heldForReview: [] },
});
const snap = (o: Partial<PriceSnapshot> = {}): PriceSnapshot => ({ store: 'morrisons', asOf: '2026-11-07T14:00:00Z', products: { a: [110, null, true, 500] }, costs: { r1: [180, 'low'] }, ...o });

describe('price snapshot: reading one from the network', () => {
  it('accepts a good snapshot and drops bad entries', () => {
    const s = parseSnapshot({ store: 'morrisons', asOf: '2026-11-07T14:00:00Z', products: { a: [110, 130, true, 500], bad: [0, null, true, 1], worse: 'x' }, costs: { r1: [180, 'low'], r2: [-5, 'low'], r3: [90, 'weird'] } })!;
    expect(Object.keys(s.products)).toEqual(['a']); expect(s.products.a).toEqual([110, 130, true, 500]);
    expect(s.costs.r1).toEqual([180, 'low']); expect(s.costs.r3).toEqual([90, null]); expect(s.costs.r2).toBeUndefined();
  });
  it('rejects anything that is not a snapshot', () => {
    for (const x of [null, 'x', {}, { store: 'm' }, { store: 'm', asOf: 'not a date', products: {}, costs: {} }, { store: 'm', asOf: '2026-11-07', products: null, costs: {} }]) expect(parseSnapshot(x)).toBeNull();
  });
});

describe('price snapshot: laying it over the bundled prices', () => {
  let t: PriceTarget;
  beforeEach(() => { t = target(); });
  it('updates the price, the meal cost and tier, and the freshness date', () => {
    const r = applySnapshot(snap(), t);
    expect(t.products.a.pr).toBe(110); expect(t.recipes[0].cost).toBe(180); expect(t.recipes[0].b).toBe('low');
    expect(t.meta.checkedAt).toBe('2026-11-07T14:00:00Z'); expect(r).toMatchObject({ prices: 1, costs: 1, outOfStock: 0 });
  });
  it('flags out-of-stock items for the warning, and clears the flag when they return', () => {
    applySnapshot(snap({ products: { a: [100, null, false, 500] } }), t);
    expect(t.products.a.st).toBe('out_of_stock'); expect(t.meta.unavailable).toEqual(['a']);
    applySnapshot(snap({ asOf: '2026-11-08T00:00:00Z', products: { a: [100, null, true, 500] } }), t);
    expect(t.products.a.st).toBeUndefined(); expect(t.meta.unavailable).toEqual([]);
  });
  it('ignores a price that moved over 50% and a product whose pack size differs', () => {
    const r = applySnapshot(snap({ products: { a: [500, null, true, 500], b: [210, null, true, 99], c: [320, null, true, null] } }), t);
    expect(t.products.a.pr).toBe(100); expect(t.products.b.pr).toBe(200); expect(t.products.c.pr).toBe(320);
    expect(r.skipped).toEqual(['a: moved over 50%', 'b: pack size differs']);
  });
  it('ignores a snapshot older than the bundled prices', () => {
    const r = applySnapshot(snap({ asOf: '2026-10-01T00:00:00Z' }), t);
    expect(r.ignored).toBe('older'); expect(t.products.a.pr).toBe(100); expect(t.meta.checkedAt).toBe('2026-10-25T00:00:00Z');
  });
  it('never costs a macros-only meal and skips products or recipes it does not know', () => {
    applySnapshot(snap({ products: { nope: [100, null, true, null] }, costs: { macro: [50, 'low'], ghost: [50, 'low'] } }), t);
    expect(t.recipes[1].cost).toBeNull();
  });
});

describe('price snapshot: shaping database rows', () => {
  const rows = {
    store: 'morrisons',
    products: [{ ingredient_slug: 'a', product_ref: '1', pack_size: '500' }, { ingredient_slug: 'b', product_ref: '2', pack_size: null }, { ingredient_slug: 'z', product_ref: '9', pack_size: 100 }],
    prices: [{ product_ref: '1', price_pence: 110, was_price_pence: 130, in_stock: true, priced_at: '2026-11-07T14:19:50Z' }, { product_ref: '2', price_pence: 200, was_price_pence: null, in_stock: null, priced_at: '2026-11-07T14:22:31Z' }],
    costs: [{ recipe_slug: 'r1', cost_pence: 180, budget_tier: 'low', complete: true }, { recipe_slug: 'r2', cost_pence: null, budget_tier: null, complete: false }],
  };
  it('joins products to prices, takes the newest price time and keeps only complete costs', () => {
    const s = shapeSnapshot(rows)!;
    expect(s.products).toEqual({ a: [110, 130, true, 500], b: [200, null, null, null] });
    expect(s.asOf).toBe('2026-11-07T14:22:31.000Z'); expect(s.costs).toEqual({ r1: [180, 'low'] });
  });
  it('is null when nothing is priced', () => {
    expect(shapeSnapshot({ ...rows, prices: [] })).toBeNull();
  });
});

vi.mock('@/lib/server/context', () => ({ getServerUser: vi.fn(), getPriceStore: vi.fn() }));
vi.mock('@/lib/server/guard', () => ({ rateLimited: vi.fn(async () => false) }));
import * as ctx from '@/lib/server/context';
import { GET } from '@/app/api/prices/route';

describe('/api/prices', () => {
  const call = (qs = '') => GET(new Request(`https://example.test/api/prices${qs}`));
  it('needs a signed-in person', async () => {
    vi.mocked(ctx.getServerUser).mockResolvedValue(null);
    expect((await call()).status).toBe(401);
  });
  it('rejects an unknown store', async () => {
    vi.mocked(ctx.getServerUser).mockResolvedValue({ id: 'u', email: 'a@b.c' });
    expect((await call('?store=narnia')).status).toBe(400);
  });
  it('says nothing is available when the database is not configured, or has no run yet, or errors', async () => {
    vi.mocked(ctx.getServerUser).mockResolvedValue({ id: 'u', email: 'a@b.c' });
    vi.mocked(ctx.getPriceStore).mockReturnValue(null);
    expect(await (await call()).json()).toEqual({ available: false });
    vi.mocked(ctx.getPriceStore).mockReturnValue({ snapshot: async () => null });
    expect(await (await call()).json()).toEqual({ available: false });
    vi.mocked(ctx.getPriceStore).mockReturnValue({ snapshot: async () => { throw new Error('db down'); } });
    const r = await call();
    expect(r.status).toBe(200); expect(await r.json()).toEqual({ available: false });
  });
  it('returns the snapshot privately cached', async () => {
    vi.mocked(ctx.getServerUser).mockResolvedValue({ id: 'u', email: 'a@b.c' });
    const s = snap();
    vi.mocked(ctx.getPriceStore).mockReturnValue({ snapshot: async (store) => ({ ...s, store }) });
    const r = await call('?store=morrisons');
    expect(r.headers.get('cache-control')).toMatch(/^private/); expect(await r.json()).toEqual(s);
  });
});
