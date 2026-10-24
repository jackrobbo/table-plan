'use client';
import { useState } from 'react';
import Link from 'next/link';
import Screen from '@/components/Screen';

export default function Waitlist() {
  const [email, setEmail] = useState('');
  const [consent, setConsent] = useState(false);
  const [company, setCompany] = useState('');           // honeypot, hidden from people
  const [state, setState] = useState<'idle' | 'busy' | 'done'>('idle');
  const [error, setError] = useState('');

  const submit = async () => {
    setState('busy'); setError('');
    try {
      const r = await fetch('/api/waitlist', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, consent, company, source: 'waitlist-page' }) });
      const j = (await r.json()) as { error?: string };
      if (!r.ok) { setError(j.error ?? 'Something went wrong. Try again.'); setState('idle'); return; }
      setState('done');
    } catch { setError('Could not reach Table Plan. Check your connection and try again.'); setState('idle'); }
  };

  return (
    <Screen footer={state !== 'done' ? <button className="btn" disabled={!email || !consent || state === 'busy'} onClick={submit}>Join the waitlist</button> : <Link className="btn ghost" href="/">Back to start</Link>}>
      <div className="brand"><div className="logo">T</div>Table Plan</div>
      {state !== 'done' ? (<>
        <h1>The bottleneck to health is money.</h1>
        <p className="sub" style={{ maxWidth: '36ch' }}>A month of Sundays costs less than one day of meal prep. Real meals, planned to your goal, priced at Morrisons. We&apos;re opening in small groups. Join the list for an invite.</p>
        <label className="f" htmlFor="wl-email" style={{ fontSize: 13, color: 'var(--ink2)' }}>Email</label>
        <input id="wl-email" className="text" type="email" inputMode="email" autoComplete="email" placeholder="you@example.co.uk" value={email} onChange={(e) => setEmail(e.target.value)} />
        <div style={{ position: 'absolute', left: -9999 }} aria-hidden><input tabIndex={-1} autoComplete="off" value={company} onChange={(e) => setCompany(e.target.value)} /></div>
        <label className="consent"><input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
          <span>Email me when Table Plan opens, and occasional updates before then. I can unsubscribe any time.</span></label>
        {error && <p className="err">{error}</p>}
        <p className="muted">We only use your email for this. We never sell it.</p>
      </>) : (<>
        <h1>You&apos;re on the list.</h1>
        <p className="sub">We&apos;ll email you when your invite is ready.</p>
      </>)}
    </Screen>
  );
}
