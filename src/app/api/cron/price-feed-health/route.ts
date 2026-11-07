import { timingSafeEqual } from 'node:crypto';
import { getFeedRunsLoader } from '@/lib/server/context';
import { runHealthCheck, webhookNotifier } from '@/lib/server/health';

const same = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

/**
 * Checks the weekly price feed a few hours after it should have run (Monday and Thursday; see vercel.json). Problems send one message to
 * ALERT_WEBHOOK_URL (optional: ntfy.sh topic, Slack or Discord webhook) and make this route answer 500, which shows red on Vercel's cron page.
 */
export async function GET(req: Request) {
  const cron = process.env.CRON_SECRET, got = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? '';
  if (!cron || !same(got, cron)) return Response.json({ error: 'Not allowed.' }, { status: 401, headers: { 'Cache-Control': 'no-store' } });
  const loadRuns = getFeedRunsLoader();
  if (!loadRuns) return Response.json({ error: 'Not configured.', missing: ['SUPABASE_SERVICE_ROLE_KEY'] }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  try {
    const r = await runHealthCheck({ loadRuns, notify: webhookNotifier(process.env.ALERT_WEBHOOK_URL?.trim()) });
    return Response.json({ ...r, alertChannel: process.env.ALERT_WEBHOOK_URL ? 'set' : 'not set' }, { status: r.ok ? 200 : 500, headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    return Response.json({ ok: false, error: 'Could not read the run records.', detail: String((e as Error).message).slice(0, 160) }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
  }
}
