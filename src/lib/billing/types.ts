import type { PlanId } from './config';

export type SubStatus = 'none' | 'trialing' | 'active' | 'past_due' | 'canceled';

export interface Subscription {
  status: SubStatus;
  plan: PlanId | null;
  /** ISO. Set while trialing. */
  trialEndsAt: string | null;
  /** ISO. End of the paid-for (or trial) period. */
  currentPeriodEnd: string | null;
  /** Cancelled but still running until currentPeriodEnd. */
  cancelAtPeriodEnd: boolean;
  stripeCustomerId?: string;
}

export const noSubscription = (): Subscription => ({ status: 'none', plan: null, trialEndsAt: null, currentPeriodEnd: null, cancelAtPeriodEnd: false });

/**
 * Access rules: trialing and active get in; a cancelled plan keeps access until the period it paid for ends;
 * past_due gets a short grace window (Stripe retries the card) so a failed payment doesn't lock someone out instantly.
 */
export const PAST_DUE_GRACE_DAYS = 3;

export function hasAccess(sub: Subscription, now: Date = new Date()): boolean {
  const end = sub.currentPeriodEnd ? new Date(sub.currentPeriodEnd) : null;
  switch (sub.status) {
    case 'trialing':
    case 'active': return !end || now < end;
    case 'canceled': return !!end && now < end;
    case 'past_due': return !!end && now.getTime() < end.getTime() + PAST_DUE_GRACE_DAYS * 864e5;
    default: return false;
  }
}

export interface BillingService {
  get(userId: string): Promise<Subscription>;
  /** Starts checkout for a plan. The mock completes it instantly; the real one redirects to Stripe. */
  subscribe(userId: string, email: string, plan: PlanId): Promise<Subscription>;
  cancel(userId: string): Promise<Subscription>;
  resume(userId: string): Promise<Subscription>;
}
