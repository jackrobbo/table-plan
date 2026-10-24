import { shapeReport } from '@/lib/errorReport';
import { rateLimited } from '@/lib/server/guard';

/** Browser errors land in the server log (Vercel → Logs, searchable by "[client-error]"). One line each, no personal data. */
export async function POST(req: Request) {
  if (await rateLimited(req, 'client-error', 20)) return new Response(null, { status: 204 });
  const report = shapeReport(await req.json().catch(() => null));
  if (report) console.error('[client-error]', JSON.stringify(report));
  return new Response(null, { status: 204 });
}
