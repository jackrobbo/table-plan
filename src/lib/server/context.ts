import type { ServerUser, SubscriptionStore } from '../billing/server';

/**
 * Server-side seams that need the real Supabase project. Until it exists they return null, and the billing
 * routes answer 401/503 instead of pretending. Wire them to Supabase (verify the session JWT; service-role writes
 * to `subscriptions` and `stripe_events`) when the project is created.
 */
export async function getServerUser(_req: Request): Promise<ServerUser | null> { return null; }
export function getSubscriptionStore(): SubscriptionStore | null { return null; }
export async function getStripeCustomerId(_user: ServerUser): Promise<string | undefined> { return undefined; }
