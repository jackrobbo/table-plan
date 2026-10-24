import { rateLimited } from '@/lib/server/guard';
import { tooMany } from '@/lib/server/rateLimit';
import { getServerUser, saveFeedback } from '@/lib/server/context';

export async function POST(req: Request) {
  if (await rateLimited(req, 'feedback', 10)) return tooMany();
  const b = (await req.json().catch(() => ({}))) as { message?: unknown; page?: unknown };
  const message = typeof b.message === 'string' ? b.message.trim().slice(0, 2000) : '';
  if (message.length < 3) return Response.json({ error: 'Tell us a little more.' }, { status: 400 });
  const ok = await saveFeedback(await getServerUser(req), { message, page: typeof b.page === 'string' ? b.page.slice(0, 60) : '' });
  return ok ? Response.json({ ok: true }) : Response.json({ error: 'Feedback is not switched on yet.' }, { status: 503 });
}
