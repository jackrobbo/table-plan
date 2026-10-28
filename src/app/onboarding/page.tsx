'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  SKIPPABLE, advance, back, canContinue, setAllergies, skipStat, stepIndex, type SkippableStep,
} from '@/lib/onboarding';
import { computeTargets } from '@/lib/targets';
import { ActivityStep, AgeStep, AllergiesStep, DislikesStep, GoalStep, HeightStep, MealsStep, SexStep, Title, WeightStep, type SP } from '@/components/profile-fields';
import { Droplet, Drumstick, Flame, Wheat, type LucideIcon } from 'lucide-react';
import CountUp from '@/components/CountUp';
import TasteSwipe from '@/components/TasteSwipe';
import Screen from '@/components/Screen';
import { track } from '@/lib/analytics';
import { needsConsent } from '@/lib/consent';
import { useProfile } from '@/lib/useProfile';


export default function Onboarding() {
  const router = useRouter();
  const { session, profile, ready, update } = useProfile();

  useEffect(() => { if (ready && !session) router.replace('/signin'); }, [ready, session, router]);
  useEffect(() => { if (profile?.completed) router.replace('/plan'); }, [profile?.completed, router]);
  useEffect(() => { if (profile && needsConsent(profile)) router.replace('/consent'); }, [profile, router]);

  if (!ready || !profile) return <Screen><p className="muted">Loading…</p></Screen>;

  const step = profile.step;
  const ok = canContinue(profile, step);
  const skippable = (SKIPPABLE as readonly string[]).includes(step);


  const hasBar = stepIndex(step) < BAR_STEPS;
  const onBack = stepIndex(step) > 0 ? () => update(back) : () => router.push('/');
  const cta = step === 'taste' ? 'Finish' : step === 'target' ? 'Pick Meals You Like' : 'Continue';

  return (
    <Screen onBack={onBack} progress={hasBar ? { step: stepIndex(step) + 1, total: BAR_STEPS } : undefined}
      footer={<>
        <button className="btn" disabled={!ok} onClick={() => { track(step === 'taste' ? 'onboarding_done' : 'onboarding_step', { step }); update(advance); }}>{cta}</button>
        {step === 'allergies' && (
          <button className="linkbtn accent" onClick={() => update((p) => advance({ ...setAllergies(p, []), noAllergies: true }))}>No One Has Allergies</button>
        )}
        {step === 'dislikes' && <button className="linkbtn" onClick={() => update((p) => advance({ ...p, dislikes: [] }))}>Skip, I Eat Anything</button>}
        {skippable && (<>
          <button className="btn ghost" onClick={() => update((p) => advance(skipStat(p, step as SkippableStep)))}>Skip This Question</button>
          <p className="muted skipnote">Skipping uses a typical value, so your targets will be less precise. You can add it later.</p>
        </>)}
      </>}>
      {hasBar && <p className="step">Step {stepIndex(step) + 1} of {BAR_STEPS}</p>}

      {step === 'goal' && <GoalStep p={profile} update={update} />}
      {step === 'height' && <HeightStep p={profile} update={update} />}
      {step === 'weight' && <WeightStep p={profile} update={update} />}
      {step === 'age' && <AgeStep p={profile} update={update} />}
      {step === 'sex' && <SexStep p={profile} update={update} />}
      {step === 'activity' && <ActivityStep p={profile} update={update} />}
      {step === 'meals' && <MealsStep p={profile} update={update} />}
      {step === 'allergies' && <AllergiesStep p={profile} update={update} />}
      {step === 'target' && <TargetStep p={profile} update={update} />}
      {step === 'dislikes' && <DislikesStep p={profile} update={update} />}
      {step === 'taste' && <TasteSwipe p={profile} update={update} onFinish={() => { track('onboarding_done', { step }); update(advance); }} />}
    </Screen>
  );
}

/** The wireframe's segmented bar covers the eight question steps (goal → allergies). */
const BAR_STEPS = 8;

const MI = ({ I, c }: { I: LucideIcon; c: string }) => <span className={'mi ' + c} aria-hidden><I size={20} /></span>;

function TargetStep({ p, update }: SP) {
  const t = computeTargets(p.goal ?? 'lose', p.stats);
  const hh = 1 + p.meals.dinner.extraServings;
  return (
    <>
      <Title sub={`Based on your goal and stats. Dinners cook for ${hh}.`}>Your Daily Target</Title>
      <div className="bignum">
        <div><div className="n m"><MI I={Flame} c="kcal" /><span><CountUp value={t.target} /><small>Calories a Day</small></span></div><div className="muted band" style={{ margin: '4px 0 0' }}>Band <CountUp value={t.band[0]} />–<CountUp value={t.band[1]} /></div></div>
        <div><div className="n m"><MI I={Drumstick} c="protein" /><span><CountUp value={t.protein} delay={150} />g<small>Protein a Day, at Least</small></span></div></div>
        <div className="pair"><div className="n m"><MI I={Wheat} c="carbs" /><span><CountUp value={t.carbs} delay={300} />g<small>Carbs</small></span></div><div className="n m"><MI I={Droplet} c="fat" /><span><CountUp value={t.fat} delay={400} />g<small>Fat</small></span></div></div>
      </div>
      {t.estimated && (
        <div className="estimate-flag"><b>This is a general estimate.</b> Without your height, weight, age and sex we can only use a typical number for your goal, so it may be too high or too low for you.
          <button onClick={() => update((x) => ({ ...x, step: 'height' }))}>Add My Stats for a Personal Target</button></div>
      )}
      <div className="note"><b>Steady, not extreme.</b> {t.maintenance ? `Estimated maintenance is ${t.maintenance} kcal. ` : 'Using a sensible default; add your stats for a personal number. '}We never plan below 1,300 kcal.</div>
      <p className="muted">Every day is kept inside this band. Change anything later. Not medical or dietetic advice: talk to your GP before changing your diet if you have a medical condition.</p>
    </>
  );
}
