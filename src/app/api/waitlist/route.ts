import { joinWaitlist } from '@/lib/beta/waitlist';
import { getWaitlistStore } from '@/lib/server/context';

export async function POST(req: Request) {
  const r = await joinWaitlist({ body: await req.json().catch(() => null), store: getWaitlistStore() });
  return Response.json(r.body, { status: r.status });
}
