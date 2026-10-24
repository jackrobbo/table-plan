import { useSyncExternalStore } from 'react';

/** Something the person should know about that no single screen owns: we can't reach the server, or a save didn't go through. */
export type Status = { kind: 'offline' | 'save-failed' } | null;

let current: Status = null;
const subs = new Set<() => void>();

export function setStatus(s: Status) {
  if (current?.kind === s?.kind) return;
  current = s;
  subs.forEach((f) => f());
}
/** Clears one kind of status only (a successful save must not hide an "offline" notice, and vice versa). */
export const clearStatus = (kind: NonNullable<Status>['kind']) => { if (current?.kind === kind) setStatus(null); };
export const getStatus = () => current;

export const useStatus = (): Status =>
  useSyncExternalStore((f) => { subs.add(f); return () => { subs.delete(f); }; }, getStatus, () => null);
