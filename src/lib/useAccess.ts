'use client';
import { useCallback, useEffect, useState } from 'react';
import { hasAccess, noSubscription, type Subscription } from './billing/types';
import { getBackend, type Session } from './db';
import type { PlanId } from './billing/config';

/** Subscription state for the signed-in user, plus the actions the UI needs. */
export function useAccess(session: Session | null) {
  const [sub, setSub] = useState<Subscription>(noSubscription());
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!session) return;
    getBackend().billing.get(session.userId).then((s) => { setSub(s); setLoaded(true); });
  }, [session]);

  const run = useCallback(async (f: () => Promise<Subscription>) => { const s = await f(); setSub(s); return s; }, []);
  return {
    sub, loaded, access: loaded && hasAccess(sub),
    subscribe: (plan: PlanId) => run(() => getBackend().billing.subscribe(session!.userId, session!.email, plan)),
    cancel: () => run(() => getBackend().billing.cancel(session!.userId)),
    resume: () => run(() => getBackend().billing.resume(session!.userId)),
  };
}
