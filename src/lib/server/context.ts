import type { ServerUser, SubscriptionStore } from '../billing/server';
import type { InviteStore } from '../beta/invites';
import type { WaitlistStore } from '../beta/waitlist';
import { fileWaitlistStore } from './waitlistFile';

/**
 * Server-side seams that need the real Supabase project. Until it exists they return null, and the billing
 * routes answer 401/503 instead of pretending. Wire them to Supabase (verify the session JWT; service-role writes
 * to `subscriptions` and `stripe_events`) when the project is created.
 */
export async function getServerUser(_req: Request): Promise<ServerUser | null> { return null; }
export function getSubscriptionStore(): SubscriptionStore | null { return null; }
export async function getStripeCustomerId(_user: ServerUser): Promise<string | undefined> { return undefined; }

/** Local dev only (WAITLIST_FILE). In production this becomes a Supabase insert into `waitlist` using the service role. */
export function getWaitlistStore(): WaitlistStore | null { return process.env.WAITLIST_FILE ? fileWaitlistStore(process.env.WAITLIST_FILE) : null; }
/** Backed by `invites` in Supabase (an atomic UPDATE ... WHERE redeemed_at IS NULL). */
export function getInviteStore(): InviteStore | null { return null; }
export async function saveFeedback(_user: ServerUser | null, _msg: { message: string; page: string }): Promise<boolean> { return false; }
