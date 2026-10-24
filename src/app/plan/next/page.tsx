'use client';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import PriceNote from '@/components/PriceNote';
import InstallSheet from '@/components/InstallSheet';
import Screen from '@/components/Screen';
import { DayCard, ShoppingList, listAsText } from '@/components/week';
import { PRICES_META, RECIPES } from '@/data';
import { safeRecipes } from '@/lib/allergens';
import { addDays, dayLabel, weekLabel } from '@/lib/cycle/dates';
import { ensureWeeks, saveList, savePlan, saveProgress, snapshot, type Week } from '@/lib/cycle/week';
import { BUDGETS, BUDGET_LABEL, budgetHelp, tierMark } from '@/lib/budget';
import { planInputFrom } from '@/lib/planner/fromProfile';
import { buildShopping } from '@/lib/planner/shopping';
import { explainMisses, planWeek } from '@/lib/planner/solve';
import type { Plan } from '@/lib/planner/types';
import type { MealTime } from '@/lib/profile';
import { shortDate } from '@/lib/pricing/refresh';
import { computeTargets } from '@/lib/targets';
import { track } from '@/lib/analytics';
import { useAccess } from '@/lib/useAccess';
import { useNow } from '@/lib/useNow';
import { useProfile } from '@/lib/useProfile';

type Step = 'setup' | 'pick' | 'review' | 'list' | 'saved';
const STEPS: Step[] = ['setup', 'pick', 'review', 'list', 'saved'];
const BAR = ['Set up', 'Pick', 'Review', 'List'];
const COURSES: MealTime[] = ['breakfast', 'lunch', 'dinner'];
const LABEL: Record<MealTime, string> = { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner' };
const MIN_PICKS = 3;

/** "Plan next week": Set up → Pick → Review → List. Picks are saved as you go so you can finish later. */
export default function PlanNext() {
  const router = useRouter();
  const now = useNow();
  const { session, profile, ready, update } = useProfile();
  const { access, loaded: accessLoaded } = useAccess(session);
  const [step, setStep] = useState<Step>('setup');
  const [draft, setDraft] = useState<Plan | null>(null);
  const [have, setHave] = useState<string[]>([]);
  const [copied, setCopied] = useState<string | null>(null);

  const snap = useMemo(() => (profile ? snapshot(ensureWeeks(profile.weeks, now), now) : null), [profile, now]);
  // After saving, the week is no longer "to plan"; keep showing it on the confirmation step.
  const [saved, setSaved] = useState<Week | null>(null);
  const week = saved ?? snap?.toPlan ?? null;

  useEffect(() => {
    if (!ready) return;
    if (!session) router.replace('/signin');
    else if (profile && !profile.completed) router.replace('/onboarding');
    else if (accessLoaded && !access && step !== 'saved') router.replace('/subscribe');
    else if (snap && !week) router.replace('/plan');
  }, [ready, session, profile, snap, week, router, accessLoaded, access, step]);

  if (!ready || !profile || !week) return <Screen><div className="skeleton-stack"><div className="skeleton sk-title" /><div className="skeleton sk-card" /></div></Screen>;

  const t = computeTargets(profile.goal ?? 'lose', profile.stats);
  const planned = COURSES.filter((c) => profile.meals[c].mode === 'plan');
  const picks = week.picks;
  const safe = safeRecipes(profile.allergies).filter((r) => profile.likedRecipes.includes(r.id));
  const needed = (c: MealTime) => Math.min(MIN_PICKS, safe.filter((r) => r.c === c).length);
  const have_ = (c: MealTime) => picks.filter((id) => RECIPES.find((r) => r.id === id)?.c === c).length;
  const picksOk = planned.every((c) => have_(c) >= needed(c));

  const build = (liked: string[]) => {
    // Meals the person picked by hand are never capped by the spend setting; auto-picked ones are.
    const input = { ...planInputFrom(profile), liked, ...(liked === profile.likedRecipes ? {} : { budget: 'high' as const }) };
    const built = planWeek(input, 24, Math.floor(Math.random() * 1e6));
    track('week_generated', { days_in_band: built.days.filter((d) => d.inBand).length, mode: liked === profile.likedRecipes ? 'auto' : 'own' });
    setDraft(built);
    setStep('review');
  };
  const togglePick = (id: string) =>
    update((p) => {
      const w = p.weeks[week.start] ?? week;
      const next = w.picks.includes(id) ? w.picks.filter((x) => x !== id) : [...w.picks, id];
      return { ...p, weeks: saveProgress(ensureWeeks(p.weeks, now), week.start, next) };
    });
  const save = () => {
    if (!draft) return;
    update((p) => ({ ...p, weeks: saveList(savePlan(ensureWeeks(p.weeks, now), week.start, draft), week.start, have, 'notes') }));
    track('week_planned', { days: draft.days.length });
    track('list_saved', { items: shopping?.lines.length ?? 0 });
    setSaved(week);
    setStep('saved');
  };
  const barIndex = Math.min(STEPS.indexOf(step), 3);
  const shopping = draft?.days.length ? buildShopping(draft) : null;
  const back = () => (step === 'setup' ? router.push('/plan') : step === 'pick' ? setStep('setup') : step === 'review' ? setStep(picks.length ? 'pick' : 'setup') : step === 'list' ? setStep('review') : router.push('/plan'));

  return (
    <Screen onBack={step === 'saved' ? undefined : back}
      progress={step === 'saved' ? undefined : { step: barIndex + 1, total: BAR.length }}
      footer={
        step === 'pick' ? <button className="btn" disabled={!picksOk} onClick={() => build(picks)}>Build my week</button>
        : step === 'review' && draft?.days.length ? <button className="btn" onClick={() => { setHave([]); setStep('list'); }}>Save and continue</button>
        : step === 'list' ? <button className="btn" onClick={save}>Save list · {shopping!.lines.length - have.length} items</button>
        : step === 'saved' ? <button className="btn" onClick={() => router.push('/plan')}>Done</button> : undefined
      }>
      {step !== 'saved' && <p className="step">{BAR[barIndex]} · Plan {weekLabel(week.start)}</p>}

      {step === 'setup' && (
        <div className="fade">
          <h2>Same settings as usual?</h2>
          <p className="sub">Pick by midnight Sun {dayLabel(addDays(week.start, -1))}. Cooking starts Mon {dayLabel(week.start)}.</p>
          <div className="card list">
            {COURSES.map((c) => (
              <div className="line" key={c}><div className="lbody"><b>{LABEL[c]}</b>
                <div className="muted">{profile.meals[c].mode === 'plan' ? (profile.meals[c].extraServings ? `You + ${profile.meals[c].extraServings}` : 'Just you') : 'Macros only'}</div></div></div>
            ))}
            <div className="line"><div className="lbody"><b>Daily target</b><div className="muted">{t.band[0].toLocaleString('en-GB')}–{t.band[1].toLocaleString('en-GB')} kcal · ≥{t.protein}g protein</div></div></div>
            <div className="line"><div className="lbody"><b>Cooking days</b><div className="muted">Mon–Fri</div></div></div>
          </div>
          <h3 style={{ marginTop: 18 }}>Weekly spend</h3>
          <div className="chips" role="group" aria-label="Weekly spend">
            {BUDGETS.map((b) => (
              <button key={b} className={'chip lg' + (profile.budget === b ? ' on' : '')} aria-pressed={profile.budget === b} onClick={() => update((p) => ({ ...p, budget: b }))}>{BUDGET_LABEL[b]}</button>
            ))}
          </div>
          <p className="muted" style={{ marginTop: -4 }}>{budgetHelp(profile.budget)} We only go over this on a day that can&apos;t hit your targets without it.</p>
          <p className="muted">To change your meals or targets, edit your answers from the home screen. New settings apply from the next week still to plan.</p>
          <button className="btn" onClick={() => build(profile.likedRecipes)}>Pick for me</button>
          <button className="btn ghost" style={{ marginTop: 8 }} onClick={() => setStep('pick')}>Pick my own (optional)</button>
        </div>
      )}

      {step === 'pick' && (
        <div className="fade">
          <h2>Pick your own</h2>
          <p className="sub">Choose at least {MIN_PICKS} of each from meals you like. We&apos;ll plan the days around them and fill in snacks.</p>
          {planned.map((c) => (
            <div key={c}>
              <div className="coursehead"><h3>{LABEL[c]}</h3><span className={'need' + (have_(c) >= needed(c) ? ' ok' : '')}>{have_(c)} picked · need {needed(c)}</span></div>
              <div className="rgrid">
                {safe.filter((r) => r.c === c).map((r) => (
                  <button key={r.id} className={'rcard' + (picks.includes(r.id) ? ' on' : '')} aria-pressed={picks.includes(r.id)} onClick={() => togglePick(r.id)}>
                    <span className="emoji">{r.e}</span><span className="nm">{r.n}</span><span className="muted">{r.p}g · {r.k} kcal · {tierMark(r.b)}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {step === 'review' && (
        <div className="fade">
          <h1>Your week</h1>
          {!draft || !draft.days.length ? (
            <div className="estimate-flag">{draft?.issues[0] ?? 'Could not build a week.'}</div>
          ) : (<>
            <p className="sub">{draft.days.filter((d) => d.inBand).length} of {draft.days.length} days in band. Resized or topped-up days are highlighted.</p>
            {explainMisses(draft.days, t.band, t.protein).map((i) => <div key={i} className="estimate-flag">{i}</div>)}
            {draft.notes?.map((n) => <p key={n} className="muted">{n}</p>)}
            {shopping && <PriceNote totalPence={shopping.totalPence} />}
            {draft.days.map((d, i) => <DayCard key={d.day} d={d} index={i} label={dayLabel(addDays(week.start, i))} />)}
            <button className="btn ghost" onClick={() => build(picks.length ? picks : profile.likedRecipes)}>Shuffle</button>
          </>)}
        </div>
      )}

      {step === 'list' && shopping && (
        <div className="fade">
          <h2>Ingredients</h2>
          <p className="sub">Everything is ticked. Untick what you already have.</p>
          <PriceNote totalPence={shopping.lines.filter((l) => !have.includes(l.key)).reduce((a, l) => a + l.costPence, 0)} />
          <ShoppingList shopping={shopping} have={have} onToggle={(k) => setHave((h) => (h.includes(k) ? h.filter((x) => x !== k) : [...h, k]))} />
          <div className="note"><b>Store cupboard check.</b> Buy only if you&apos;re out:<br />{shopping.cupboard.join(' · ')}</div>
        </div>
      )}

      {step === 'saved' && draft && (
        <div className="fade">
          <h1>List saved</h1>
          <p className="sub">{weekLabel(week.start)} is planned. It starts Mon {dayLabel(week.start)}.</p>
          <button className="btn ghost" onClick={async () => {
            try { await navigator.clipboard.writeText(listAsText(draft, have, `Estimated Morrisons prices, checked ${PRICES_META.checkedAt ? shortDate(PRICES_META.checkedAt) : 'not yet'}`)); setCopied('ok'); } catch { setCopied('fail'); }
          }}>Save to Notes (copy list)</button>
          {copied === 'ok' && <p className="muted" role="status">Copied. Paste it into Notes.</p>}
          {copied === 'fail' && <textarea className="copybox" readOnly onFocus={(e) => e.currentTarget.select()} value={listAsText(draft, have, 'Estimated Morrisons prices')} />}
        </div>
      )}

      <InstallSheet when={step === 'saved'} />
    </Screen>
  );
}
