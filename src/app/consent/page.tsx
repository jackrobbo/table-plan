'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Screen from '@/components/Screen';
import { giveConsent, needsConsent } from '@/lib/consent';
import { useProfile } from '@/lib/useProfile';

/** Before we ask for anything about someone's health: say what, why, and get a clear yes. Also where existing accounts agree to the terms. */
export default function Consent() {
  const router = useRouter();
  const { session, profile, ready, update } = useProfile();
  const [health, setHealth] = useState(false);
  const [terms, setTerms] = useState(false);
  const [declined, setDeclined] = useState(false);

  useEffect(() => { if (ready && !session) router.replace('/signin'); }, [ready, session, router]);
  useEffect(() => { if (profile && !needsConsent(profile)) router.replace(profile.completed ? '/plan' : '/onboarding'); }, [profile, router]);

  if (!ready || !profile) return <Screen><div className="skeleton-stack"><div className="skeleton sk-title" /><div className="skeleton sk-card" /></div></Screen>;

  return (
    <Screen footer={<>
      <button className="btn" disabled={!health || !terms} onClick={() => update((p) => giveConsent(p))}>Agree and Continue</button>
      <button className="linkbtn" onClick={() => setDeclined(true)}>I Don&apos;t Agree</button>
    </>}>
      <h2>Before We Start</h2>
      <p className="sub">To plan meals that suit you, Table Plan asks about things the law treats as health information.</p>
      <div className="card">
        <p style={{ marginTop: 0 }}><b>What we ask for</b></p>
        <ul className="plain" style={{ margin: '0 0 10px' }}>
          <li>Any allergies in your household, so no meal with them is ever planned.</li>
          <li>Optionally your height, weight, age and sex, so your calorie and protein target is personal to you. You can skip any of these.</li>
        </ul>
        <p><b>What we do with it</b>: build and size your plan, and nothing else. We never sell it or use it for advertising, and we keep it out of analytics.</p>
        <p style={{ marginBottom: 0 }}><b>You&apos;re in control</b>: change or remove it any time in Settings, download it, withdraw this consent, or delete your account. See our <Link href="/privacy">privacy policy</Link>.</p>
      </div>
      <label className="consent"><input type="checkbox" checked={health} onChange={(e) => setHealth(e.target.checked)} />
        <span>I agree to Table Plan using my health information (allergies and any measurements I give) to plan my meals, as described in the privacy policy.</span></label>
      <label className="consent"><input type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} />
        <span>I&apos;m 18 or over and I agree to the <Link href="/terms">terms of use</Link>.</span></label>
      {declined && (
        <div className="estimate-flag" role="status">
          That&apos;s fine. We can&apos;t plan safe, personal meals without it, so you won&apos;t be able to use Table Plan. Nothing else has been stored. You can sign out, or <Link href="/account">delete your account</Link>.
        </div>
      )}
    </Screen>
  );
}
