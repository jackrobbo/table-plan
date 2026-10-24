'use client';
import { useEffect, useState } from 'react';
import { getBackend } from './db';

/** Whether someone is signed in on this device: null until we know. Pass a value that changes (e.g. the path) to re-read it. */
export function useSignedIn(recheck?: unknown): boolean | null {
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  useEffect(() => {
    let live = true;
    getBackend().auth.getSession().then((s) => { if (live) setSignedIn(!!s); }).catch(() => { if (live) setSignedIn(false); });
    return () => { live = false; };
  }, [recheck]);
  return signedIn;
}
