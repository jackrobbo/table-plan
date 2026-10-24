'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Screen from '@/components/Screen';
import { PLANS, gbp } from '@/lib/billing/config';
import { getBackend } from '@/lib/db';
import { useAccess } from '@/lib/useAccess';
import { useProfile } from '@/lib/useProfile';

const date = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : '');

export default function Account() {
  const router = useRouter();
  const { session, ready, update } = useProfile();
  const { sub, loaded, access, cancel, resume } = useAccess(session);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => { if (ready && !session) router.replace('/signin'); }, [ready, session, router]);
  if (!ready || !session || !loaded) return <Screen><div className="skeleton-stack"><div className="skeleton sk-title" /><div className="skeleton sk-card" /></div></Screen>;

  const plan = sub.plan ? PLANS[sub.plan] : null;
  const wipe = async () => { await getBackend().profiles.erase(session.userId); await getBackend().auth.signOut(); router.replace('/'); };

  return (
    <Screen onBack={() => router.push('/plan')} backLabel="My week">
      <h2>Account</h2>
      <p className="sub">{session.email}</p>

      <div className="card">
        <h3>Subscription</h3>
        {sub.status === 'none' && <>
          <p className="muted">You don&apos;t have a subscription yet.</p>
          <Link className="btn" href="/subscribe">See plans</Link>
        </>}
        {sub.status !== 'none' && plan && <>
          <p style={{ margin: '6px 0' }}>
            <b>{sub.plan === 'yearly' ? 'Yearly' : 'Monthly'}</b> · {gbp(plan.pence)}/{plan.interval}
            {sub.status === 'trialing' && <span className="pill" style={{ marginLeft: 8 }}>Free trial</span>}
          </p>
          <p className="muted">
            {sub.cancelAtPeriodEnd
              ? `Cancelled. You keep access until ${date(sub.currentPeriodEnd)}, and you won't be charged again.`
              : sub.status === 'trialing' ? `Your trial ends ${date(sub.trialEndsAt)}. Then ${gbp(plan.pence)} a ${plan.interval}.`
              : sub.status === 'past_due' ? 'Your last payment failed. Update your card to keep access.'
              : `Renews ${date(sub.currentPeriodEnd)}.`}
          </p>
          {sub.cancelAtPeriodEnd
            ? <button className="btn ghost" onClick={resume}>Keep my subscription</button>
            : access && <button className="btn ghost" onClick={cancel}>Cancel subscription</button>}
        </>}
      </div>

      <div className="card" style={{ marginTop: 12 }}>
        <h3>Your data</h3>
        <p className="muted">Your height, weight, age and sex are optional and only used to size your target. You can delete everything at any time.</p>
        {!confirmDelete
          ? <button className="btn ghost" onClick={() => setConfirmDelete(true)}>Delete my data</button>
          : <><p className="err">This removes your profile, plans and answers from this device. It can&apos;t be undone.</p>
              <button className="btn" onClick={wipe}>Yes, delete everything</button>
              <button className="linkbtn" onClick={() => setConfirmDelete(false)}>Keep my data</button></>}
      </div>
      <div className="card" style={{ marginTop: 12 }}>
        <h3>Your answers</h3>
        <p className="muted">Go back through the questions to change your goal, stats, meals or allergies. This rebuilds your plan from scratch (smarter edits that keep planned weeks are coming).</p>
        <button className="btn ghost" onClick={() => { update((p) => ({ ...p, completed: false, step: 'goal', weeks: {} })); router.push('/onboarding'); }}>Edit my answers</button>
        <button className="linkbtn" onClick={async () => { await getBackend().auth.signOut(); router.replace('/'); }}>Sign out</button>
      </div>
      <p className="muted" style={{ marginTop: 14 }}>Table Plan gives general nutrition guidance, not medical advice.</p>
    </Screen>
  );
}
