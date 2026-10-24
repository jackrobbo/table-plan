import { exportAccount } from '@/lib/server/account';
import { rateLimited } from '@/lib/server/guard';
import { tooMany } from '@/lib/server/rateLimit';
import { getAccountStore, getServerUser } from '@/lib/server/context';

/** Everything we hold about the signed-in person, as a JSON download. */
export async function GET(req: Request) {
  if (await rateLimited(req, 'export', 5)) return tooMany();
  const r = await exportAccount({ user: await getServerUser(req), store: getAccountStore() });
  return Response.json(r.body, {
    status: r.status,
    headers: { 'Cache-Control': 'no-store', ...(r.status === 200 ? { 'Content-Disposition': 'attachment; filename="table-plan-data.json"' } : {}) },
  });
}
