'use client';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import PriceNote from '@/components/PriceNote';
import Screen from '@/components/Screen';
import MealImage from '@/components/MealImage';
import BasketButton from '@/components/BasketButton';
import SwapSheet from '@/components/SwapSheet';
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
import { useNow } from '@/lib/useNow';
import { useProfile } from '@/lib/useProfile';

const STATE_COPY: Record<WeekStatus, string> = {
  locked: 'Not open yet', to_plan: 'To plan', in_progress: 'In progress', planned: 'Planned', shopped: 'Planned', active: 'Cooking',
  done: 'Done', skipped: 'Skipped', missed: 'Missed',
};

export default function Plan() {
  const router = useRouter();
  const now = useNow();
  const { session, profile, ready, update } = useProfile();
  const { access, loaded: accessLoaded } = useAccess(session);
  const [tab, setTab] = useState<'this' | 'upcoming'>('this');
  const [sub, setSub] = useState<'plan' | 'ingredients' | 'recipes'>('plan');
  const [picked, setPicked] = useState<string | null>(null);
  const [sheet, setSheet] = useState<string | null>(null);
  const [swap, setSwap] = useState<{ week: string; day: number; meal: number } | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

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
  const badge = badgeCount(snap);
  const upcomingSel = snap.upcoming.find((x) => x.week.start === (picked ?? snap.toPlan?.start ?? snap.upcoming[0]?.week.start)) ?? snap.upcoming[0];

  const copy = async (text: string, key: string) => {
    try { await navigator.clipboard.writeText(text); setCopied(key); } catch { setCopied('fail:' + text); }
  };
  const dismiss = () => due && update((p) => ({ ...p, reminders: { ...p.reminders, shown: [...p.reminders.shown, `${due.week}:${due.kind}`] } }));
  const enableReminders = async () => {
    try { if (typeof Notification !== 'undefined') await Notification.requestPermission(); } catch { /* optional */ }
    update((p) => ({ ...p, reminders: { ...p.reminders, on: true } }));
  };

  return (
    <Screen footer={<>
      {accessLoaded && !access && <Link className="btn" href="/subscribe">Save and checkout</Link>}
      <Link className="linkbtn" href="/account">Account</Link>
    </>}>
      <p className="step">Welcome back</p>
      <div className="switch" role="tablist">
        <button role="tab" aria-selected={tab === 'this'} className={tab === 'this' ? 'on' : ''} onClick={() => setTab('this')}>This week</button>
        <button role="tab" aria-selected={tab === 'upcoming'} className={tab === 'upcoming' ? 'on' : ''} onClick={() => setTab('upcoming')}>
          Upcoming{badge > 0 && <span className="badge">{badge}</span>}
        </button>
      </div>

      {due && (
        <div className="reminder" role="status">
          <div><b>{due.title}</b><div>{due.body}</div></div>
          <div className="row2">
            <button className="btn inline small" onClick={() => { dismiss(); setTab('upcoming'); }}>Plan now</button>
            <button className="linkbtn" onClick={dismiss}>Dismiss</button>
          </div>
        </div>
      )}

      {tab === 'this' && (
        <div className="fade" key="this">
          <h1>{finished ? 'Last week' : started ? 'This week' : Object.keys(weeks).length > 3 ? 'Next up' : 'Your first week'} <span className="wk">{weekLabel(week.start)}</span></h1>
          <p className="sub">
            {finished ? 'Nothing is planned for this week. Plan the next one from Upcoming.' : started ? `Kept inside ${t.band[0].toLocaleString('en-GB')}–${t.band[1].toLocaleString('en-GB')} kcal and ≥${t.protein}g protein a day.`
              : `Starts Mon ${dayLabel(week.start)}. Built from what you like, inside ${t.band[0].toLocaleString('en-GB')}–${t.band[1].toLocaleString('en-GB')} kcal and ≥${t.protein}g protein a day.`}
          </p>
          <div className="seg2">
            <button className={sub === 'plan' ? 'on' : ''} onClick={() => setSub('plan')}>Plan</button>
            {!started && <button className={sub === 'ingredients' ? 'on' : ''} onClick={() => setSub('ingredients')}>Ingredients</button>}
            <button className={sub === 'recipes' ? 'on' : ''} onClick={() => setSub('recipes')}>Recipes</button>
          </div>

          {sub === 'plan' && <>
            {/* Built from the days, not plan.issues, so plans saved before the wording changed show the current message. */}
            {(plan.days.length ? explainMisses(plan.days, t.band, t.protein) : plan.issues).map((i) => <div key={i} className="estimate-flag">{i}</div>)}
            {plan.days.map((d, i) => (
              <DayCard key={d.day} d={d} index={i} ticks={started ? week.ticks : undefined} onOpen={setSheet}
                onSwap={finished ? undefined : (day, meal) => setSwap({ week: week.start, day, meal })}
                onTick={started && !finished ? (k) => update((p) => ({ ...p, weeks: toggleTick(p.weeks, week.start, k) })) : undefined} />
            ))}
          </>}

          {sub === 'ingredients' && !started && accessLoaded && !access && (
            <div className="card lock-card"><h3>Unlock your shopping list</h3><p className="muted">Subscribe to see every ingredient with dated Morrisons prices.</p><Link className="btn" href="/subscribe">See plans</Link></div>
          )}

          {sub === 'ingredients' && !started && access && <>
            <PriceNote totalPence={shopping.totalPence} />
            <ShoppingList shopping={shopping} have={week.haveAlready}
              onToggle={(k) => update((p) => { const w = p.weeks[week.start]; const have = w.haveAlready.includes(k) ? w.haveAlready.filter((x) => x !== k) : [...w.haveAlready, k]; return { ...p, weeks: { ...p.weeks, [week.start]: { ...w, haveAlready: have } } }; })} />
            <BasketButton shopping={shopping} have={week.haveAlready} />
            <div className="note"><b>Store cupboard check.</b> Buy only if you&apos;re out:<br />{shopping.cupboard.join(' · ')}</div>
            <button className="btn" onClick={() => copy(listAsText(plan, week.haveAlready, `Estimated Morrisons prices, checked ${PRICES_META.checkedAt ? shortDate(PRICES_META.checkedAt) : 'not yet'}`), 'this')}>
              Save to Notes (copy list)
            </button>
            {copied === 'this' && <p className="muted" role="status">Copied. Paste it into Notes.</p>}
            {copied?.startsWith('fail:') && <textarea className="copybox" readOnly value={copied.slice(5)} onFocus={(e) => e.currentTarget.select()} />}
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

          {!profile.reminders.on && (
            <div className="card remind-card">
              <h3>Never miss a week</h3>
              <p className="muted">Sunday morning: next week&apos;s meals are open. The Sunday after, 4pm: last chance, pick by midnight.</p>
              <button className="btn ghost" onClick={enableReminders}>Turn on reminders</button>
            </div>
          )}
          {profile.reminders.on && <p className="muted">Reminders are on. For now they appear when you open Table Plan; alerts while the app is closed need the server side, coming next.</p>}
        </div>
      )}

      {tab === 'upcoming' && (
        <div className="fade" key="up">
          <h1>Upcoming</h1>
          <div className="chips weekchips">
            {snap.upcoming.map(({ week: w, status }) => (
              <button key={w.start} className={'chip lg' + (upcomingSel?.week.start === w.start ? ' on' : '') + (status === 'to_plan' || status === 'in_progress' ? ' amber-dot' : '')} onClick={() => setPicked(w.start)}>
                {weekLabel(w.start)}<small>{STATE_COPY[status]}</small>
              </button>
            ))}
          </div>
          {upcomingSel && <UpcomingCard week={upcomingSel.week} status={upcomingSel.status} weeks={weeks} now={now}
            onPlan={() => router.push(access ? '/plan/next' : '/subscribe')}
            onSkip={() => update((p) => ({ ...p, weeks: skipWeek(p.weeks, upcomingSel.week.start, now) }))}
            onUndo={() => update((p) => ({ ...p, weeks: undoSkip(p.weeks, upcomingSel.week.start, now) }))}
            onCopy={(text) => copy(text, upcomingSel.week.start)} copied={copied} onOpen={setSheet}
            onSwap={(day, meal) => setSwap({ week: upcomingSel.week.start, day, meal })}
            onToggleHave={(k) => update((p) => { const w = p.weeks[upcomingSel.week.start]; const have = w.haveAlready.includes(k) ? w.haveAlready.filter((x) => x !== k) : [...w.haveAlready, k]; return { ...p, weeks: saveList({ ...p.weeks, [w.start]: { ...w, haveAlready: have } }, w.start, have, w.checkout ?? 'notes') }; })} />}
        </div>
      )}
      <RecipeSheet id={sheet} onClose={() => setSheet(null)} portions={1} />
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
  if (status === 'locked') return <div className="card"><h3>{weekLabel(week.start)}</h3><p className="muted" style={{ margin: 0 }}>Opens Sun {dayLabel(londonDate(opensAt(weeks, week.start)))} at 6am. Only one week is open to plan at a time.</p></div>;
  if (status === 'missed') return <div className="card"><h3>{weekLabel(week.start)} · Missed</h3><p className="muted" style={{ margin: 0 }}>The deadline passed, so nothing was picked for you. You can plan the next week as normal.</p></div>;
  if (status === 'skipped') return <div className="card"><h3>{weekLabel(week.start)} · Skipped</h3><p className="muted">You skipped this week.</p><button className="btn ghost" onClick={onUndo}>Undo skip</button></div>;
  if (status === 'to_plan' || status === 'in_progress') {
    return (
      <div className="card">
        <h3>Plan {weekLabel(week.start)}</h3>
        <p className="muted">Pick by {deadline}. Cooking starts the next day.</p>
        {status === 'in_progress' && <p className="note">In progress · {week.picks.length} picked</p>}
        <button className="btn" onClick={onPlan}>{status === 'in_progress' ? 'Continue' : 'Plan this week'}</button>
        <button className="linkbtn" style={{ marginTop: 6 }} onClick={onSkip}>Skip this week</button>
      </div>
    );
  }
  const plan = week.plan!;
  const shopping = buildShopping(plan);
  return (
    <div>
      <p className="muted">Planned. Starts Mon {dayLabel(week.start)}.</p>
      {plan.days.map((d, i) => <DayCard key={d.day} d={d} index={i} onOpen={onOpen} onSwap={onSwap} />)}
      <h2 style={{ marginTop: 22 }}>Ingredients</h2>
      <PriceNote totalPence={shopping.totalPence} />
      <ShoppingList shopping={shopping} have={week.haveAlready} onToggle={onToggleHave} />
      <BasketButton shopping={shopping} have={week.haveAlready} />
      <p className="muted">{shopping.lines.length - week.haveAlready.length} items · ≈ {money(shopping.lines.filter((l) => !week.haveAlready.includes(l.key)).reduce((a, l) => a + l.costPence, 0))}</p>
      <button className="btn" onClick={() => onCopy(listAsText(plan, week.haveAlready, `Estimated Morrisons prices, checked ${PRICES_META.checkedAt ? shortDate(PRICES_META.checkedAt) : 'not yet'}`))}>Save to Notes (copy list)</button>
      {copied === week.start && <p className="muted" role="status">Copied. Paste it into Notes.</p>}
      {copied?.startsWith('fail:') && <textarea className="copybox" readOnly value={copied.slice(5)} onFocus={(e) => e.currentTarget.select()} />}
    </div>
  );
}
