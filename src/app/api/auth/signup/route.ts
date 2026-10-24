import { inviteOnly } from '@/lib/beta/config';
import { clientIp, limited, tooMany } from '@/lib/server/rateLimit';
import { getSignupStore } from '@/lib/server/context';
import { startSignup } from '@/lib/server/signup';

/** Creates the account for a new sign-up (after checking the invite code while the beta is invite-only). The browser then asks Supabase to email the code. */
export async function POST(req: Request) {
  if (limited(`signup:${clientIp(req)}`, 10, 60_000)) return tooMany();
  const r = await startSignup({ body: await req.json().catch(() => null), store: getSignupStore(), inviteRequired: inviteOnly });
  return Response.json(r.body, { status: r.status, headers: { 'Cache-Control': 'no-store' } });
}
