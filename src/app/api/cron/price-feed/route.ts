import { timingSafeEqual } from 'node:crypto';
import costing from '@/data/costing.json';
import type { CostingData } from '@/lib/pricing/costing';
import type { FeedStore } from '@/lib/pricing/feed';
import { getFeedDb } from '@/lib/server/context';
import { startFeed } from '@/lib/server/feed';

const same = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

/**
 * Starts the weekly price run (Vercel cron, Monday early; see vercel.json). Vercel calls this with `Authorization: Bearer $CRON_SECRET`.
 * It only starts the work and returns: Apify calls /api/feed/ingest when its run finishes. `?store=morrisons` runs a single store.
 * Needs these environment variables in Vercel: CRON_SECRET, FEED_SECRET, APIFY_TOKEN (and the Supabase ones the app already has).
 */
export async function GET(req: Request) {
  const cron = process.env.CRON_SECRET, got = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? '';
  if (!cron || !same(got, cron)) return Response.json({ error: 'Not allowed.' }, { status: 401, headers: { 'Cache-Control': 'no-store' } });
  const missing = ['FEED_SECRET', 'APIFY_TOKEN'].filter((k) => !process.env[k]);
  const db = getFeedDb();
  if (missing.length || !db) return Response.json({ error: 'Not configured.', missing: [...missing, ...(db ? [] : ['SUPABASE_SERVICE_ROLE_KEY'])] }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  const asked = new URL(req.url).searchParams.get('store');
  const stores = (asked ? [asked] : ['morrisons', 'tesco']).filter((s): s is FeedStore => ['morrisons', 'tesco', 'sainsburys', 'asda'].includes(s));
  const started = await startFeed({ db, env: process.env, costing: costing as unknown as CostingData }, stores);
  return Response.json({ started }, { headers: { 'Cache-Control': 'no-store' } });
}
