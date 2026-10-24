import { exportAccount } from '@/lib/server/account';
import { clientIp, limited, tooMany } from '@/lib/server/rateLimit';
import { getAccountStore, getServerUser } from '@/lib/server/context';

/** Everything we hold about the signed-in person, as a JSON download. */
export async function GET(req: Request) {
  if (limited(`export:${clientIp(req)}`, 5, 60_000)) return tooMany();
  const r = await exportAccount({ user: await getServerUser(req), store: getAccountStore() });
  return Response.json(r.body, {
    status: r.status,
    headers: { 'Cache-Control': 'no-store', ...(r.status === 200 ? { 'Content-Disposition': 'attachment; filename="table-plan-data.json"' } : {}) },
  });
}
