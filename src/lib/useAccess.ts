'use client';
import { useCallback, useEffect, useState } from 'react';
import { hasAccess, noSubscription, type Subscription } from './billing/types';
import { getBackend, type Session } from './db';
import type { PlanId } from './billing/config';
import { freeBeta } from './beta/config';

/** Subscription state for the signed-in user, plus the actions the UI needs. */
export function useAccess(session: Session | null) {
  const [sub, setSub] = useState<Subscription>(noSubscription());
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!session) return;
    if (freeBeta) { setLoaded(true); return; }
    let cancelled = false, tries = 0;
    // Returning from Stripe Checkout (?subscribed=1): the webhook can lag a few seconds, so poll briefly.
    const justPaid = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('subscribed') === '1';
    const load = async () => {
      const s = await getBackend().billing.get(session.userId);
      if (cancelled) return;
      setSub(s); setLoaded(true);
      if (justPaid && !hasAccess(s) && ++tries < 10) setTimeout(load, 2000);
    };
    void load();
    return () => { cancelled = true; };
  }, [session]);

  const run = useCallback(async (f: () => Promise<Subscription>) => { const s = await f(); setSub(s); return s; }, []);
  return {
    sub, loaded, access: freeBeta || (loaded && hasAccess(sub)),
    subscribe: (plan: PlanId) => run(() => getBackend().billing.subscribe(session!.userId, session!.email, plan)),
    cancel: () => run(() => getBackend().billing.cancel(session!.userId)),
    resume: () => run(() => getBackend().billing.resume(session!.userId)),
  };
}
