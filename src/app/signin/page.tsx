'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getBackend, isMocked, MOCK_CODE } from '@/lib/db';

const RESEND_SECONDS = 30;

export default function SignIn() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [digits, setDigits] = useState<string[]>(Array(6).fill(''));
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [wait, setWait] = useState(0);
  const boxes = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    getBackend().auth.getSession().then((s) => { if (s) router.replace('/onboarding'); });
  }, [router]);

  useEffect(() => {
    if (wait <= 0) return;
    const t = setTimeout(() => setWait(wait - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  async function send() {
    setError(''); setBusy(true);
    try {
      await getBackend().auth.sendCode(email);
      setSent(true); setWait(RESEND_SECONDS); setDigits(Array(6).fill(''));
      setTimeout(() => boxes.current[0]?.focus(), 0);
    } catch (e) { setError((e as Error).message); }
    setBusy(false);
  }

  async function verify(code: string) {
    setError(''); setBusy(true);
    try {
      await getBackend().auth.verifyCode(email, code);
      router.replace('/onboarding');
    } catch (e) {
      setError((e as Error).message); setDigits(Array(6).fill('')); boxes.current[0]?.focus();
      setBusy(false);
    }
  }

  function onDigit(i: number, v: string) {
    const clean = v.replace(/\D/g, '');
    if (clean.length > 1) { // paste of the whole code
      const next = clean.slice(0, 6).split('');
      setDigits([...next, ...Array(6 - next.length).fill('')]);
      if (next.length === 6) void verify(next.join(''));
      return;
    }
    const next = digits.slice(); next[i] = clean; setDigits(next);
    if (clean && i < 5) boxes.current[i + 1]?.focus();
    if (next.every(Boolean)) void verify(next.join(''));
  }

  return (
    <>
      <p className="eyebrow">Sign in</p>
      {!sent ? (
        <>
          <h2>What&apos;s your email?</h2>
          <p className="muted">We&apos;ll send you a 6-digit code. We only use your email for Table Plan.</p>
          <label className="f" htmlFor="email">Email</label>
          <input id="email" type="email" inputMode="email" autoComplete="email" value={email}
            onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && send()} />
          {error && <p className="err">{error}</p>}
          <button className="btn" disabled={!email || busy} onClick={send}>Send code</button>
        </>
      ) : (
        <>
          <h2>Enter your code</h2>
          <p className="muted">Sent to {email}.</p>
          <div className="otp">
            {digits.map((d, i) => (
              <input key={i} ref={(el) => { boxes.current[i] = el; }} value={d} inputMode="numeric"
                autoComplete={i === 0 ? 'one-time-code' : 'off'} aria-label={`Digit ${i + 1}`}
                onChange={(e) => onDigit(i, e.target.value)}
                onKeyDown={(e) => e.key === 'Backspace' && !d && i > 0 && boxes.current[i - 1]?.focus()} />
            ))}
          </div>
          {error && <p className="err">{error}</p>}
          <button className="linkbtn" disabled={wait > 0 || busy} onClick={send}>
            {wait > 0 ? `Resend code in ${wait}s` : 'Resend code'}
          </button>
          <button className="linkbtn" onClick={() => { setSent(false); setError(''); }}>Use a different email</button>
        </>
      )}
      {isMocked && <p className="mock">Dev mode: email isn&apos;t really sent. Use code <b>{MOCK_CODE}</b>.</p>}
      <p className="muted"><Link href="/">← Back</Link></p>
    </>
  );
}
