import { clientIp, limited, tooMany } from '@/lib/server/rateLimit';
import { joinWaitlist } from '@/lib/beta/waitlist';
import { getWaitlistStore } from '@/lib/server/context';

export async function POST(req: Request) {
  if (limited(`waitlist:${clientIp(req)}`, 10, 60_000)) return tooMany();
  const r = await joinWaitlist({ body: await req.json().catch(() => null), store: getWaitlistStore() });
  return Response.json(r.body, { status: r.status });
}
