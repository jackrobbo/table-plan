'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getBackend } from '@/lib/db';
import { computeTargets } from '@/lib/targets';
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

  if (!ready || !profile?.completed || !session) return <p className="muted">Loading…</p>;
  const t = computeTargets(profile.goal ?? 'lose', profile.stats);

  return (
    <>
      <p className="eyebrow">Signed in as {session.email}</p>
      <h1>You&apos;re all set.</h1>
      <p className="muted" style={{ marginTop: 8 }}>Your profile is saved. Your first week is generated in an upcoming release.</p>
      <div className="targets">
        <div className="ticketc"><span className="lbl">Calories</span><span className="big">{t.band[0]}–{t.band[1]}</span></div>
        <div className="ticketc"><span className="lbl">Protein floor</span><span className="big">{t.protein}g</span></div>
      </div>
      <p>Goal: <b>{profile.goal}</b> · Liked meals: <b>{profile.likedRecipes.length}</b>
        {profile.allergies.length > 0 && <> · Allergies: <b>{profile.allergies.join(', ')}</b></>}</p>
      <button className="btn ghost" onClick={() => update((p) => ({ ...p, completed: false, step: 'goal' }))}>Edit onboarding</button>{' '}
      <button className="btn ghost" onClick={async () => { await getBackend().auth.signOut(); router.replace('/'); }}>Sign out</button>
    </>
  );
}
