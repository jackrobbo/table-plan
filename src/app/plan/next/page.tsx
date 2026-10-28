'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import SwapSheet from '@/components/SwapSheet';
import PriceNote from '@/components/PriceNote';
import InstallSheet from '@/components/InstallSheet';
import { CheckoutBar, ListStepBody } from '@/components/ListStep';
import BuildingWeek from '@/components/BuildingWeek';
import TasteRefresh from '@/components/TasteRefresh';
import ReminderSheet from '@/components/ReminderSheet';
import MealImage from '@/components/MealImage';
import Screen from '@/components/Screen';
import { DayCard, listAsText } from '@/components/week';
import { PRICES_META, RECIPES } from '@/data';
import { safeRecipes } from '@/lib/allergens';
import { addDays, dayLabel, weekLabel } from '@/lib/cycle/dates';
import { ensureWeeks, saveList, savePlan, saveProgress, snapshot, type Week } from '@/lib/cycle/week';
import { BUDGETS, BUDGET_LABEL, budgetHelp, tierMark } from '@/lib/budget';
import { planInputFrom } from '@/lib/planner/fromProfile';
import { applySwap } from '@/lib/planner/swap';
import { isNewForYou } from '@/lib/taste';
import { swipe } from '@/lib/onboarding';
import { buildShopping } from '@/lib/planner/shopping';
import { explainMisses, planWeek } from '@/lib/planner/solve';
import type { Plan } from '@/lib/planner/types';
import type { MealTime } from '@/lib/profile';
import { shortDate } from '@/lib/pricing/refresh';
import { computeTargets } from '@/lib/targets';
import { track } from '@/lib/analytics';
import { needsConsent } from '@/lib/consent';
import { useAccess } from '@/lib/useAccess';
import { useNow } from '@/lib/useNow';
import { useProfile } from '@/lib/useProfile';

type Step = 'setup' | 'pick' | 'review' | 'list' | 'saved';
const STEPS: Step[] = ['setup', 'pick', 'review', 'list', 'saved'];
const BAR = ['Set up', 'Taste', 'Review', 'List'];
const COURSES: MealTime[] = ['breakfast', 'lunch', 'dinner'];
const LABEL: Record<MealTime, string> = { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner' };

/** "Plan next week": Set up → Taste (optional refresh) → Review → List. */
export default function PlanNext() {
  const router = useRouter();
  const now = useNow();
  const { session, profile, ready, update } = useProfile();
  const { access, loaded: accessLoaded } = useAccess(session);
  const [step, setStep] = useState<Step>('setup');
  const [draft, setDraft] = useState<Plan | null>(null);
  const [have, setHave] = useState<string[]>([]);
  const [visitedTaste, setVisitedTaste] = useState(false);
  const [want, setWant] = useState<string[]>([]);
  const [copied, setCopied] = useState<string | null>(null);
  const [building, setBuilding] = useState(false);
  const buildDone = useCallback(() => setBuilding(false), []);
  const [swap, setSwap] = useState<{ day: number; meal: number } | null>(null);
  const [daysOff, setDaysOff] = useState<number[]>([]);
  const [leaving, setLeaving] = useState(false);

  const snap = useMemo(() => (profile ? snapshot(ensureWeeks(profile.weeks, now), now) : null), [profile, now]);
  // After saving, the week is no longer "to plan"; keep showing it on the confirmation step.
  const [saved, setSaved] = useState<Week | null>(null);
  const week = saved ?? snap?.toPlan ?? null;

  useEffect(() => {
    if (!ready) return;
    if (!session) router.replace('/signin');
    else if (profile && needsConsent(profile)) router.replace('/consent');
    else if (profile && !profile.completed) router.replace('/onboarding');
    else if (accessLoaded && !access && step !== 'saved') router.replace('/subscribe');
    else if (snap && !week) router.replace('/plan');
  }, [ready, session, profile, snap, week, router, accessLoaded, access, step]);

  if (!ready || !profile || !week) return <Screen><div className="skeleton-stack"><div className="skeleton sk-title" /><div className="skeleton sk-card" /></div></Screen>;

  const t = computeTargets(profile.goal ?? 'lose', profile.stats);
  const planned = COURSES.filter((c) => profile.meals[c].mode === 'plan');
  const picks = week.picks;
  const safe = safeRecipes(profile.allergies).filter((r) => profile.likedRecipes.includes(r.id));
  // How many earlier weeks each meal was planned in (this week excluded).
  const past: Record<string, number> = {};
  for (const w of Object.values(profile.weeks)) if (w.start !== week.start && w.plan) new Set(w.plan.days.flatMap((d) => d.meals.map((m) => m.recipeId))).forEach((id) => { past[id] = (past[id] ?? 0) + 1; });
  const safe2 = safeRecipes(profile.allergies);

  const build = (liked: string[]) => {
    if (building) return;
    setBuilding(true);
    // Let the "building" state paint first: the planner blocks the main thread for a moment.
    setTimeout(() => {
      // Meals the person picked by hand are never capped by the spend setting; auto-picked ones are.
      const input = { ...planInputFrom(profile), liked, daysOff, ...(liked === profile.likedRecipes ? {} : { budget: 'high' as const, explore: false }) };
      const built = planWeek(input, 24, Math.floor(Math.random() * 1e6));
      track('week_generated', { days_in_band: built.days.filter((d) => d.inBand).length, mode: liked === profile.likedRecipes ? 'auto' : 'own' });
      setDraft(built);
      setStep('review');   // the animation keeps the screen until it finishes, then BuildingWeek's onDone reveals the review
    }, 60);
  };
  const save = () => {
    if (!draft) return;
    update((p) => ({ ...p, weeks: saveList(savePlan(ensureWeeks(p.weeks, now), week.start, draft), week.start, have, 'notes') }));
    track('week_planned', { days: draft.days.length });
    track('list_saved', { items: shopping?.lines.length ?? 0 });
    setSaved(week);
    setStep('saved');
  };
  const copyList = async () => {
    if (!draft) return;
    const text = listAsText(draft, have, `Estimated Morrisons prices, checked ${PRICES_META.checkedAt ? shortDate(PRICES_META.checkedAt) : 'not yet'}`, want);
    try { await navigator.clipboard.writeText(text); setCopied('ok'); setTimeout(() => setCopied(null), 2500); } catch { setCopied('fail'); }
  };
  // Saving and checking out are one tap: save the week, then ask the (now mounted) list to start the checkout.
  const saveAndCheckout = () => { save(); setTimeout(() => window.dispatchEvent(new Event('tp:checkout')), 350); };
  const toggleHave = (k: string) => setHave((h) => (h.includes(k) ? h.filter((x) => x !== k) : [...h, k]));
  const toggleWant = (k: string) => setWant((w) => (w.includes(k) ? w.filter((x) => x !== k) : [...w, k]));
  const barIndex = Math.min(STEPS.indexOf(step), 3);
  const shopping = draft?.days.length ? buildShopping(draft) : null;
  // Leaving with picks or a built-but-unsaved week asks first (picks are kept either way; an unsaved week is not).
  const exit = () => ((draft?.days.length || picks.length > 0) && step !== 'saved' ? setLeaving(true) : router.push('/plan'));
  const back = () => (step === 'setup' ? exit() : step === 'pick' ? setStep('setup') : step === 'review' ? setStep(visitedTaste ? 'pick' : 'setup') : step === 'list' ? setStep('review') : exit());

  return (
    <Screen onBack={step === 'saved' || building ? undefined : back}
      progress={step === 'saved' ? undefined : { step: barIndex + 1, total: BAR.length }}
      footer={
        building ? undefined
        : step === 'pick' ? <button className="btn" onClick={() => build(profile.likedRecipes)}>Build My Week</button>
        : step === 'review' && draft?.days.length ? <button className="btn" onClick={() => { setHave([]); setStep('list'); }}>Save and Continue</button>
        : step === 'list' ? <CheckoutBar onCopy={copyList} copied={copied === 'ok'} onCheckout={saveAndCheckout} />
        : step === 'saved' ? <><CheckoutBar onCopy={copyList} copied={copied === 'ok'} /><button className="linkbtn" onClick={() => router.push('/plan')}>Done</button></> : undefined
      }>
      {building && <BuildingWeek onDone={buildDone} />}
      {!building && step !== 'saved' && <p className="step">{BAR[barIndex]} · Plan {weekLabel(week.start)}</p>}

      {!building && step === 'setup' && (
        <div className="fade">
          <h2>Same Settings as Usual?</h2>
          <p className="sub">Pick by midnight Sun {dayLabel(addDays(week.start, -1))}. Cooking starts Mon {dayLabel(week.start)}.</p>
          <div className="card list">
            {COURSES.map((c) => {
              const m = profile.meals[c];
              const set = (patch: Partial<typeof m>) => update((x) => ({ ...x, meals: { ...x.meals, [c]: { ...x.meals[c], ...patch } } }));
              return (
                <div className="line setupmeal" key={c}>
                  <div className="lbody">
                    <div className="top"><b>{LABEL[c]}</b>
                      <div className="seg2 small" role="group" aria-label={`${LABEL[c]} mode`}>
                        <button className={m.mode === 'plan' ? 'on' : ''} onClick={() => set({ mode: 'plan' })}>Plan It</button>
                        <button className={m.mode === 'macros' ? 'on' : ''} onClick={() => set({ mode: 'macros', extraServings: 0 })}>Macros Only</button>
                      </div>
                    </div>
                    {m.mode === 'plan' ? (
                      <div className="extra">
                        <span>{m.extraServings ? `You + ${m.extraServings}` : 'Just you'}</span>
                        <span className="stepper" role="group" aria-label={`${LABEL[c]} extra servings`}>
                          <button aria-label="Fewer" onClick={() => set({ extraServings: Math.max(0, m.extraServings - 1) })}>−</button>
                          <b>{m.extraServings}</b>
                          <button aria-label="More" onClick={() => set({ extraServings: Math.min(8, m.extraServings + 1) })}>+</button>
                        </span>
                      </div>
                    ) : <div className="muted">Calories and protein reserved; you sort this meal</div>}
                  </div>
                </div>
              );
            })}
            <div className="line"><div className="lbody"><b>Daily target</b><div className="muted">{t.band[0].toLocaleString('en-GB')}–{t.band[1].toLocaleString('en-GB')} kcal · ≥{t.protein}g protein</div></div></div>
            <div className="line"><div className="lbody"><b>Cooking days</b>
              <div className="chips" role="group" aria-label="Cooking days" style={{ marginTop: 6 }}>
                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].map((n, i) => {
                  const on = !daysOff.includes(i);
                  return <button key={n} className={'chip' + (on ? ' on' : '')} aria-pressed={on} onClick={() => setDaysOff((x) => (x.includes(i) ? x.filter((y) => y !== i) : x.length >= 4 ? x : [...x, i]))}>{n}</button>;
                })}
              </div>
              <div className="muted">Tap a day to take it off. Weekends aren&apos;t planned yet.</div></div></div>
          </div>
          <h3 style={{ marginTop: 18 }}>Weekly Spend</h3>
          <div className="chips" role="group" aria-label="Weekly spend">
            {BUDGETS.map((b) => (
              <button key={b} className={'chip lg' + (profile.budget === b ? ' on' : '')} aria-pressed={profile.budget === b} onClick={() => update((p) => ({ ...p, budget: b }))}>{BUDGET_LABEL[b]}</button>
            ))}
          </div>
          <p className="muted" style={{ marginTop: -4 }}>{budgetHelp(profile.budget)} We only go over this on a day that can&apos;t hit your targets without it.</p>
          <p className="muted">Changes to meals, servings and spend are remembered for future weeks. To change your targets, <Link href="/settings">edit your answers</Link>.</p>
          <button className="btn" onClick={() => build(profile.likedRecipes)}>Pick for Me</button>
          <button className="btn ghost" style={{ marginTop: 8 }} onClick={() => { setVisitedTaste(true); setStep('pick'); }}>Refresh My Taste (Optional)</button>
        </div>
      )}

      {!building && step === 'pick' && (
        <div className="fade">
          <h2>Refresh Your Taste</h2>
          <p className="sub">Right to keep, left to drop. Meals you've had before come first.</p>
          <p className="muted guidenote">Portions are sized to your targets.</p>
          {planned.length < COURSES.length && <p className="muted guidenote">{COURSES.filter((c) => !planned.includes(c)).map((c) => LABEL[c]).join(' and ')}: macros only, so not shown.</p>}
          <TasteRefresh courses={planned} pool={safe2} liked={profile.likedRecipes} past={past} onDecide={(id, keep) => update((p) => swipe(p, id, keep))} />
        </div>
      )}

      {!building && step === 'review' && (
        <div className="fade">
          <h1>Your Week</h1>
          {!draft || !draft.days.length ? (
            <div className="estimate-flag">{draft?.issues[0] ?? 'Could not build a week.'}</div>
          ) : (<>
            <p className="sub">{draft.days.filter((d) => !d.off && d.inBand).length} of {draft.days.filter((d) => !d.off).length} days in band. Resized or topped-up days are highlighted.</p>
            {explainMisses(draft.days, t.band, t.protein).map((i) => <div key={i} className="estimate-flag">{i}</div>)}
            {draft.notes?.map((n) => <p key={n} className="muted">{n}</p>)}
            {shopping && <PriceNote totalPence={shopping.totalPence} />}
            {draft.days.map((d, i) => <DayCard key={d.day} d={d} index={i} label={dayLabel(addDays(week.start, i))} onSwap={(day, meal) => setSwap({ day, meal })} newIds={new Set(draft.days.flatMap((d) => d.meals).filter((m) => isNewForYou(profile, m.recipeId, m.slot)).map((m) => m.recipeId))} />)}
            <button className="btn ghost" onClick={() => build(profile.likedRecipes)}>Shuffle</button>
          </>)}
        </div>
      )}

      {!building && step === 'list' && shopping && (
        <div className="fade">
          <h2>Shopping List</h2>
          <p className="sub">Everything is ticked. Untick what you already have.</p>
          <ListStepBody shopping={shopping} have={have} onToggle={toggleHave} want={want} onToggleCupboard={toggleWant} />
        </div>
      )}

      {!building && step === 'saved' && draft && shopping && (
        <div className="fade">
          <h1>List Saved</h1>
          <p className="sub">{weekLabel(week.start)} is planned. It starts Mon {dayLabel(week.start)}.</p>
          <ListStepBody shopping={shopping} have={have} onToggle={toggleHave} want={want} onToggleCupboard={toggleWant} />
          {copied === 'fail' && <textarea className="copybox" readOnly onFocus={(e) => e.currentTarget.select()} value={listAsText(draft, have, 'Estimated Morrisons prices', want)} />}
        </div>
      )}

      {draft && <SwapSheet plan={draft} target={step === 'review' ? swap : null} input={planInputFrom(profile)} onClose={() => setSwap(null)}
        onPick={(id) => { if (swap) { setDraft(applySwap(draft, swap.day, swap.meal, id, planInputFrom(profile))); track('meal_swapped', { source: 'review' }); } setSwap(null); }} />}
      {leaving && createPortal(
        <div className="sheet-wrap" onClick={() => setLeaving(false)}>
          <div className="sheet" role="dialog" aria-label="Leave planning?" onClick={(e) => e.stopPropagation()}>
            <div className="grab" />
            <h2>Leave Planning?</h2>
            <p className="muted">{'Any taste changes are already saved.'}{draft?.days.length ? ' A week you\u2019ve built but not saved will be lost.' : ''}</p>
            <div className="sheet-foot">
            <button className="btn" onClick={() => router.push('/plan')}>Save and Finish Later</button>
                        <button className="linkbtn" onClick={() => setLeaving(false)}>Keep Planning</button>
            </div>
          </div>
        </div>, document.body)}
      <ReminderSheet when={step === 'saved' && !profile.reminders.on && !profile.reminders.asked}
        onAnswer={(on) => update((p) => ({ ...p, reminders: { ...p.reminders, on: on || p.reminders.on, asked: true } }))} />
      <InstallSheet when={step === 'saved' && (profile.reminders.on || !!profile.reminders.asked)} />
    </Screen>
  );
}
