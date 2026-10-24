import { handleWebhook } from '@/lib/billing/server';
import { getSubscriptionStore } from '@/lib/server/context';

export async function POST(req: Request) {
  // Raw body, not parsed JSON: the signature covers the exact bytes Stripe sent.
  const payload = await req.text();
  const r = await handleWebhook({ payload, signature: req.headers.get('stripe-signature'), env: process.env, store: getSubscriptionStore() });
  return Response.json(r.body, { status: r.status });
}
