import { redeemInvite } from '@/lib/beta/invites';
import { getInviteStore } from '@/lib/server/context';

export async function POST(req: Request) {
  const b = (await req.json().catch(() => ({}))) as { code?: unknown; email?: unknown };
  if (typeof b.code !== 'string' || typeof b.email !== 'string') return Response.json({ error: 'Enter your invite code.' }, { status: 400 });
  const r = await redeemInvite(getInviteStore(), b.code, b.email);
  if (r.ok) return Response.json({ ok: true });
  const status = r.reason === 'unavailable' ? 503 : 400;
  const error = r.reason === 'unavailable' ? 'Invites are not switched on yet.' : r.reason === 'used' ? 'That code is not valid or has already been used.' : 'That code does not look right.';
  return Response.json({ error }, { status });
}
