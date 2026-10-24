import { getServerUser, saveFeedback } from '@/lib/server/context';

export async function POST(req: Request) {
  const b = (await req.json().catch(() => ({}))) as { message?: unknown; page?: unknown };
  const message = typeof b.message === 'string' ? b.message.trim().slice(0, 2000) : '';
  if (message.length < 3) return Response.json({ error: 'Tell us a little more.' }, { status: 400 });
  const ok = await saveFeedback(await getServerUser(req), { message, page: typeof b.page === 'string' ? b.page.slice(0, 60) : '' });
  return ok ? Response.json({ ok: true }) : Response.json({ error: 'Feedback is not switched on yet.' }, { status: 503 });
}
