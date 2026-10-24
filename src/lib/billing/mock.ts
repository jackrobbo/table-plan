import type { KV } from '../db/types';
import { PLANS, type PlanId } from './config';
import { noSubscription, type BillingService, type Subscription } from './types';

const key = (uid: string) => `tp.sub.${uid}`;
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 864e5);
const addInterval = (d: Date, i: 'year' | 'month') => { const x = new Date(d); if (i === 'year') x.setUTCFullYear(x.getUTCFullYear() + 1); else x.setUTCMonth(x.getUTCMonth() + 1); return x; };

/** Mock billing: no card, no charge. Mirrors what Stripe would report so the UI is built against the real shape. */
export function createMockBilling(kv: KV, now: () => Date = () => new Date()): BillingService {
  const read = (uid: string): Subscription => { const raw = kv.getItem(key(uid)); return raw ? { ...noSubscription(), ...JSON.parse(raw) } : noSubscription(); };
  const write = (uid: string, s: Subscription) => { kv.setItem(key(uid), JSON.stringify(s)); return s; };
  return {
    async get(uid) { return read(uid); },
    async subscribe(uid, _email, plan: PlanId) {
      const cfg = PLANS[plan], t = now();
      if (cfg.trialDays > 0) {
        const end = addDays(t, cfg.trialDays).toISOString();
        return write(uid, { status: 'trialing', plan, trialEndsAt: end, currentPeriodEnd: end, cancelAtPeriodEnd: false });
      }
      return write(uid, { status: 'active', plan, trialEndsAt: null, currentPeriodEnd: addInterval(t, cfg.interval).toISOString(), cancelAtPeriodEnd: false });
    },
    async cancel(uid) { const s = read(uid); return s.status === 'none' ? s : write(uid, { ...s, cancelAtPeriodEnd: true }); },
    async resume(uid) { const s = read(uid); return s.status === 'none' ? s : write(uid, { ...s, cancelAtPeriodEnd: false }); },
  };
}
