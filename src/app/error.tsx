'use client';
import { useEffect } from 'react';
import Screen from '@/components/Screen';

/** Last-resort screen for unexpected errors. `reportError` is where Sentry (or similar) plugs in. */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error); }, [error]);
  return (
    <Screen footer={<button className="btn" onClick={reset}>Try again</button>}>
      <h2>Something went wrong</h2>
      <p className="sub">Your answers and plans are saved. Try again, and if it keeps happening, let us know from your account page.</p>
    </Screen>
  );
}
