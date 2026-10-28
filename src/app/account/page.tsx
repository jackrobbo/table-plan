'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Screen from '@/components/Screen';
import { PLANS, gbp } from '@/lib/billing/config';
import { getBackend } from '@/lib/db';
import { useAccess } from '@/lib/useAccess';
import { freeBeta } from '@/lib/beta/config';
import { useProfile } from '@/lib/useProfile';

const date = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : '');

export default function Account() {
  const router = useRouter();
  const { session, ready, update } = useProfile();
  const { sub, loaded, access, cancel, resume } = useAccess(session);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmRestart, setConfirmRestart] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [exportState, setExportState] = useState<'idle' | 'working' | 'done' | string>('idle');
  const [fb, setFb] = useState('');
  const [fbState, setFbState] = useState<'idle' | 'sent' | string>('idle');

  useEffect(() => { if (ready && !session) router.replace('/signin'); }, [ready, session, router]);
  if (!ready || !session || !loaded) return <Screen><div className="skeleton-stack"><div className="skeleton sk-title" /><div className="skeleton sk-card" /></div></Screen>;

  const plan = sub.plan ? PLANS[sub.plan] : null;
  const sendFeedback = async () => {
    try {
      const r = await fetch('/api/feedback', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ message: fb, page: 'account' }) });
      const j = (await r.json()) as { error?: string };
      if (r.ok) { setFbState('sent'); setFb(''); } else setFbState(j.error ?? 'Could not send feedback.');
    } catch { setFbState('Could not send feedback. Check your connection.'); }
  };
  const wipe = async () => {
    setDeleting(true); setDeleteError(null);
    try { await getBackend().account.deleteAccount(session.userId); router.replace('/'); }
    catch (e) { setDeleteError(e instanceof Error ? e.message : 'Could not delete your account. Try again.'); setDeleting(false); }
  };
  const download = async () => {
    setExportState('working');
    try {
      const json = await getBackend().account.exportData(session.userId);
      const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
      const a = Object.assign(document.createElement('a'), { href: url, download: 'table-plan-data.json' });
      document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
      setExportState('done');
    } catch (e) { setExportState(e instanceof Error ? e.message : 'Could not prepare your data. Try again.'); }
  };

  return (
    <Screen onBack={() => router.push('/plan')} backLabel="My week">
      <h2>Account</h2>
      <p className="sub">{session.email}</p>

      <div className="card">
        <h3>Subscription</h3>
        {freeBeta && sub.status === 'none' && <p className="muted">Table Plan is free while it&apos;s in beta. We&apos;ll tell you well before that changes, and you won&apos;t be charged without choosing a plan.</p>}
        {!freeBeta && sub.status === 'none' && <>
          <p className="muted">You don&apos;t have a subscription yet.</p>
          <Link className="btn" href="/subscribe">See Plans</Link>
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
            ? <button className="btn ghost" onClick={resume}>Keep My Subscription</button>
            : access && <button className="btn ghost" onClick={cancel}>Cancel Subscription</button>}
        </>}
      </div>

      <div className="card" style={{ marginTop: 12 }}>
        <h3>Feedback</h3>
        <p className="muted">Something confusing, wrong or missing? Tell us. We read every message.</p>
        <textarea className="copybox" style={{ minHeight: 90, fontFamily: 'inherit', fontSize: 15 }} aria-label="Your feedback" value={fb} onChange={(e) => { setFb(e.target.value); setFbState('idle'); }} />
        <button className="btn ghost" style={{ marginTop: 8 }} disabled={fb.trim().length < 3} onClick={sendFeedback}>Send Feedback</button>
        {fbState === 'sent' && <p className="muted" role="status">Thanks, that&apos;s sent.</p>}
        {fbState !== 'idle' && fbState !== 'sent' && <p className="err">{fbState}</p>}
      </div>

      <div className="card" style={{ marginTop: 12 }}>
        <h3>Your Data</h3>
        <p className="muted">Your height, weight, age and sex are optional and only used to size your target. You can take a copy of everything we hold, or delete it, at any time.</p>
        <button className="btn ghost" disabled={exportState === 'working'} onClick={download}>{exportState === 'working' ? 'Preparing…' : 'Download my data'}</button>
        {exportState === 'done' && <p className="muted" role="status">Saved as table-plan-data.json.</p>}
        {exportState !== 'idle' && exportState !== 'done' && exportState !== 'working' && <p className="err">{exportState}</p>}
        {!confirmDelete
          ? <button className="linkbtn" onClick={() => setConfirmDelete(true)}>Delete My Account</button>
          : <><p className="err">This cancels your subscription and permanently deletes your account, plans, answers and feedback. Stripe keeps the payment records the law requires. It can&apos;t be undone.</p>
              {deleteError && <p className="err" role="alert">{deleteError}</p>}
              <button className="btn" disabled={deleting} onClick={wipe}>{deleting ? 'Deleting…' : 'Yes, delete everything'}</button>
              <button className="linkbtn" disabled={deleting} onClick={() => { setConfirmDelete(false); setDeleteError(null); }}>Keep My Account</button></>}
      </div>
      <div className="card" style={{ marginTop: 12 }}>
        <h3>Your Answers</h3>
        <p className="muted">Change your goal, stats, meals, allergies, dislikes or spend. Your planned weeks stay as they are unless you choose to rebuild them.</p>
        <Link className="btn ghost" href="/settings">Change My Answers</Link>
        {!confirmRestart
          ? <button className="linkbtn" onClick={() => setConfirmRestart(true)}>Start Again From the First Question</button>
          : <><p className="err">This clears your planned weeks and takes you back to the first question.</p>
              <button className="btn" onClick={() => { update((p) => ({ ...p, completed: false, step: 'goal', weeks: {} })); router.push('/onboarding'); }}>Yes, Start Again</button>
              <button className="linkbtn" onClick={() => setConfirmRestart(false)}>Keep My Plan</button></>}
        <button className="linkbtn" onClick={async () => { await getBackend().auth.signOut(); router.replace('/'); }}>Sign Out</button>
      </div>
      <p className="muted" style={{ marginTop: 14 }}>Table Plan gives general nutrition guidance, not medical advice. <Link href="/privacy">Privacy</Link> · <Link href="/terms">Terms</Link></p>
    </Screen>
  );
}
