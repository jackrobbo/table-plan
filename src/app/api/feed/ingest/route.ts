import { timingSafeEqual } from 'node:crypto';
import costing from '@/data/costing.json';
import type { CostingData } from '@/lib/pricing/costing';
import { getFeedDb } from '@/lib/server/context';
import { ingestFeed, type IngestBody } from '@/lib/server/feed';

const same = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

/**
 * Apify's webhook, called when a price run finishes. It proves itself with the `x-feed-secret` header, and the run id in the body
 * must be a run we created that is still open, so a stray or repeated call changes nothing.
 */
export async function POST(req: Request) {
  const secret = process.env.FEED_SECRET, got = req.headers.get('x-feed-secret') ?? '';
  if (!secret || !same(got, secret)) return Response.json({ error: 'Not allowed.' }, { status: 401, headers: { 'Cache-Control': 'no-store' } });
  const db = getFeedDb();
  if (!db) return Response.json({ error: 'Not configured.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  let body: IngestBody;
  try { body = (await req.json()) as IngestBody; } catch { return Response.json({ error: 'Bad request.' }, { status: 400, headers: { 'Cache-Control': 'no-store' } }); }
  try {
    const result = await ingestFeed({ db, env: process.env, costing: costing as unknown as CostingData }, body);
    return Response.json(result, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    return Response.json({ error: 'Could not store the run.', detail: String((e as Error).message).slice(0, 200) }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
  }
}
