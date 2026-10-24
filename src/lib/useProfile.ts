'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { getBackend, type Session } from './db';
import { clearStatus, setStatus } from './status';
import { emptyProfile, type Profile } from './profile';

/** Loads the session + profile; `update` applies a pure transform and persists it. */
export function useProfile() {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [ready, setReady] = useState(false);
  const latest = useRef<Profile | null>(null);

  const load = useCallback(async () => {
    const { auth, profiles } = getBackend();
    try {
      const s = await auth.getSession();
      setSession(s);
      if (s) {
        const p = (await profiles.load(s.userId)) ?? emptyProfile();
        latest.current = p;
        setProfile(p);
      }
      clearStatus('offline');
      setReady(true);
    } catch {
      // Can't reach the server. Stay on the loading screen rather than treating this as "signed out" or showing an empty
      // profile; the banner says why, and we try again as soon as the connection is back.
      setStatus({ kind: 'offline' });
    }
  }, []);

  useEffect(() => {
    void load();
    const retry = () => { if (!latest.current) void load(); };
    window.addEventListener('online', retry);
    const off = getBackend().auth.onSignedOut(() => setSession(null));
    return () => { window.removeEventListener('online', retry); off(); };
  }, [load]);

  const update = useCallback(
    (fn: (p: Profile) => Profile) => {
      if (!session || !latest.current) return;
      const next = fn(latest.current);
      latest.current = next;
      setProfile(next);
      void getBackend().profiles.save(session.userId, next);
    },
    [session],
  );

  return { session, profile, ready, update };
}
