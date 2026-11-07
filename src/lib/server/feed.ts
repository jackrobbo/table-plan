import { normaliseRow, validateRows, type FeedRow, type FeedStore, type Issue } from '../pricing/feed';
import { computeRecipeCosts, type CostingData, type RecipeCost } from '../pricing/costing';

/**
 * The weekly price job. Two steps, so nothing long-running sits on a serverless function:
 *   1. startFeed  (Vercel cron, Monday early): for each store, record a run, then ask Yappman (through Apify) to price the exact
 *      product pages we hold. Apify answers later by calling our webhook.
 *   2. ingestFeed (that webhook): fetch the finished dataset, check it, store the rows (rows that fail a check are stored as held and
 *      never served), recompute every meal's cost from the new prices, and close the run.
 * If a run fails or comes back too incomplete, nothing new is served: the app keeps the previous dated snapshot.
 * Everything here takes its database and network as arguments so it can be tested without either.
 */
export const ACTOR = 'yappman~uk-supermarket-price-scraper';
const MIN_COVERAGE = 0.8;

export interface FeedTarget { slug: string; ref: string; url: string; lastPricePence: number | null; lastPackText: string | null }
export interface SavedRow extends FeedRow { held: boolean; holdReason: string | null }
export type RunStatus = 'ok' | 'partial' | 'failed';

export interface FeedDb {
  /** The products we price at a store (from store_products), with the last price we served for each. */
  targets(store: FeedStore): Promise<FeedTarget[]>;
  createRun(store: FeedStore, expected: number, notes: string): Promise<string>;
  getRun(id: string): Promise<{ id: string; status: string; stores: string[] } | null>;
  saveRows(runId: string, rows: SavedRow[]): Promise<void>;
  finishRun(id: string, f: { status: RunStatus; rowsReceived: number; rowsHeld: number; notes: string }): Promise<void>;
  /** The current price of each ingredient's product at the store, as served (regular price when an offer is on), by ingredient slug. */
  currentPrices(store: FeedStore): Promise<Record<string, number>>;
  saveCosts(store: FeedStore, runId: string, costs: RecipeCost[]): Promise<void>;
}

export interface FeedDeps {
  db: FeedDb;
  env: Record<string, string | undefined>;
  costing: CostingData;
  fetchImpl?: typeof fetch;
  now?: () => Date;
}

const b64 = (s: string) => Buffer.from(s, 'utf8').toString('base64');
const redact = (s: string) => s.replace(/apify_api_[A-Za-z0-9]+/g, '***');

/** Step 1: start one Apify run per store. Returns what was started (or why not) per store. */
export async function startFeed(d: FeedDeps, stores: FeedStore[]): Promise<{ store: FeedStore; runId?: string; started: boolean; reason?: string }[]> {
  const f = d.fetchImpl ?? fetch;
  const site = (d.env.FEED_SITE_URL ?? 'https://table-plan.co.uk').replace(/\/+$/, '');
  const out: Awaited<ReturnType<typeof startFeed>> = [];
  for (const store of stores) {
    const targets = await d.db.targets(store);
    if (!targets.length) { out.push({ store, started: false, reason: 'no products mapped for this store yet' }); continue; }
    const runId = await d.db.createRun(store, targets.length, `started ${(d.now ?? (() => new Date()))().toISOString()}`);
    const hook = [{
      eventTypes: ['ACTOR.RUN.SUCCEEDED', 'ACTOR.RUN.FAILED', 'ACTOR.RUN.TIMED_OUT', 'ACTOR.RUN.ABORTED'],
      requestUrl: `${site}/api/feed/ingest`,
      payloadTemplate: `{"runId":"${runId}","store":"${store}","eventType":{{eventType}},"datasetId":{{resource.defaultDatasetId}}}`,
      headersTemplate: JSON.stringify({ 'x-feed-secret': d.env.FEED_SECRET }),
    }];
    try {
      const r = await f(`https://api.apify.com/v2/acts/${ACTOR}/runs?webhooks=${encodeURIComponent(b64(JSON.stringify(hook)))}`, {
        method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${d.env.APIFY_TOKEN}` },
        body: JSON.stringify({ mode: 'product', productUrls: targets.map((t) => t.url), maxItems: targets.length }),
      });
      if (!r.ok) throw new Error(`Apify said HTTP ${r.status} ${redact((await r.text()).slice(0, 160))}`);
      out.push({ store, runId, started: true });
    } catch (e) {
      await d.db.finishRun(runId, { status: 'failed', rowsReceived: 0, rowsHeld: 0, notes: redact(`could not start: ${(e as Error).message}`) });
      out.push({ store, runId, started: false, reason: redact((e as Error).message) });
    }
  }
  return out;
}

export interface IngestBody { runId?: string; store?: string; eventType?: string; datasetId?: string }
export interface IngestResult { status: 'ignored' | RunStatus; reason?: string; rows?: number; held?: number; coverage?: number; costs?: number }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STORES = new Set(['morrisons', 'tesco', 'sainsburys', 'asda']);

/** Step 2: take a finished Apify run's dataset, check it, store it, recompute costs and close the run. */
export async function ingestFeed(d: FeedDeps, body: IngestBody): Promise<IngestResult> {
  if (!body.runId || !UUID.test(body.runId) || !body.store || !STORES.has(body.store)) return { status: 'ignored', reason: 'bad request' };
  const store = body.store as FeedStore;
  const run = await d.db.getRun(body.runId);
  if (!run || run.status !== 'running') return { status: 'ignored', reason: 'unknown or already finished run' };
  const fail = async (notes: string): Promise<IngestResult> => { await d.db.finishRun(run.id, { status: 'failed', rowsReceived: 0, rowsHeld: 0, notes }); return { status: 'failed', reason: notes }; };

  if (body.eventType !== 'ACTOR.RUN.SUCCEEDED') return fail(`Apify run did not succeed: ${body.eventType ?? 'unknown event'}`);
  if (!body.datasetId || !/^[A-Za-z0-9]+$/.test(body.datasetId)) return fail('no dataset id');

  let raw: Record<string, unknown>[];
  try {
    const r = await (d.fetchImpl ?? fetch)(`https://api.apify.com/v2/datasets/${body.datasetId}/items?format=json&clean=true`, { headers: { authorization: `Bearer ${d.env.APIFY_TOKEN}` } });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    raw = (await r.json()) as Record<string, unknown>[];
    if (!Array.isArray(raw)) throw new Error('not a list');
  } catch (e) { return fail(redact(`could not read the dataset: ${(e as Error).message}`)); }

  const targets = await d.db.targets(store);
  const rows = raw.map((o) => normaliseRow(store, o)).filter((x): x is FeedRow => !!x);
  const v = validateRows(store, rows, targets.map((t) => ({ ref: t.ref, slug: t.slug, lastPricePence: t.lastPricePence, lastPackSize: t.lastPackText })), { now: d.now?.() });
  if (v.coverage < MIN_COVERAGE) return fail(`only ${(v.coverage * 100).toFixed(0)}% of products came back (need ${MIN_COVERAGE * 100}%); nothing served from this run`);

  const held = new Map<string, string>();
  for (const i of v.issues as Issue[]) if (i.level === 'error' && i.ref && /held for review/.test(i.text)) held.set(i.ref, i.text);
  await d.db.saveRows(run.id, rows.map((r) => ({ ...r, held: held.has(r.productRef), holdReason: held.get(r.productRef) ?? null })));

  // Recompute every meal's cost at this store from the prices now being served. Only Morrisons has the product sizes needed so far.
  let costs = 0;
  if (store === 'morrisons') {
    const price = await d.db.currentPrices(store);
    const c = computeRecipeCosts(d.costing, price);
    await d.db.saveCosts(store, run.id, c);
    costs = c.length;
  }
  const status: RunStatus = held.size || v.coverage < 1 ? 'partial' : 'ok';
  await d.db.finishRun(run.id, { status, rowsReceived: rows.length, rowsHeld: held.size, notes: `coverage ${(v.coverage * 100).toFixed(0)}%, ${v.issues.filter((i) => i.level === 'warn').length} warnings` });
  return { status, rows: rows.length, held: held.size, coverage: v.coverage, costs };
}
