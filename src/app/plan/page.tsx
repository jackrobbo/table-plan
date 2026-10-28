'use client';
import { Heart, RefreshCw } from 'lucide-react';
import { untilLabel } from '@/lib/cycle/countdown';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import PriceNote from '@/components/PriceNote';
import Screen from '@/components/Screen';
import BuildingWeek from '@/components/BuildingWeek';
import WeekRange from '@/components/WeekRange';
import MealImage from '@/components/MealImage';
import BasketButton from '@/components/BasketButton';
import SwapSheet from '@/components/SwapSheet';
import { isNewForYou, likeMeal, neverAgain } from '@/lib/taste';
import WeekendGuide from '@/components/WeekendGuide';
import { DailyAverage, WeekDone } from '@/components/WeekProgress';
import { allEaten, summariseWeek, weekAverages } from '@/lib/cycle/summary';
import { DayCard, RecipeSheet, ShoppingList, listAsText, money, recipeById } from '@/components/week';
import { addDays, dayLabel, londonDate, weekLabel } from '@/lib/cycle/dates';
import { dueReminders } from '@/lib/cycle/reminders';
import { badgeCount, effectiveStatus, ensureWeeks, firstWeek, opensAt, saveList, skipWeek, snapshot, toggleTick, undoSkip, type Week, type WeekStatus } from '@/lib/cycle/week';
import { needsConsent } from '@/lib/consent';
import { getBackend } from '@/lib/db';
import { planInputFrom } from '@/lib/planner/fromProfile';
import { applySwap } from '@/lib/planner/swap';
import { track } from '@/lib/analytics';
import { buildShopping } from '@/lib/planner/shopping';
import { explainMisses, planWeek } from '@/lib/planner/solve';
import { PRICES_META } from '@/data';
import { shortDate } from '@/lib/pricing/refresh';
import { computeTargets } from '@/lib/targets';
import Link from 'next/link';
import { useAccess } from '@/lib/useAccess';
import { setTabBadge } from '@/lib/tabBadge';
import { useNow } from '@/lib/useNow';
import { useProfile } from '@/lib/useProfile';

const STATE_COPY: Record<WeekStatus, string> = {
  locked: 'Not Open Yet', to_plan: 'To Plan', in_progress: 'In Progress', planned: 'Planned', shopped: 'Planned', active: 'Cooking',
  done: 'Done', skipped: 'Skipped', missed: 'Missed',
};

export default function Plan() {
  const router = useRouter();
  const now = useNow();
  const { session, profile, ready, update } = useProfile();
  const { access, loaded: accessLoaded } = useAccess(session);
  // Which view is open comes from the bottom tab bar (?v=upcoming | recipes); the Plan / Shopping List switch stays local.
  const view = useSearchParams().get('v');
  const tab: 'this' | 'upcoming' = view === 'upcoming' ? 'upcoming' : 'this';
  const [planSub, setSub] = useState<'plan' | 'ingredients'>('plan');
  const sub: 'plan' | 'ingredients' | 'recipes' = view === 'recipes' ? 'recipes' : planSub;
  const [picked, setPicked] = useState<string | null>(null);
  const [sheet, setSheet] = useState<string | null>(null);
  const [rate, setRate] = useState<string | null>(null);
  const [swap, setSwap] = useState<{ week: string; day: number; meal: number } | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  // The first time in, show what the planner checks while the first week is built.
  const [building, setBuilding] = useState(false);
  const sawBuild = useRef(false);
  const buildDone = useCallback(() => setBuilding(false), []);

  useEffect(() => {
    if (!ready) return;
    if (!session) router.replace('/signin');
    else if (profile && needsConsent(profile)) router.replace('/consent');
    else if (profile && !profile.completed) router.replace('/onboarding');
  }, [ready, session, profile, router]);

  // The first week is always the next Monday (never an empty state); then keep the visible weeks up to date.
  const weeksKey = profile ? Object.keys(profile.weeks).length : 0;
  useEffect(() => {
    if (!ready || !profile?.completed) return;
    if (!sawBuild.current && !Object.keys(profile.weeks).length) { sawBuild.current = true; setBuilding(true); }
    update((p) => {
      if (!Object.keys(p.weeks).length) {
        const w = firstWeek(planWeek(planInputFrom(p)), now);
        return { ...p, weeks: ensureWeeks({ [w.start]: w }, now) };
      }
      const next = ensureWeeks(p.weeks, now);
      return Object.keys(next).length === Object.keys(p.weeks).length ? p : { ...p, weeks: next };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, profile?.completed, weeksKey, now.toDateString()]);

  const weeks = profile?.weeks ?? {};
  const snap = useMemo(() => snapshot(weeks, now), [weeks, now]);
  const due = useMemo(() => (profile ? dueReminders(weeks, now, profile.reminders.shown)[0] : undefined), [weeks, now, profile]);
  const badge = badgeCount(snap);
  useEffect(() => { if (snap.thisWeek) setTabBadge(badge); }, [badge, snap.thisWeek]);

  if (building && session && profile?.completed) return <Screen><BuildingWeek onDone={buildDone} /></Screen>;
  if (!ready || !profile?.completed || !session || !snap.thisWeek) {
    return (
      <Screen><div className="skeleton-stack" aria-busy="true" aria-label="Building your week">
        <div className="skeleton sk-title" /><div className="skeleton sk-line" /><div className="skeleton sk-card" /><div className="skeleton sk-card" />
      </div></Screen>
    );
  }

  const t = computeTargets(profile.goal ?? 'lose', profile.stats);
  const week = snap.thisWeek;
  const wst = effectiveStatus(weeks, week, now);
  const started = wst === 'active' || wst === 'done';
  const finished = wst === 'done';
  const plan = week.plan!;
  const shopping = buildShopping(plan);
  const newIds = new Set(plan.days.flatMap((d) => d.meals).filter((m) => m.slot !== 'snack' && recipeById.get(m.recipeId) && isNewForYou(profile, m.recipeId, m.slot)).map((m) => m.recipeId));
  const upcomingSel = snap.upcoming.find((x) => x.week.start === (picked ?? snap.toPlan?.start ?? snap.upcoming[0]?.week.start)) ?? snap.upcoming[0];

  const toBuy = shopping.lines.filter((l) => !week.haveAlready.includes(l.key));
  const goList = () => { setSub('ingredients'); window.scrollTo({ top: 0 }); };
  const copy = async (text: string, key: string) => {
    try { await navigator.clipboard.writeText(text); setCopied(key); } catch { setCopied('fail:' + text); }
  };
  const dismiss = () => due && update((p) => ({ ...p, reminders: { ...p.reminders, shown: [...p.reminders.shown, `${due.week}:${due.kind}`] } }));
  const enableReminders = () => {
    // Switch on straight away; the browser's permission prompt is a bonus and must never hold the button up.
    update((p) => ({ ...p, reminders: { ...p.reminders, on: true } }));
    try { if (typeof Notification !== 'undefined') void Notification.requestPermission(); } catch { /* optional */ }
  };

  return (
    <Screen footer={accessLoaded && !access ? <Link className="btn" href="/subscribe">Save and Checkout</Link>
      : access && tab === 'this' && !started && plan.days.length > 0 && sub === 'plan'
        ? <button className="btn" onClick={goList}>Check Your Shopping List · ≈ {money(shopping.totalPence)}</button>
      : access && tab === 'this' && !started && plan.days.length > 0 && sub === 'ingredients'
        ? <button className="btn" onClick={() => document.getElementById('checkout')?.scrollIntoView({ behavior: 'smooth', block: 'center' })}>Checkout · {toBuy.length} Items · ≈ {money(toBuy.reduce((a, l) => a + l.costPence, 0))}</button>
        : undefined}>
      <p className="step">Welcome Back</p>

      {due && (
        <div className="reminder" role="status">
          <div><b>{due.title}</b><div>{due.body}</div></div>
          <div className="row2">
            <button className="btn inline small" onClick={() => { dismiss(); router.push('/plan?v=upcoming'); }}>Plan Now</button>
            <button className="linkbtn" onClick={dismiss}>Dismiss</button>
          </div>
        </div>
      )}

      {tab === 'this' && (
        <div className="fade" key="this">
          <h1>{sub === 'recipes' ? (started ? 'This Week’s Menu' : 'Next Week’s Menu') : finished ? 'Last Week' : started ? 'This Week' : Object.keys(weeks).length > 3 ? 'Next Up' : 'Your First Week'} <WeekRange start={week.start} /></h1>
          {sub === 'recipes' && <p className="sub">Everything you&apos;re cooking {started ? 'this week' : `from Mon ${dayLabel(week.start)}`}, one card per meal. Tap one for the recipe.</p>}
          {sub !== 'recipes' && finished && <p className="sub">Nothing is planned for this week. Plan the next one from Upcoming.</p>}
          {sub !== 'recipes' && !started && (
            <div className="seg2">
              <button className={sub === 'plan' ? 'on' : ''} onClick={() => setSub('plan')}>Plan</button>
              <button className={sub === 'ingredients' ? 'on' : ''} onClick={() => setSub('ingredients')}>Shopping List</button>
            </div>
          )}

          {sub === 'plan' && <>
            {/* Built from the days, not plan.issues, so plans saved before the wording changed show the current message. */}
            {(plan.days.length ? explainMisses(plan.days, t.band, t.protein) : plan.issues).map((i) => <div key={i} className="estimate-flag">{i}</div>)}
            {plan.days.length > 0 && <PriceNote totalPence={shopping.totalPence} />}
            {rate && recipeById.get(rate) && (
              <div className="note rate" role="status">
                <b>New this week: {recipeById.get(rate)!.n}. How was it?</b>
                <button className="btn inline small" onClick={() => { update((p) => likeMeal(p, rate)); setRate(null); }}>Liked It</button>
                <button className="btn ghost inline small" onClick={() => { update((p) => neverAgain(p, rate)); setRate(null); }}>Not for Me</button>
                <button className="linkbtn" onClick={() => setRate(null)}>Not Now</button>
              </div>
            )}
            {plan.days.length > 0 && (finished || (started && allEaten(plan, week.ticks)))
              ? <WeekDone s={summariseWeek(plan, week.ticks, shopping)} t={t} />
              : plan.days.length > 0 && <DailyAverage averages={weekAverages(plan)} t={t} />}
            {plan.days.map((d, i) => (
              <DayCard key={d.day} d={d} index={i} ticks={started ? week.ticks : undefined} onOpen={setSheet} today={started && !finished && addDays(week.start, i) === londonDate(now)}
                onSwap={finished ? undefined : (day, meal) => setSwap({ week: week.start, day, meal })}
                onTick={started && !finished ? (k) => { const [di, mi] = k.split(':').map(Number); const rid = plan.days[di]?.meals[mi]?.recipeId; if (rid && !week.ticks[k] && newIds.has(rid)) setRate(rid); update((p) => ({ ...p, weeks: toggleTick(p.weeks, week.start, k) })); } : undefined} newIds={newIds} />
            ))}
            <WeekendGuide profile={profile} onOpen={setSheet} />
          </>}

          {sub === 'ingredients' && !started && accessLoaded && !access && (
            <div className="card lock-card"><h3>Unlock Your Shopping List</h3><p className="muted">Subscribe to see every ingredient with dated Morrisons prices.</p><Link className="btn" href="/subscribe">See Plans</Link></div>
          )}

          {sub === 'ingredients' && !started && access && <>
            <PriceNote totalPence={shopping.totalPence} />
            <div className="note"><b>Untick anything you already have.</b> Ticked items go into your trolley. When you&apos;re happy, check out below.</div>
            <ShoppingList shopping={shopping} have={week.haveAlready}
              onToggle={(k) => update((p) => { const w = p.weeks[week.start]; const have = w.haveAlready.includes(k) ? w.haveAlready.filter((x) => x !== k) : [...w.haveAlready, k]; return { ...p, weeks: { ...p.weeks, [week.start]: { ...w, haveAlready: have } } }; })} />
            <BasketButton shopping={shopping} have={week.haveAlready} />
            <button className="btn ghost" style={{ marginTop: 8 }} onClick={() => copy(listAsText(plan, week.haveAlready, `Estimated Morrisons prices, checked ${PRICES_META.checkedAt ? shortDate(PRICES_META.checkedAt) : 'not yet'}`), 'this')}>
              Copy List to Notes
            </button>
            {copied === 'this' && <p className="muted" role="status">Copied. Paste it into Notes.</p>}
            {copied?.startsWith('fail:') && <textarea className="copybox" readOnly value={copied.slice(5)} onFocus={(e) => e.currentTarget.select()} />}
            <div className="note"><b>Store cupboard check.</b> Buy only if you&apos;re out:<br />{shopping.cupboard.join(' · ')}</div>
          </>}

          {sub === 'recipes' && (
            <div className="rgrid">
              {[...new Set(plan.days.flatMap((d) => d.meals.map((m) => m.recipeId)))].map((id) => {
                const r = recipeById.get(id)!;
                const days = plan.days.filter((d) => d.meals.some((m) => m.recipeId === id)).map((d) => d.day.slice(0, 3));
                return (
                  <button key={id} className="rcard" onClick={() => setSheet(id)}>
                    {r.img ? <MealImage r={r} size="thumb" sizes="(max-width: 430px) 45vw, 200px" /> : <span className="emoji">{r.e}</span>}<span className="nm">{r.n}</span><span className="muted">{days.join(' · ')}</span>
                  </button>
                );
              })}
            </div>
          )}
          {sub === 'recipes' && (
            <div className="card tastelink">
              <h3 className="ico-h"><Heart size={18} aria-hidden />Not Feeling These?</h3>
              <p className="muted">The planner picks from the meals you keep. Adjust your taste and your next plan changes.</p>
              <button className="btn ghost" onClick={() => { update((p) => ({ ...p, completed: false, step: 'taste' })); router.push('/onboarding'); }}>Adjust My Taste</button>
            </div>
          )}

          {!profile.reminders.on && (
            <div className="card remind-card">
              <h3>Never Miss a Week</h3>
              <p className="muted">Sunday morning: next week&apos;s meals are open. The Sunday after, 4pm: last chance, pick by midnight.</p>
              <button className="btn ghost" onClick={enableReminders}>Turn On Reminders</button>
            </div>
          )}
          {profile.reminders.on && <p className="muted">Reminders are on. For now they appear when you open Table Plan; alerts while the app is closed need the server side, coming next.</p>}
        </div>
      )}

      {tab === 'upcoming' && (
        <div className="fade" key="up">
          <h1>Upcoming</h1>
          <p className="sub">Each week opens for planning on Sunday at 6am, after we refresh Morrisons prices, so your list always uses the latest ones.</p>
          <div className="pricefresh"><RefreshCw size={16} aria-hidden /><span>Prices last checked {PRICES_META.checkedAt ? shortDate(PRICES_META.checkedAt) : 'not yet'}. Next refresh: Sunday morning.</span></div>
          <ol className="weeklist">
            {snap.upcoming.map(({ week: w, status }) => {
              const sel = upcomingSel?.week.start === w.start;
              const opens = opensAt(weeks, w.start);
              return (
                <li key={w.start} className={'wkrow ' + status + (sel ? ' open' : '')}>
                  <button className="wkhead" aria-expanded={sel} onClick={() => setPicked(w.start)}>
                    <span className="wkdot" aria-hidden />
                    <span className="wktxt">
                      <b>{weekLabel(w.start)}</b>
                      <small>{status === 'locked' ? `Opens Sun ${dayLabel(londonDate(opens))} at 6am · ${untilLabel(opens, now)}`
                        : status === 'to_plan' || status === 'in_progress' ? `Open now · pick by midnight Sun ${dayLabel(addDays(w.start, -1))}`
                        : status === 'planned' || status === 'shopped' ? `Planned · starts Mon ${dayLabel(w.start)}`
                        : STATE_COPY[status]}</small>
                    </span>
                    <span className={'wkpill ' + status}>{STATE_COPY[status]}</span>
                  </button>
                  {sel && upcomingSel && <div className="wkbody"><UpcomingCard week={upcomingSel.week} status={upcomingSel.status} weeks={weeks} now={now}
            onPlan={() => router.push(access ? '/plan/next' : '/subscribe')}
            onSkip={() => update((p) => ({ ...p, weeks: skipWeek(p.weeks, upcomingSel.week.start, now) }))}
            onUndo={() => update((p) => ({ ...p, weeks: undoSkip(p.weeks, upcomingSel.week.start, now) }))}
            onCopy={(text) => copy(text, upcomingSel.week.start)} copied={copied} onOpen={setSheet}
            onSwap={(day, meal) => setSwap({ week: upcomingSel.week.start, day, meal })}
            onToggleHave={(k) => update((p) => { const w = p.weeks[upcomingSel.week.start]; const have = w.haveAlready.includes(k) ? w.haveAlready.filter((x) => x !== k) : [...w.haveAlready, k]; return { ...p, weeks: saveList({ ...p.weeks, [w.start]: { ...w, haveAlready: have } }, w.start, have, w.checkout ?? 'notes') }; })} /></div>}
                </li>
              );
            })}
            {/* Weeks further ahead aren't created yet: show when each one will open so people know when to come back. */}
            {[1, 2].map((n) => {
              const last = snap.upcoming[snap.upcoming.length - 1]?.week.start ?? week.start;
              const start = addDays(last, 7 * n);
              const opens = opensAt(weeks, start);
              return (
                <li key={start} className="wkrow later">
                  <div className="wkhead static">
                    <span className="wkdot" aria-hidden />
                    <span className="wktxt"><b>{weekLabel(start)}</b><small>Opens Sun {dayLabel(londonDate(opens))} at 6am · {untilLabel(opens, now)}</small></span>
                    <span className="wkpill locked">Not Open Yet</span>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      )}
      <RecipeSheet id={sheet} onClose={() => setSheet(null)} portions={1} onNever={(rid) => update((p) => neverAgain(p, rid))} />
      <SwapSheet plan={(swap && weeks[swap.week]?.plan) || plan} target={swap && weeks[swap.week]?.plan ? swap : null} input={planInputFrom(profile)} onClose={() => setSwap(null)}
        onPick={(id) => {
          if (!swap) return;
          update((p) => {
            const w = p.weeks[swap.week];
            return w?.plan ? { ...p, weeks: { ...p.weeks, [w.start]: { ...w, plan: applySwap(w.plan, swap.day, swap.meal, id, planInputFrom(p)) } } } : p;
          });
          track('meal_swapped', { source: 'plan' });
          setSwap(null);
        }} />
    </Screen>
  );
}

function UpcomingCard({ week, status, weeks, now, onPlan, onSkip, onUndo, onCopy, copied, onOpen, onSwap, onToggleHave }: {
  week: Week; status: WeekStatus; weeks: Record<string, Week>; now: Date; onPlan: () => void; onSkip: () => void; onUndo: () => void;
  onCopy: (t: string) => void; copied: string | null; onOpen: (id: string) => void; onSwap: (day: number, meal: number) => void; onToggleHave: (k: string) => void;
}) {
  const deadline = `midnight Sun ${dayLabel(addDays(week.start, -1))}`;
  if (status === 'locked') return <div className="card"><h3>Why Sunday at 6am?</h3><p className="muted" style={{ margin: 0 }}>We refresh the Morrisons prices first, so your shopping list uses the latest ones. Only one week is open to plan at a time.</p></div>;
  if (status === 'missed') return <div className="card"><h3>{weekLabel(week.start)} · Missed</h3><p className="muted" style={{ margin: 0 }}>The deadline passed, so nothing was picked for you. You can plan the next week as normal.</p></div>;
  if (status === 'skipped') return <div className="card"><h3>{weekLabel(week.start)} · Skipped</h3><p className="muted">You skipped this week.</p><button className="btn ghost" onClick={onUndo}>Undo Skip</button></div>;
  if (status === 'to_plan' || status === 'in_progress') {
    return (
      <div className="card">
        <h3>Plan {weekLabel(week.start)}</h3>
        <p className="muted">Pick by {deadline}. Cooking starts the next day.</p>
        {status === 'in_progress' && <p className="note">In progress · {week.picks.length} picked</p>}
        <button className="btn" onClick={onPlan}>{status === 'in_progress' ? 'Continue' : 'Plan this week'}</button>
        <button className="linkbtn" style={{ marginTop: 6 }} onClick={onSkip}>Skip This Week</button>
      </div>
    );
  }
  const plan = week.plan!;
  const shopping = buildShopping(plan);
  return (
    <div>
      <p className="muted">Planned. Starts Mon {dayLabel(week.start)}.</p>
      {plan.days.map((d, i) => <DayCard key={d.day} d={d} index={i} onOpen={onOpen} onSwap={onSwap} />)}
      <h2 style={{ marginTop: 22 }}>Shopping List</h2>
      <PriceNote totalPence={shopping.totalPence} />
      <ShoppingList shopping={shopping} have={week.haveAlready} onToggle={onToggleHave} />
      <BasketButton shopping={shopping} have={week.haveAlready} />
      <p className="muted">{shopping.lines.length - week.haveAlready.length} items · ≈ {money(shopping.lines.filter((l) => !week.haveAlready.includes(l.key)).reduce((a, l) => a + l.costPence, 0))}</p>
      <button className="btn ghost" style={{ marginTop: 8 }} onClick={() => onCopy(listAsText(plan, week.haveAlready, `Estimated Morrisons prices, checked ${PRICES_META.checkedAt ? shortDate(PRICES_META.checkedAt) : 'not yet'}`))}>Copy List to Notes</button>
      {copied === week.start && <p className="muted" role="status">Copied. Paste it into Notes.</p>}
      {copied?.startsWith('fail:') && <textarea className="copybox" readOnly value={copied.slice(5)} onFocus={(e) => e.currentTarget.select()} />}
    </div>
  );
}
