import { createPortalSession } from '@/lib/billing/server';
import { getServerUser, getStripeCustomerId } from '@/lib/server/context';

export async function POST(req: Request) {
  const user = await getServerUser(req);
  if (!user) return Response.json({ error: 'Sign in first.' }, { status: 401 });
  const r = await createPortalSession({ customerId: await getStripeCustomerId(user), origin: new URL(req.url).origin, env: process.env });
  return Response.json(r.body, { status: r.status });
}
