import { rateLimited } from '@/lib/server/guard';
import { tooMany } from '@/lib/server/rateLimit';
import { joinWaitlist } from '@/lib/beta/waitlist';
import { getWaitlistStore } from '@/lib/server/context';

export async function POST(req: Request) {
  if (await rateLimited(req, 'waitlist', 10)) return tooMany();
  const r = await joinWaitlist({ body: await req.json().catch(() => null), store: getWaitlistStore() });
  return Response.json(r.body, { status: r.status });
}
