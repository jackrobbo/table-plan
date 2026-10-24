'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Screen from '@/components/Screen';
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

  const back = () => (sent ? (setSent(false), setError('')) : router.push('/'));

  return (
    <Screen onBack={back}
      footer={!sent ? <button className="btn" disabled={!email || busy} onClick={send}>Send code</button> : undefined}>
      {!sent ? (
        <>
          <h2>What&apos;s your email?</h2>
          <p className="sub">We&apos;ll send a 6-digit code. No password. We only use your email for Table Plan, never for anything else.</p>
          <input id="email" className="text" type="email" inputMode="email" autoComplete="email" placeholder="you@example.co.uk" value={email}
            aria-label="Email" onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && send()} />
          {error && <p className="err">{error}</p>}
        </>
      ) : (
        <>
          <h2>Check your email</h2>
          <p className="sub">Code sent to {email}</p>
          <div className="otp">
            {digits.map((d, i) => (
              <input key={i} ref={(el) => { boxes.current[i] = el; }} value={d} inputMode="numeric"
                autoComplete={i === 0 ? 'one-time-code' : 'off'} aria-label={`Digit ${i + 1}`}
                onChange={(e) => onDigit(i, e.target.value)}
                onKeyDown={(e) => e.key === 'Backspace' && !d && i > 0 && boxes.current[i - 1]?.focus()} />
            ))}
          </div>
          {error && <p className="err">{error}</p>}
          <div className="row" style={{ display: 'flex', justifyContent: 'space-between' }}>
            <button className="linkbtn" disabled={wait > 0 || busy} onClick={send}>
              {wait > 0 ? `Resend in 0:${String(wait).padStart(2, '0')}` : 'Resend code'}
            </button>
            <button className="linkbtn" onClick={back}>Wrong email?</button>
          </div>
        </>
      )}
      {isMocked && <p className="mock">Dev mode: no email is sent. Use code <b>{MOCK_CODE}</b>.</p>}
    </Screen>
  );
}
