import { deleteAccount } from '@/lib/server/account';
import { rateLimited } from '@/lib/server/guard';
import { tooMany } from '@/lib/server/rateLimit';
import { getAccountStore, getServerUser } from '@/lib/server/context';

/** Deletes the signed-in person's account, subscription and data. The caller proves who they are with their access token. */
export async function DELETE(req: Request) {
  if (await rateLimited(req, 'account', 5)) return tooMany();
  const r = await deleteAccount({ user: await getServerUser(req), store: getAccountStore(), env: process.env });
  return Response.json(r.body, { status: r.status, headers: { 'Cache-Control': 'no-store' } });
}
