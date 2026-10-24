'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getBackend } from '@/lib/db';
import { computeTargets } from '@/lib/targets';
import Screen from '@/components/Screen';
import PriceNote from '@/components/PriceNote';
import { useProfile } from '@/lib/useProfile';

/** Placeholder "This week" screen: shows the saved profile. The planner lands in M4/M5. */
export default function Plan() {
  const router = useRouter();
  const { session, profile, ready, update } = useProfile();

  useEffect(() => {
    if (!ready) return;
    if (!session) router.replace('/signin');
    else if (profile && !profile.completed) router.replace('/onboarding');
  }, [ready, session, profile, router]);

  if (!ready || !profile?.completed || !session) return <Screen><p className="muted">Loading…</p></Screen>;
  const t = computeTargets(profile.goal ?? 'lose', profile.stats);

  return (
    <Screen footer={<>
      <button className="btn ghost" onClick={() => update((p) => ({ ...p, completed: false, step: 'goal' }))}>Edit my answers</button>
      <button className="linkbtn" onClick={async () => { await getBackend().auth.signOut(); router.replace('/'); }}>Sign out</button>
    </>}>
      <p className="step">Signed in as {session.email}</p>
      <h1>You&apos;re all set.</h1>
      <p className="sub">Your profile is saved. Your first week is generated in an upcoming release.</p>
      <div className="bignum">
        <div><div className="n">{t.band[0].toLocaleString('en-GB')}–{t.band[1].toLocaleString('en-GB')}<small>kcal a day</small></div></div>
        <div><div className="n">≥{t.protein}g<small>protein</small></div></div>
      </div>
      <p className="muted" style={{ marginTop: 14 }}>
        {profile.likedRecipes.length} liked meals{profile.allergies.length > 0 && <> · allergies: {profile.allergies.join(', ')}</>}
      </p>
      <PriceNote />
    </Screen>
  );
}
