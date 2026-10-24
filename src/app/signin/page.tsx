'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Screen from '@/components/Screen';
import { getBackend, isMocked, MOCK_CODE } from '@/lib/db';
import { devInviteCodes, inviteOnly } from '@/lib/beta/config';
import { normaliseCode } from '@/lib/beta/invites';
import { track } from '@/lib/analytics';

const RESEND_SECONDS = 30;

export default function SignIn() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [digits, setDigits] = useState<string[]>(Array(6).fill(''));
  const [error, setError] = useState('');
  const [isNew, setIsNew] = useState(false);
  const [invite, setInvite] = useState('');
  const [busy, setBusy] = useState(false);
  const [wait, setWait] = useState(0);
  const boxes = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => { setIsNew(new URLSearchParams(window.location.search).get('new') === '1'); }, []);

  useEffect(() => {
    getBackend().auth.getSession().then((s) => { if (s) router.replace('/onboarding'); });
  }, [router]);

  useEffect(() => {
    if (wait <= 0) return;
    const t = setTimeout(() => setWait(wait - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  const needsInvite = inviteOnly && isNew;
  async function checkInvite(): Promise<boolean> {
    // Real path: the server redeems the code atomically. The mock backend accepts the dev codes so the gate can be previewed.
    try {
      const r = await fetch('/api/invite', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code: invite, email }) });
      if (r.ok) return true;
      if (r.status !== 503 || !isMocked) throw new Error(((await r.json()) as { error?: string }).error ?? 'That code is not valid.');
    } catch (e) { if (!isMocked) throw e; if (e instanceof Error && e.message !== 'Failed to fetch' && !/fetch/i.test(e.message)) throw e; }
    if (devInviteCodes.map(normaliseCode).includes(normaliseCode(invite))) return true;
    throw new Error('That code is not valid or has already been used.');
  }

  async function send() {
    setError(''); setBusy(true);
    try {
      if (needsInvite) { await checkInvite(); track('signup_invite_redeemed'); }
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
      footer={!sent ? <button className="btn" disabled={!email || busy || (needsInvite && !invite)} onClick={send}>Send code</button> : undefined}>
      {!sent ? (
        <>
          <h2>What&apos;s your email?</h2>
          <p className="sub">We&apos;ll send a 6-digit code. No password. We only use your email for Table Plan, never for anything else.</p>
          <input id="email" className="text" type="email" inputMode="email" autoComplete="email" placeholder="you@example.co.uk" value={email}
            aria-label="Email" onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && send()} />
          {needsInvite && <>
            <input id="invite" className="text" style={{ marginTop: 10 }} placeholder="Invite code (XXXX-XXXX-XXXX)" aria-label="Invite code" autoCapitalize="characters" value={invite} onChange={(e) => setInvite(e.target.value)} />
            <p className="muted" style={{ marginTop: 8 }}>Table Plan is invite-only while we test. <Link href="/waitlist">Join the waitlist</Link></p>
          </>}
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
