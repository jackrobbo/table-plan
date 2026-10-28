'use client';
import { useEffect } from 'react';
import Screen from '@/components/Screen';
import { reportError } from '@/lib/errorReport';

/** Last-resort screen for unexpected errors. They are sent to our own log (lib/errorReport.ts); a vendor such as Sentry would plug in at the same place. */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error); reportError('boundary', error); }, [error]);
  return (
    <Screen footer={<button className="btn" onClick={reset}>Try Again</button>}>
      <h2>Something Went Wrong</h2>
      <p className="sub">Your answers and plans are saved. Try again, and if it keeps happening, let us know from your account page.</p>
    </Screen>
  );
}
