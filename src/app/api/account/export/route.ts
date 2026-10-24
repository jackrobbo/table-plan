import { exportAccount } from '@/lib/server/account';
import { getAccountStore, getServerUser } from '@/lib/server/context';

/** Everything we hold about the signed-in person, as a JSON download. */
export async function GET(req: Request) {
  const r = await exportAccount({ user: await getServerUser(req), store: getAccountStore() });
  return Response.json(r.body, {
    status: r.status,
    headers: { 'Cache-Control': 'no-store', ...(r.status === 200 ? { 'Content-Disposition': 'attachment; filename="table-plan-data.json"' } : {}) },
  });
}
