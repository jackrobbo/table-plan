import { createCheckoutSession } from '@/lib/billing/server';
import { getServerUser } from '@/lib/server/context';

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { plan?: unknown };
  const r = await createCheckoutSession({ plan: body.plan, user: await getServerUser(req), origin: new URL(req.url).origin, env: process.env });
  return Response.json(r.body, { status: r.status });
}
