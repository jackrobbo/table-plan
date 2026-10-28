import { useSyncExternalStore } from 'react';

/** The "weeks to plan" count shown on the Upcoming tab. The plan screen knows it; the bar lives in the layout. */
let count = 0;
const subs = new Set<() => void>();

export function setTabBadge(n: number) {
  if (n === count) return;
  count = n;
  subs.forEach((f) => f());
}

export const useTabBadge = (): number =>
  useSyncExternalStore((f) => { subs.add(f); return () => { subs.delete(f); }; }, () => count, () => 0);
