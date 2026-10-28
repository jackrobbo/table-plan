'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Screen from '@/components/Screen';
import { DEFAULT_PLAN, PLANS, gbp, perMonth, type PlanId } from '@/lib/billing/config';
import { isMocked } from '@/lib/db';
import { track } from '@/lib/analytics';
import { useAccess } from '@/lib/useAccess';
import { freeBeta } from '@/lib/beta/config';
import { useProfile } from '@/lib/useProfile';

const firstCharge = (days: number) => new Date(Date.now() + days * 864e5).toLocaleDateString('en-GB', { day: 'numeric', month: 'long' });

export default function Subscribe() {
  const router = useRouter();
  const { session, ready } = useProfile();
  const { access, loaded, subscribe } = useAccess(session);
  const [plan, setPlan] = useState<PlanId>(DEFAULT_PLAN);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { if (ready && !session) router.replace('/signin'); }, [ready, session, router]);
  useEffect(() => { if (!freeBeta) track('paywall_viewed'); }, []);
  useEffect(() => { if ((loaded && access) || freeBeta) router.replace('/plan'); }, [loaded, access, router]);

  const cfg = PLANS[plan];
  const go = async () => {
    setBusy(true); setError('');
    try { await subscribe(plan); track('subscribed', { plan, trial: PLANS[plan].trialDays > 0 }); router.replace('/plan'); } catch (e) { setError((e as Error).message || 'Something went wrong.'); setBusy(false); }
  };
  const Card = ({ id, tag, sub }: { id: PlanId; tag?: string; sub: string }) => (
    <button className={'plancard' + (plan === id ? ' on' : '')} role="radio" aria-checked={plan === id} onClick={() => setPlan(id)}>
      {tag && <span className="ptag">{tag}</span>}
      <span className="pname">{id === 'yearly' ? 'Yearly' : 'Monthly'}</span>
      <span className="pprice">{gbp(PLANS[id].pence)}<small>/{PLANS[id].interval}</small></span>
      <span className="muted">{sub}</span>
    </button>
  );

  return (
    <Screen onBack={() => router.push('/plan')} backLabel="Back to my week"
      footer={<>
        <button className="btn" disabled={busy || !loaded} onClick={go}>{cfg.trialDays > 0 ? `Start ${cfg.trialDays}-day free trial` : 'Subscribe and checkout'}</button>
        <p className="fine">
          {cfg.trialDays > 0
            ? `Free for ${cfg.trialDays} days, then ${gbp(cfg.pence)} a ${cfg.interval}. First charge on ${firstCharge(cfg.trialDays)}. Cancel before then and you pay nothing.`
            : `${gbp(cfg.pence)} a ${cfg.interval}, charged today.`}{' '}
          Renews automatically until you cancel. Manage or cancel any time in your account. See the <Link href="/terms">terms</Link>.
        </p>
      </>}>
      <h2>Your Week Is Ready</h2>
      <p className="sub">Unlock your shopping list and a new plan every week.</p>
      <div className="plans" role="radiogroup">
        <Card id="yearly" tag="1 week free" sub={`${perMonth(PLANS.yearly)} a month`} />
        <Card id="monthly" sub="Cancel any time" />
      </div>
      <p className="muted">Less than one meal-prep meal.</p>
      <ul className="benefits">
        <li>A plan every week, built to your calories and protein</li>
        <li>A priced Morrisons shopping list sized to real packs</li>
        <li>Every day kept in your band, with portions resized for you</li>
      </ul>
      {error && <p className="err">{error}</p>}
      {isMocked && <p className="mock">Dev mode: no card is taken and nothing is charged.</p>}
    </Screen>
  );
}
