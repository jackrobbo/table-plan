import { describe, expect, it, vi } from 'vitest';
import type { CostingData } from '@/lib/pricing/costing';
import { ingestFeed, startFeed, type FeedDb, type FeedDeps, type FeedTarget, type SavedRow } from '@/lib/server/feed';

const RUN = '0b9c7f3a-1d2e-4a5b-8c6d-7e8f9a0b1c2d';
const costing: CostingData = {
  ingredients: { a: { pack: 100, pr: 100, unit: 'g' } },
  recipes: { r1: { c: 'dinner', s: 2, l: [['a', 200]] } },
};
const targets = (n: number, last = 100): FeedTarget[] => Array.from({ length: n }, (_, i) => ({ slug: i === 0 ? 'a' : `s${i}`, ref: String(i + 1), url: `https://groceries.morrisons.com/products/p${i}/${i + 1}`, lastPricePence: last, lastPackText: null }));

function fakeDb(t: FeedTarget[], status = 'running') {
  const calls = { created: [] as unknown[], rows: [] as SavedRow[], finished: [] as unknown[], costs: [] as unknown[] };
  const db: FeedDb = {
    targets: async () => t,
    createRun: async (store, expected, notes) => { calls.created.push({ store, expected, notes }); return RUN; },
    getRun: async (id) => (id === RUN ? { id, status, stores: ['morrisons'] } : null),
    saveRows: async (_id, rows) => { calls.rows.push(...rows); },
    finishRun: async (_id, f) => { calls.finished.push(f); },
    currentPrices: async () => ({ a: 150 }),
    saveCosts: async (_s, _r, c) => { calls.costs.push(...c); },
  };
  return { db, calls };
}
const env = { APIFY_TOKEN: 'apify_api_SECRETSECRET', FEED_SECRET: 'whsec', FEED_SITE_URL: 'https://example.test/' };
const dep = (db: FeedDb, fetchImpl?: typeof fetch): FeedDeps => ({ db, env, costing, fetchImpl, now: () => new Date('2026-11-09T06:00:00Z') });
const items = (n: number, price = 1.1) => Array.from({ length: n }, (_, i) => ({ retailerProductId: String(i + 1), name: `P${i}`, price, inStock: true, packSize: '500g', scrapedAt: '2026-11-09T05:30:00Z' }));
const okFetch = (data: unknown) => vi.fn(async () => new Response(JSON.stringify(data), { status: 200 })) as unknown as typeof fetch;

describe('weekly price job: starting a run', () => {
  it('records a run and asks Apify for the exact product pages, with a webhook back to us', async () => {
    const { db, calls } = fakeDb(targets(3));
    const f = vi.fn(async () => new Response('{}', { status: 201 }));
    const r = await startFeed(dep(db, f as unknown as typeof fetch), ['morrisons']);
    expect(r).toEqual([{ store: 'morrisons', runId: RUN, started: true }]);
    expect(calls.created).toHaveLength(1);
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain('/acts/yappman~uk-supermarket-price-scraper/runs?webhooks=');
    const hook = JSON.parse(Buffer.from(decodeURIComponent(url.split('webhooks=')[1]), 'base64').toString())[0];
    expect(hook.requestUrl).toBe('https://example.test/api/feed/ingest');
    expect(hook.payloadTemplate).toContain(RUN);
    expect(JSON.parse(hook.headersTemplate)['x-feed-secret']).toBe('whsec');
    expect(JSON.parse(init.body as string)).toMatchObject({ mode: 'product', maxItems: 3 });
  });
  it('skips a store with nothing mapped, and closes the run as failed (token redacted) if Apify refuses', async () => {
    expect(await startFeed(dep(fakeDb([]).db), ['tesco'])).toEqual([{ store: 'tesco', started: false, reason: 'no products mapped for this store yet' }]);
    const { db, calls } = fakeDb(targets(2));
    const f = vi.fn(async () => new Response('bad apify_api_SECRETSECRET token', { status: 401 }));
    const r = await startFeed(dep(db, f as unknown as typeof fetch), ['morrisons']);
    expect(r[0].started).toBe(false);
    expect(JSON.stringify(calls.finished)).not.toContain('SECRETSECRET');
    expect(calls.finished[0]).toMatchObject({ status: 'failed' });
  });
});

describe('weekly price job: ingesting a finished run', () => {
  const body = { runId: RUN, store: 'morrisons', eventType: 'ACTOR.RUN.SUCCEEDED', datasetId: 'abc123' };
  it('stores the rows, recomputes meal costs from the new prices and closes the run ok', async () => {
    const { db, calls } = fakeDb(targets(5));
    const r = await ingestFeed(dep(db, okFetch(items(5))), body);
    expect(r).toMatchObject({ status: 'ok', rows: 5, held: 0, coverage: 1, costs: 1 });
    expect(calls.rows).toHaveLength(5); expect(calls.rows[0]).toMatchObject({ pricePence: 110, held: false });
    expect(calls.costs[0]).toMatchObject({ slug: 'r1', cost: 150 });   // 200 g of a 100 g pack at 150p, for 2 portions
    expect(calls.finished[0]).toMatchObject({ status: 'ok', rowsReceived: 5, rowsHeld: 0 });
  });
  it('holds a price that moved over 50% and closes the run partial', async () => {
    const { db, calls } = fakeDb(targets(5));
    const data = items(5); data[2] = { ...data[2], price: 3 };
    const r = await ingestFeed(dep(db, okFetch(data)), body);
    expect(r).toMatchObject({ status: 'partial', held: 1 });
    expect(calls.rows.filter((x) => x.held)).toHaveLength(1); expect(calls.rows.find((x) => x.held)?.holdReason).toMatch(/held for review/);
  });
  it('fails the run and serves nothing when too few products come back', async () => {
    const { db, calls } = fakeDb(targets(10));
    const r = await ingestFeed(dep(db, okFetch(items(5))), body);
    expect(r.status).toBe('failed'); expect(r.reason).toMatch(/50%/); expect(calls.rows).toHaveLength(0); expect(calls.costs).toHaveLength(0);
  });
  it('fails the run when Apify says it failed, or the dataset cannot be read', async () => {
    const a = fakeDb(targets(3));
    expect((await ingestFeed(dep(a.db), { ...body, eventType: 'ACTOR.RUN.FAILED' })).status).toBe('failed');
    const b = fakeDb(targets(3));
    const bad = vi.fn(async () => new Response('nope apify_api_SECRETSECRET', { status: 500 })) as unknown as typeof fetch;
    const r = await ingestFeed(dep(b.db, bad), body);
    expect(r.status).toBe('failed'); expect(JSON.stringify(b.calls.finished)).not.toContain('SECRETSECRET');
  });
  it('ignores unknown runs, finished runs, bad bodies and odd dataset ids', async () => {
    const { db } = fakeDb(targets(3));
    expect((await ingestFeed(dep(db), { ...body, runId: '11111111-1111-4111-8111-111111111111' })).status).toBe('ignored');
    expect((await ingestFeed(dep(db), { ...body, runId: 'not-a-uuid' })).status).toBe('ignored');
    expect((await ingestFeed(dep(db), { ...body, store: 'narnia' })).status).toBe('ignored');
    expect((await ingestFeed(dep(fakeDb(targets(3), 'ok').db), body)).status).toBe('ignored');
    const odd = fakeDb(targets(3));
    expect((await ingestFeed(dep(odd.db, okFetch(items(3))), { ...body, datasetId: '../../x' })).status).toBe('failed');
  });
});
