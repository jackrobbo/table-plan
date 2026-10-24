import { deleteAccount } from '@/lib/server/account';
import { getAccountStore, getServerUser } from '@/lib/server/context';

/** Deletes the signed-in person's account, subscription and data. The caller proves who they are with their access token. */
export async function DELETE(req: Request) {
  const r = await deleteAccount({ user: await getServerUser(req), store: getAccountStore(), env: process.env });
  return Response.json(r.body, { status: r.status, headers: { 'Cache-Control': 'no-store' } });
}
