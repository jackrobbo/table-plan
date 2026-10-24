'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { getBackend, type Session } from './db';
import { emptyProfile, type Profile } from './profile';

/** Loads the session + profile; `update` applies a pure transform and persists it. */
export function useProfile() {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [ready, setReady] = useState(false);
  const latest = useRef<Profile | null>(null);

  useEffect(() => {
    (async () => {
      const { auth, profiles } = getBackend();
      const s = await auth.getSession();
      setSession(s);
      if (s) {
        const p = (await profiles.load(s.userId)) ?? emptyProfile();
        latest.current = p;
        setProfile(p);
      }
      setReady(true);
    })();
  }, []);

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
