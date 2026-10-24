import { deleteStripeCustomer, type Result, type ServerUser } from '../billing/server';

type Env = Record<string, string | undefined>;

/** What account deletion and export need from the database. Implemented on Supabase (service role) in context.ts. */
export interface AccountStore {
  /** The Stripe customer saved by the webhook, if they ever started checkout. */
  stripeCustomerId(userId: string): Promise<string | undefined>;
  /** Everything we hold about this person, as plain data. */
  exportData(user: ServerUser): Promise<Record<string, unknown>>;
  /** Removes their feedback and waitlist entry and detaches their invite code. Profile and subscription go with the login. */
  deleteData(user: ServerUser): Promise<void>;
  /** Deletes the login itself (and, by cascade, the profile and subscription rows). */
  deleteUser(userId: string): Promise<void>;
}

const NOT_AVAILABLE: Result = { status: 501, body: { error: 'This isn’t switched on yet.' } };
const SIGN_IN: Result = { status: 401, body: { error: 'Sign in first.' } };

export async function exportAccount(a: { user: ServerUser | null; store: AccountStore | null; now?: Date }): Promise<Result> {
  if (!a.user) return SIGN_IN;
  if (!a.store) return NOT_AVAILABLE;
  const data = await a.store.exportData(a.user);
  return { status: 200, body: { exportedAt: (a.now ?? new Date()).toISOString(), account: { id: a.user.id, email: a.user.email }, ...data } };
}

/**
 * Erases the account. Billing goes first and is checked: if we can't be sure the subscription is cancelled we stop and delete
 * nothing, so nobody is left paying for an account that no longer exists. Every step can be repeated safely, so a retry after a
 * partial failure finishes the job.
 */
export async function deleteAccount(a: { user: ServerUser | null; store: AccountStore | null; env: Env; fetchImpl?: typeof fetch }): Promise<Result> {
  if (!a.user) return SIGN_IN;
  if (!a.store) return NOT_AVAILABLE;
  const customerId = await a.store.stripeCustomerId(a.user.id);
  if (customerId) {
    const billing = await deleteStripeCustomer({ customerId, env: a.env, fetchImpl: a.fetchImpl });
    if (billing === 'failed') return { status: 502, body: { error: 'We couldn’t cancel your subscription, so nothing has been deleted. Please try again in a minute.' } };
  }
  try {
    await a.store.deleteData(a.user);
    await a.store.deleteUser(a.user.id);
  } catch {
    return { status: 500, body: { error: 'Something went wrong part-way. Your subscription is cancelled. Please try again to finish deleting your data.' } };
  }
  return { status: 200, body: { ok: true } };
}
