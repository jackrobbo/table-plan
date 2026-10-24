// npm run prices:refresh [-- --dry] — polite nightly price check of mapped Morrisons products.
import fs from 'node:fs';
import type { IngredientDef } from '../src/lib/content/types';
import { checkProduct, skuFromUrl, type FetchResult, type PriceCache } from '../src/lib/pricing/refresh';

const UA = 'TablePlanPriceCheck/0.1 (+https://table-plan-app.vercel.app; contact jack@betmate.app)';
const DELAY_MS = 2000;
const BASE = 'https://groceries.morrisons.com/products/';
const dry = process.argv.includes('--dry');

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const fetcher = async (url: string): Promise<FetchResult> => {
  const r = await fetch(url, { headers: { 'user-agent': UA, accept: 'text/html' }, redirect: 'follow', signal: AbortSignal.timeout(20000) });
  return { status: r.status, url: r.url, body: r.status === 200 ? await r.text() : '' };
};

const ingredients = JSON.parse(fs.readFileSync('content/ingredients.json', 'utf8')) as IngredientDef[];
const cachePath = 'content/prices.json';
const cache: PriceCache = fs.existsSync(cachePath) ? JSON.parse(fs.readFileSync(cachePath, 'utf8')) : {};
const now = new Date();
const next: PriceCache = { ...cache };
const problems: string[] = [];

async function main() {
  const targets = ingredients.filter((i) => i.product);
  for (const [n, i] of targets.entries()) {
    const url = BASE + i.product!.slug;
    const e = await checkProduct({ slug: i.slug, url, expectedSku: skuFromUrl(i.product!.slug), knownPence: i.product!.price_pence }, cache[i.slug], fetcher, now);
    next[i.slug] = e;
    const moved = e.price_pence !== (cache[i.slug]?.price_pence ?? i.product!.price_pence);
    if (e.status !== 'ok') problems.push(`${i.slug}: ${e.status} — ${e.note}`);
    console.log(`[${n + 1}/${targets.length}] ${i.slug.padEnd(10)} ${e.status.padEnd(12)} ${(e.price_pence / 100).toFixed(2)}${moved ? ' (changed)' : ''}${e.note ? ' · ' + e.note : ''}`);
    if (n < targets.length - 1) await sleep(DELAY_MS);
  }

  const ok = Object.values(next).filter((e) => e.status === 'ok').length;
  console.log(`\n${ok}/${targets.length} ok, ${problems.length} need attention`);
  problems.forEach((p) => console.log('  ! ' + p));
  if (!dry) fs.writeFileSync(cachePath, JSON.stringify(next, null, 1) + '\n');
  // Fail the run (so the nightly job goes red) if most of the catalogue could not be checked at all.
  if (ok < targets.length * 0.5) { console.error('Fewer than half of products checked ok — aborting without trusting results.'); process.exit(1); }

}
main().catch((e) => { console.error(e); process.exit(1); });
