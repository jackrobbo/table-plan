import { describe, expect, it } from 'vitest';
import { parseProductPage } from '@/lib/pricing/parse';
import { checkProduct, describeEstimate, skuFromUrl, staleness, type Fetcher, type Target } from '@/lib/pricing/refresh';

const page = (price: string, avail = 'InStock', sku = '108305383') => `<html><script type="application/ld+json">${JSON.stringify({
  '@type': 'Product', sku, name: 'Morrisons  British Carrots 500g', offers: { '@type': 'Offer', price, availability: `https://schema.org/${avail}` },
})}</script></html>`;
const T: Target = { slug: 'carrots', url: 'u', expectedSku: '108305383', knownPence: 44 };
const now = new Date('2026-10-26T05:00:00Z');
const f = (status: number, body = ''): Fetcher => async (url) => ({ status, url, body });

describe('parseProductPage', () => {
  it('reads price, sku and availability from JSON-LD', () => {
    expect(parseProductPage(page('0.44'))).toEqual({ sku: '108305383', name: 'Morrisons British Carrots 500g', pricePence: 44, availability: 'in_stock' });
    expect(parseProductPage(page('1.10', 'OutOfStock'))?.availability).toBe('out_of_stock');
  });
  it('returns null without product data', () => {
    expect(parseProductPage('<html>search results</html>')).toBeNull();
    expect(parseProductPage('<script type="application/ld+json">{bad</script>')).toBeNull();
  });
  it('avoids float rounding errors', () => { expect(parseProductPage(page('2.29'))?.pricePence).toBe(229); });
});

describe('checkProduct', () => {
  it('accepts a clean price and records the change', async () => {
    const e = await checkProduct(T, undefined, f(200, page('0.47')), now);
    expect(e).toMatchObject({ status: 'ok', price_pence: 47, last_ok_at: now.toISOString() });
  });
  it('flags 404s and pages that silently lose the product as delisted, keeping the old price', async () => {
    expect(await checkProduct(T, undefined, f(404), now)).toMatchObject({ status: 'delisted', price_pence: 44 });
    expect(await checkProduct(T, undefined, f(200, '<html>no results</html>'), now)).toMatchObject({ status: 'delisted', price_pence: 44 });
    expect(await checkProduct(T, undefined, f(200, page('0.44', 'InStock', '999')), now)).toMatchObject({ status: 'delisted' });
  });
  it('holds huge moves for review instead of trusting them', async () => {
    const e = await checkProduct(T, undefined, f(200, page('0.99')), now);
    expect(e).toMatchObject({ status: 'changed_big', price_pence: 44 });
  });
  it('treats outages as errors, not delistings, and survives fetch failures', async () => {
    expect((await checkProduct(T, undefined, f(503), now)).status).toBe('error');
    expect((await checkProduct(T, undefined, async () => { throw new Error('boom'); }, now)).status).toBe('error');
  });
  it('keeps last_ok_at from the previous check when a later one fails', async () => {
    const prev = { price_pence: 50, checked_at: 'x', last_ok_at: '2026-10-20T00:00:00Z', status: 'ok' as const };
    expect(await checkProduct(T, prev, f(404), now)).toMatchObject({ price_pence: 50, last_ok_at: prev.last_ok_at });
  });
  it('extracts the sku from a product url', () => { expect(skuFromUrl('morrisons-british-carrots-500g/108305383')).toBe('108305383'); });
});

describe('staleness + estimate copy', () => {
  it('grades by age', () => {
    expect(staleness('2026-10-26T01:00:00Z', now)).toBe('fresh');
    expect(staleness('2026-10-24T00:00:00Z', now)).toBe('aging');
    expect(staleness('2026-10-20T00:00:00Z', now)).toBe('stale');
    expect(staleness(null, now)).toBe('stale');
  });
  it('words the estimate honestly', () => {
    const d = describeEstimate(4210, '2026-10-26T02:30:00Z', now);
    expect(d.text).toBe('≈ £42.10 · estimated Morrisons prices, checked 26 Oct');
    expect(d.warning).toBeNull();
    expect(describeEstimate(4210, '2026-10-01T00:00:00Z', now).warning).toMatch(/out of date/);
  });
});
