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
/** Must match Supabase's "Email OTP Length" setting (currently 8). The mock backend uses 6. */
const OTP_LENGTH = isMocked ? 6 : Number(process.env.NEXT_PUBLIC_OTP_LENGTH) || 8;

export default function SignIn() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [isNew, setIsNew] = useState(false);
  const [invite, setInvite] = useState('');
  const [busy, setBusy] = useState(false);
  const [wait, setWait] = useState(0);
  const codeInput = useRef<HTMLInputElement | null>(null);

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
  /** Where the account already made for this email (new sign-ups only), so "Resend code" never spends the invite twice. */
  const [madeFor, setMadeFor] = useState('');

  /** New sign-ups: the server checks the invite and creates the account. The mock backend accepts the dev codes so the gate can be previewed. */
  async function createAccount(): Promise<void> {
    if (madeFor === email.trim().toLowerCase()) return;
    if (isMocked) {
      if (needsInvite && !devInviteCodes.map(normaliseCode).includes(normaliseCode(invite))) throw new Error('That code is not valid or has already been used.');
      return;
    }
    const r = await fetch('/api/auth/signup', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, invite }) });
    if (!r.ok) throw new Error(((await r.json().catch(() => ({}))) as { error?: string }).error ?? 'We couldn’t set up your account. Please try again.');
    setMadeFor(email.trim().toLowerCase());
  }

  async function send() {
    setError(''); setBusy(true);
    try {
      if (isNew) { await createAccount(); if (needsInvite) track('signup_invite_redeemed'); }
      await getBackend().auth.sendCode(email);
      setSent(true); setWait(RESEND_SECONDS); setCode('');
      setTimeout(() => codeInput.current?.focus(), 0);
    } catch (e) { setError((e as Error).message); }
    setBusy(false);
  }

  async function verify(code: string) {
    setError(''); setBusy(true);
    try {
      await getBackend().auth.verifyCode(email, code);
      router.replace('/onboarding');
    } catch (e) {
      setError((e as Error).message); setCode('');
      setBusy(false);
      setTimeout(() => codeInput.current?.focus(), 0);
    }
  }

  /** One real input holds the code (typing, paste, backspace and OS autofill all work); the boxes only display it. */
  function onCode(raw: string) {
    const v = raw.replace(/\D/g, '').slice(0, OTP_LENGTH);
    setCode(v);
    if (v.length === OTP_LENGTH && !busy) void verify(v);
  }

  const back = () => (sent ? (setSent(false), setError('')) : router.push('/'));

  return (
    <Screen onBack={back}
      footer={!sent ? <button className="btn" disabled={!email || busy || (needsInvite && !invite)} onClick={send}>Send code</button> : undefined}>
      {!sent ? (
        <>
          <h2>What&apos;s your email?</h2>
          <p className="sub">We&apos;ll send {OTP_LENGTH === 8 ? 'an' : 'a'} {OTP_LENGTH}-digit code. No password. We only use your email for Table Plan, never for anything else.</p>
          <input id="email" className="text" type="email" inputMode="email" autoComplete="email" placeholder="you@example.co.uk" value={email}
            aria-label="Email" onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && send()} />
          {needsInvite && <>
            <input id="invite" className="text" style={{ marginTop: 10 }} placeholder="Invite code (XXXX-XXXX-XXXX)" aria-label="Invite code" autoCapitalize="characters" value={invite} onChange={(e) => setInvite(e.target.value)} />
            <p className="muted" style={{ marginTop: 8 }}>Table Plan is invite-only while we test. <Link href="/waitlist">Join the waitlist</Link></p>
          </>}
          {error && <p className="err">{error}</p>}
          <p className="muted" style={{ marginTop: 12 }}>By continuing you&apos;re agreeing to our <Link href="/terms">terms</Link> and <Link href="/privacy">privacy policy</Link>. We&apos;ll ask you to confirm before we collect anything about your health.</p>
        </>
      ) : (
        <>
          <h2>Check your email</h2>
          <p className="sub">Code sent to {email}</p>
          <div className="otp" onClick={() => codeInput.current?.focus()}>
            <input ref={codeInput} className="otp-input" value={code} onChange={(e) => onCode(e.target.value)} inputMode="numeric"
              autoComplete="one-time-code" maxLength={OTP_LENGTH * 2} aria-label={`${OTP_LENGTH}-digit sign-in code`} disabled={busy} />
            {Array.from({ length: OTP_LENGTH }, (_, i) => (
              <div key={i} className={'otp-box' + (i === Math.min(code.length, OTP_LENGTH - 1) && !busy ? ' active' : '')} aria-hidden>{code[i] ?? ''}</div>
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
