/** Pricing lives here, not in components. Change a number here and every screen follows. */
export type PlanId = 'yearly' | 'monthly';

export interface PlanConfig {
  id: PlanId;
  /** GBP pence charged each period. */
  pence: number;
  interval: 'year' | 'month';
  /** Free days before the first charge. */
  trialDays: number;
  /** Stripe Price id, set per environment. */
  stripePriceEnv: string;
}

export const PLANS: Record<PlanId, PlanConfig> = {
  yearly: { id: 'yearly', pence: 999, interval: 'year', trialDays: 7, stripePriceEnv: 'STRIPE_PRICE_YEARLY' },
  monthly: { id: 'monthly', pence: 99, interval: 'month', trialDays: 0, stripePriceEnv: 'STRIPE_PRICE_MONTHLY' },
};
export const DEFAULT_PLAN: PlanId = 'yearly';

export const gbp = (pence: number) => '£' + (pence / 100).toFixed(2);
/** What the yearly plan works out to each month, for the paywall comparison. */
export const perMonth = (p: PlanConfig) => gbp(p.interval === 'year' ? Math.round(p.pence / 12) : p.pence);
