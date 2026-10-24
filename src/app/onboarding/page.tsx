'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { safeRecipes } from '@/lib/allergens';
import { tierMark } from '@/lib/budget';
import {
  SKIPPABLE, advance, back, canContinue, setAllergies, skipStat, stepIndex, STEPS, swipe, swipeCourses,
  tasteDeck, tasteProgress, MIN_LIKES, type SkippableStep,
} from '@/lib/onboarding';
import type { Profile, MealTime } from '@/lib/profile';
import { computeTargets } from '@/lib/targets';
import { ActivityStep, AgeStep, AllergiesStep, DislikesStep, GoalStep, HeightStep, MealsStep, SexStep, Title, WeightStep, type SP } from '@/components/profile-fields';
import MealImage from '@/components/MealImage';
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
  const cta = step === 'taste' ? 'Finish' : step === 'target' ? 'Pick meals you like' : 'Continue';

  return (
    <Screen onBack={onBack} progress={hasBar ? { step: stepIndex(step) + 1, total: BAR_STEPS } : undefined}
      footer={<>
        <button className="btn" disabled={!ok} onClick={() => { track(step === 'taste' ? 'onboarding_done' : 'onboarding_step', { step }); update(advance); }}>{cta}</button>
        {step === 'allergies' && (
          <button className="linkbtn accent" onClick={() => update((p) => advance({ ...setAllergies(p, []), noAllergies: true }))}>No one has allergies</button>
        )}
        {step === 'dislikes' && <button className="linkbtn" onClick={() => update((p) => advance({ ...p, dislikes: [] }))}>Skip, I eat anything</button>}
        {skippable && (
          <button className="linkbtn" onClick={() => update((p) => advance(skipStat(p, step as SkippableStep)))}>Prefer not to say</button>
        )}
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
      {step === 'taste' && <TasteStep p={profile} update={update} />}
    </Screen>
  );
}

/** The wireframe's segmented bar covers the eight question steps (goal → allergies). */
const BAR_STEPS = 8;

function TargetStep({ p, update }: SP) {
  const t = computeTargets(p.goal ?? 'lose', p.stats);
  const hh = 1 + p.meals.dinner.extraServings;
  return (
    <>
      <Title sub={`Based on your goal and stats. Dinners cook for ${hh}.`}>Your daily target</Title>
      <div className="bignum">
        <div><div className="n">~{t.target.toLocaleString('en-GB')}<small>kcal a day</small></div><div className="muted" style={{ margin: '4px 0 0' }}>band {t.band[0].toLocaleString('en-GB')}–{t.band[1].toLocaleString('en-GB')}</div></div>
        <div><div className="n">≥{t.protein}g<small>protein a day</small></div></div>
        <div className="pair"><div className="n">~{t.carbs}g<small>carbs</small></div><div className="n">~{t.fat}g<small>fat</small></div></div>
      </div>
      {t.estimated && (
        <div className="estimate-flag"><b>This is a general estimate.</b> Without your height, weight, age and sex we can only use a typical number for your goal, so it may be too high or too low for you.
          <button onClick={() => update((x) => ({ ...x, step: 'height' }))}>Add my stats for a personal target</button></div>
      )}
      <div className="note"><b>Steady, not extreme.</b> {t.maintenance ? `Estimated maintenance is ${t.maintenance} kcal. ` : 'Using a sensible default; add your stats for a personal number. '}We never plan below 1,300 kcal.</div>
      <p className="muted">Every day is kept inside this band. Change anything later. Not medical or dietetic advice: talk to your GP before changing your diet if you have a medical condition.</p>
    </>
  );
}

function TasteStep({ p, update }: SP) {
  const courses = swipeCourses(p);
  const [tab, setTab] = useState<MealTime>(courses[0] ?? 'dinner');
  const prog = tasteProgress(p);
  const seen = new Set([...p.likedRecipes, ...p.skippedRecipes]);
  const pool = tasteDeck(safeRecipes(p.allergies).filter((r) => r.c === tab));
  const next = pool.find((r) => !seen.has(r.id));
  const label: Record<MealTime, string> = { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner' };
  return (
    <>
      <Title sub={`Like at least ${MIN_LIKES} of each. Keep going as long as you like; more likes, more variety.`}>What do you like to eat?</Title>
      <div className="tabs">
        {courses.map((c) => (
          <button key={c} className={tab === c ? 'on' : ''} onClick={() => setTab(c)}>{label[c]} {prog[c].liked}/{prog[c].needed}</button>
        ))}
      </div>
      {next ? (
        <>
          <div className="swipecard">
            {next.img ? <MealImage r={next} size="hero" sizes="(max-width: 430px) 100vw, 430px" /> : <div className="photo" aria-hidden>{next.e}</div>}
            <div className="body">
              <span className="kind">{label[tab]}</span>
              <h3>{next.n}</h3>
              <div className="tags">
                <span className="p">P {next.p}g</span><span>{next.k} kcal</span>{tierMark(next.b) && <span title="Cost per portion">{tierMark(next.b)}</span>}{next.serves > 1 && <span>serves {next.serves}</span>}
              </div>
            </div>
          </div>
          <div className="swipebtns">
            <button onClick={() => update((x) => swipe(x, next.id, false))}>Skip</button>
            <button className="keep" onClick={() => update((x) => swipe(x, next.id, true))}>Keep</button>
          </div>
        </>
      ) : (
        <div className="note">
          That&apos;s all the {label[tab].toLowerCase()} options for now.
          {prog[tab].liked < prog[tab].needed && (
            <> You need {prog[tab].needed - prog[tab].liked} more.{' '}
              <button className="linkbtn accent" onClick={() => update((x) => ({ ...x, skippedRecipes: x.skippedRecipes.filter((id) => !pool.some((r) => r.id === id)) }))}>Revisit skipped</button></>
          )}
        </div>
      )}
    </>
  );
}
