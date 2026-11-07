import { isStoreId, DEFAULT_STORE } from '@/lib/stores';
import { rateLimited } from '@/lib/server/guard';
import { tooMany } from '@/lib/server/rateLimit';
import { getPriceStore, getServerUser } from '@/lib/server/context';

/**
 * The latest dated price book for the signed-in person's store: prices now, out-of-stock flags and the cost of each meal.
 * Signed-in people only (the vendor licence is for display to our own users, not bulk redistribution), rate limited, and it
 * returns just what the app needs. `{ available: false }` means no snapshot yet, and the app keeps using its bundled prices.
 */
export async function GET(req: Request) {
  if (await rateLimited(req, 'prices', 30)) return tooMany();
  const user = await getServerUser(req);
  if (!user) return Response.json({ error: 'Sign in first.' }, { status: 401, headers: { 'Cache-Control': 'no-store' } });
  const asked = new URL(req.url).searchParams.get('store') ?? DEFAULT_STORE;
  if (!isStoreId(asked)) return Response.json({ error: 'Unknown store.' }, { status: 400, headers: { 'Cache-Control': 'no-store' } });
  const store = getPriceStore();
  if (!store) return Response.json({ available: false }, { headers: { 'Cache-Control': 'no-store' } });
  try {
    const snap = await store.snapshot(asked);
    if (!snap) return Response.json({ available: false }, { headers: { 'Cache-Control': 'no-store' } });
    // Private (per person) and short: prices change weekly, but a fresh run should reach people within the hour.
    return Response.json(snap, { headers: { 'Cache-Control': 'private, max-age=600, stale-while-revalidate=3600' } });
  } catch {
    return Response.json({ available: false }, { status: 200, headers: { 'Cache-Control': 'no-store' } });
  }
}
