'use client';
import { useEffect } from 'react';
import { reportError } from '@/lib/errorReport';

/** Mounted in the root layout: sends uncaught browser errors to our own log so we hear about problems before people have to tell us. Renders nothing. */
export default function ErrorReporter() {
  useEffect(() => {
    const onError = (e: ErrorEvent) => reportError('error', e.error ?? e.message);
    const onRejection = (e: PromiseRejectionEvent) => reportError('rejection', e.reason);
    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRejection);
    return () => { window.removeEventListener('error', onError); window.removeEventListener('unhandledrejection', onRejection); };
  }, []);
  return null;
}
