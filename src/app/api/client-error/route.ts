import { shapeReport } from '@/lib/errorReport';
import { clientIp, limited } from '@/lib/server/rateLimit';

/** Browser errors land in the server log (Vercel → Logs, searchable by "[client-error]"). One line each, no personal data. */
export async function POST(req: Request) {
  if (limited(`client-error:${clientIp(req)}`, 20, 60_000)) return new Response(null, { status: 204 });
  const report = shapeReport(await req.json().catch(() => null));
  if (report) console.error('[client-error]', JSON.stringify(report));
  return new Response(null, { status: 204 });
}
