'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Screen from '@/components/Screen';
import { ActivityStep, AgeStep, AllergiesStep, DislikesStep, GoalStep, HeightStep, MealsStep, Plain, SexStep, WeightStep } from '@/components/profile-fields';
import { BUDGETS, BUDGET_LABEL, budgetHelp } from '@/lib/budget';
import { weekLabel } from '@/lib/cycle/dates';
import { effectiveStatus, savePlan } from '@/lib/cycle/week';
import { STAT_STEPS, answerProblems, answersChanged, applyAnswers, coursesNeedingLikes, targetsDiffer } from '@/lib/answers';
import { setAllergies, skipStat, swipeCourses, tasteProgress } from '@/lib/onboarding';
import { planInputFrom } from '@/lib/planner/fromProfile';
import { planWeek } from '@/lib/planner/solve';
import type { Profile } from '@/lib/profile';
import { computeTargets } from '@/lib/targets';
import { useNow } from '@/lib/useNow';
import { useProfile } from '@/lib/useProfile';

const kcal = (n: number) => n.toLocaleString('en-GB');

/** Change your answers without losing your plan: edits stay local until Save, and planned weeks only change if you rebuild them. */
export default function Settings() {
  const router = useRouter();
  const now = useNow();
  const { session, profile, ready, update } = useProfile();
  const [draft, setDraft] = useState<Profile | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [rebuilt, setRebuilt] = useState<string[]>([]);

  useEffect(() => { if (ready && !session) router.replace('/signin'); }, [ready, session, router]);
  useEffect(() => { if (ready && profile && !profile.completed) router.replace('/onboarding'); }, [ready, profile, router]);
  useEffect(() => { if (profile && !draft) setDraft(profile); }, [profile, draft]);

  if (!ready || !profile || !draft) return <Screen><div className="skeleton-stack"><div className="skeleton sk-title" /><div className="skeleton sk-card" /></div></Screen>;

  const d = draft;
  const edit = (fn: (p: Profile) => Profile) => { setDraft((x) => (x ? fn(x) : x)); setSaved(false); };
  const dirty = answersChanged(d, profile);
  const t = computeTargets(d.goal ?? 'lose', d.stats);
  const was = computeTargets(profile.goal ?? 'lose', profile.stats);
  const targetChanged = targetsDiffer(d, profile);
  const prog = tasteProgress(d);
  const short = coursesNeedingLikes(d);
  const problems = answerProblems(d);

  const save = () => { update((p) => applyAnswers(p, d)); setSaved(true); };
  const saveAndPick = () => { update((p) => ({ ...applyAnswers(p, d), completed: false, step: 'taste' })); router.push('/onboarding'); };

  const rebuildable = Object.values(profile.weeks)
    .filter((w) => w.plan && ['planned', 'shopped'].includes(effectiveStatus(profile.weeks, w, now)))
    .sort((a, b) => a.start.localeCompare(b.start));
  const rebuild = (start: string) => {
    setBusy(start);
    // Let the busy state paint first: the planner blocks the main thread for a moment.
    setTimeout(() => {
      update((p) => ({ ...p, weeks: savePlan(p.weeks, start, planWeek(planInputFrom(p))) }));
      setRebuilt((r) => [...r, start]);
      setBusy(null);
    }, 60);
  };

  const hasStats = STAT_STEPS.some((s) => !d.skipped[s]);
  const removeStats = () => edit((x) => STAT_STEPS.reduce((acc, s) => skipStat(acc, s), x));

  return (
    <Screen onBack={() => router.push('/account')} backLabel="Account"
      footer={<>
        {short.length > 0
          ? <button className="btn" disabled={problems.length > 0} onClick={saveAndPick}>Save, then pick a few more meals you like</button>
          : <button className="btn" disabled={!dirty || problems.length > 0} onClick={save}>{saved && !dirty ? 'Saved' : 'Save changes'}</button>}
        {dirty && <button className="linkbtn" onClick={() => { setDraft(profile); setSaved(false); }}>Discard changes</button>}
      </>}>
      <h2>Your answers</h2>
      <p className="sub">Change anything here. Your planned weeks stay as they are unless you rebuild them below.</p>

      <div className="card" role="status">
        <h3>Daily target</h3>
        <p style={{ margin: '6px 0 0' }}><b>{kcal(t.band[0])}–{kcal(t.band[1])} kcal</b> · ≥{t.protein}g protein</p>
        {targetChanged && <p className="muted" style={{ margin: '4px 0 0' }}>Was {kcal(was.band[0])}–{kcal(was.band[1])} kcal · ≥{was.protein}g protein</p>}
        {t.estimated && <p className="muted" style={{ margin: '4px 0 0' }}>A typical number for your goal: add your height, weight, age and sex for a personal one.</p>}
      </div>

      <Plain.Provider value>
        <div className="compact">
        <Section title="Goal"><GoalStep p={d} update={edit} /></Section>
        <Section title="About you">
          <p className="muted" style={{ marginTop: 0 }}>Private, and only used to size your target.</p>
          <h4 className="sub-title">Height</h4><HeightStep p={d} update={edit} />
          <h4 className="sub-title">Weight</h4><WeightStep p={d} update={edit} />
          <h4 className="sub-title">Age</h4><AgeStep p={d} update={edit} />
          <h4 className="sub-title">Sex</h4><SexStep p={d} update={edit} />
          <h4 className="sub-title">Activity</h4><ActivityStep p={d} update={edit} />
          {hasStats && <button className="linkbtn" onClick={removeStats}>Remove my height, weight, age and sex</button>}
        </Section>
        <Section title="Meals"><MealsStep p={d} update={edit} /></Section>
        <Section title="Allergies">
          <AllergiesStep p={d} update={edit} />
          <button className={'chip lg' + (d.noAllergies ? ' on' : '')} aria-pressed={d.noAllergies} onClick={() => edit((x) => ({ ...setAllergies(x, []), noAllergies: true }))}>No one has allergies</button>
        </Section>
        <Section title="Dislikes"><DislikesStep p={d} update={edit} /></Section>
        </div>
      </Plain.Provider>

      <Section title="Weekly spend">
        <div className="chips" role="group" aria-label="Weekly spend">
          {BUDGETS.map((b) => (
            <button key={b} className={'chip lg' + (d.budget === b ? ' on' : '')} aria-pressed={d.budget === b} onClick={() => edit((x) => ({ ...x, budget: b }))}>{BUDGET_LABEL[b]}</button>
          ))}
        </div>
        <p className="muted">{budgetHelp(d.budget)}</p>
      </Section>

      <Section title="Meals you like">
        <p className="muted" style={{ marginTop: 0 }}>
          {(['breakfast', 'lunch', 'dinner'] as const).filter((m) => d.meals[m].mode === 'plan').map((m) => `${prog[m].liked} ${m}${prog[m].liked === 1 ? '' : 's'}`).join(' · ') || 'No planned meals'} kept.
        </p>
        {short.length > 0 && <div className="estimate-flag">You need to keep a few more {short.join(' and ')} before we can plan them. Save, and we&apos;ll take you to pick.</div>}
        {short.length === 0 && !dirty && (
          <button className="btn ghost" onClick={() => { update((p) => ({ ...p, completed: false, step: 'taste' })); router.push('/onboarding'); }}>Review my meal choices</button>
        )}
      </Section>

      {problems.length > 0 && <div className="estimate-flag">{problems.map((x) => <div key={x}>{x}</div>)}</div>}

      <Section title="Planned weeks">
        {rebuildable.length === 0 ? <p className="muted" style={{ marginTop: 0 }}>No planned weeks to rebuild.</p> : <>
          <p className="muted" style={{ marginTop: 0 }}>Saved changes apply to weeks you plan from now on. To use them on a week you&apos;ve already planned, rebuild it: its meals and shopping list are replaced.</p>
          {rebuildable.map((w) => (
            <div className="line" key={w.start}>
              <div className="lbody"><b>{weekLabel(w.start)}</b><div className="muted">{rebuilt.includes(w.start) ? 'Rebuilt with your saved answers.' : 'Planned'}</div></div>
              <button className="btn ghost inline small" disabled={dirty || busy !== null} onClick={() => rebuild(w.start)}>{busy === w.start ? 'Building…' : 'Rebuild'}</button>
            </div>
          ))}
          {dirty && <p className="muted">Save your changes first.</p>}
        </>}
      </Section>

      <p className="muted" style={{ marginTop: 14 }}>Want to begin again from the first question? <Link href="/account">Account</Link> has that, and it clears your planned weeks.</p>
    </Screen>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="card" style={{ marginTop: 12 }}><h3>{title}</h3>{children}</div>;
}
