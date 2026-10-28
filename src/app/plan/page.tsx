'use client';
import { Heart, RefreshCw } from 'lucide-react';
import { untilLabel } from '@/lib/cycle/countdown';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import PriceNote from '@/components/PriceNote';
import RateSheet from '@/components/RateSheet';
import { CheckoutBar, CheckoutSheet, ListStepBody } from '@/components/ListStep';
import Screen from '@/components/Screen';
import BuildingWeek from '@/components/BuildingWeek';
import WeekRange from '@/components/WeekRange';
import MealImage from '@/components/MealImage';
import SwapSheet from '@/components/SwapSheet';
import { forgetRating, isNewForYou, likeMeal, neverAgain } from '@/lib/taste';
import WeekendGuide from '@/components/WeekendGuide';
import { DailyAverage, DailyProgress, WeekDone } from '@/components/WeekProgress';
import { allEaten, dayEaten, summariseWeek, weekAverages } from '@/lib/cycle/summary';
import { DayCard, RecipeSheet, listAsText, money, recipeById } from '@/components/week';
import { addDays, dayLabel, londonDate, weekLabel } from '@/lib/cycle/dates';
import { dueReminders } from '@/lib/cycle/reminders';
import { badgeCount, effectiveStatus, ensureWeeks, firstWeek, opensAt, saveList, skipWeek, snapshot, toggleTick, undoSkip, type Week, type WeekStatus } from '@/lib/cycle/week';
import { needsConsent } from '@/lib/consent';
import { getBackend } from '@/lib/db';
import { planInputFrom } from '@/lib/planner/fromProfile';
import { applySwap } from '@/lib/planner/swap';
import { track } from '@/lib/analytics';
import { buildShoppingFor, checkedAtFor } from '@/lib/catalogue';
import { storeOf, type Store } from '@/lib/stores';
import { explainMisses, planWeek } from '@/lib/planner/solve';
import { RECIPES } from '@/data';
import { shortDate } from '@/lib/pricing/refresh';
import { computeTargets } from '@/lib/targets';
import { STORE_LOGOS } from '@/lib/logos';
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
  const [planSub, setSub] = useState<'plan' | 'recipes' | 'ingredients'>('plan');
  const [listOpen, setListOpen] = useState(false);
  const menuTab = view === 'recipes';   // the bottom-bar Menu tab; the Recipes tab inside the plan keeps the plan's own header
  const [menuFilter, setMenuFilter] = useState<'week' | 'liked' | 'eaten'>('week');
  // Which way the incoming content slides (the same hook the bottom tab bar uses): towards the tab you tapped.
  const SUBS = ['plan', 'recipes', 'ingredients'] as const;
  const FILTERS = ['week', 'liked', 'eaten'] as const;
  const dir = (a: number, b: number) => { document.documentElement.dataset.navdir = b >= a ? 'fwd' : 'back'; };
  const goSub = (n: (typeof SUBS)[number]) => { dir(SUBS.indexOf(planSub), SUBS.indexOf(n)); setSub(n); };
  const goFilter = (n: (typeof FILTERS)[number]) => { dir(FILTERS.indexOf(menuFilter), FILTERS.indexOf(n)); setMenuFilter(n); };
  const sub: 'plan' | 'recipes' | 'ingredients' = view === 'recipes' ? 'recipes' : planSub;
  const [picked, setPicked] = useState<string | null>(null);
  const [sheet, setSheet] = useState<string | null>(null);
  const [rate, setRate] = useState<string | null>(null);
  const [swap, setSwap] = useState<{ week: string; day: number; meal: number } | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  useEffect(() => { if (copied !== 'this') return; const t = setTimeout(() => setCopied(null), 2500); return () => clearTimeout(t); }, [copied]);
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

  if (building && session && profile?.completed) return <Screen><BuildingWeek onDone={buildDone} store={storeOf(profile)} /></Screen>;
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
  // Once checkout has been started the shopping is done: the second tab turns from the list into this week's recipes.
  const shopped = week.status === 'shopped';
  // From checkout on, the week is in its eating window: meals are ticked off as eaten, and swapping is gone (the shop is bought).
  const eating = started || shopped;
  const finished = wst === 'done';
  const plan = week.plan!;
  const store = storeOf(profile);
  const shopping = buildShoppingFor(plan, store.id);
  // In the eating window today comes first, the other days follow in order, and a day with everything ticked sinks to the bottom.
  const todayIdx = started && !finished ? plan.days.findIndex((_, i) => addDays(week.start, i) === londonDate(now)) : -1;
  const dayDone = (i: number) => plan.days[i].meals.length > 0 && plan.days[i].meals.every((_, mi) => week.ticks[`${i}:${mi}`]);
  const dayOrder = plan.days.map((d, i) => ({ d, i })).sort((a, b) => {
    const rank = (i: number) => (!eating ? 1 : dayDone(i) ? 2 : i === todayIdx ? 0 : 1);
    return rank(a.i) - rank(b.i) || a.i - b.i;
  });
  // The Menu tab doubles as the favourites page: meals liked at set-up (and since), and meals ticked off as eaten across every week.
  const COURSES = ['breakfast', 'lunch', 'dinner', 'snack'] as const;
  const COURSE_PLURAL: Record<string, string> = { breakfast: 'Breakfasts', lunch: 'Lunches', dinner: 'Dinners', snack: 'Snacks' };
  const likedRecipes = RECIPES.filter((r) => profile.likedRecipes.includes(r.id));
  const eatenCounts = (() => {
    const n: Record<string, number> = {};
    for (const w of Object.values(weeks)) w.plan?.days.forEach((d, di) => d.meals.forEach((m, mi) => { if (w.ticks[`${di}:${mi}`]) n[m.recipeId] = (n[m.recipeId] ?? 0) + 1; }));
    return n;
  })();
  const eatenRecipes = Object.keys(eatenCounts).map((id) => recipeById.get(id)).filter((r): r is NonNullable<typeof r> => !!r).sort((a, b) => eatenCounts[b.id] - eatenCounts[a.id]);
  const rating = { liked: false, onLike: (id: string) => update((p) => likeMeal(p, id)), onRemove: (id: string) => update((p) => forgetRating(p, id)) };
  const newIds = new Set(plan.days.flatMap((d) => d.meals).filter((m) => m.slot !== 'snack' && recipeById.get(m.recipeId) && isNewForYou(profile, m.recipeId, m.slot)).map((m) => m.recipeId));
  const upcomingSel = snap.upcoming.find((x) => x.week.start === (picked ?? snap.toPlan?.start ?? snap.upcoming[0]?.week.start)) ?? snap.upcoming[0];

  const toBuy = shopping.lines.filter((l) => !week.haveAlready.includes(l.key));
  const wantCup = week.wantCupboard ?? [];
  const toggleHave = (k: string) => update((p) => { const w = p.weeks[week.start]; const have = w.haveAlready.includes(k) ? w.haveAlready.filter((x) => x !== k) : [...w.haveAlready, k]; return { ...p, weeks: { ...p.weeks, [week.start]: { ...w, haveAlready: have } } }; });
  const toggleCupboard = (k: string) => update((p) => { const w = p.weeks[week.start]; const cur = w.wantCupboard ?? []; return { ...p, weeks: { ...p.weeks, [week.start]: { ...w, wantCupboard: cur.includes(k) ? cur.filter((x) => x !== k) : [...cur, k] } } }; });
  // The week counts as shopped only once something actually happened: the list was copied, the trolley was filled (or the Morrisons
  // page opened by the extension), or item-by-item shopping reached its end. Tapping the button alone doesn't.
  const markShopped = (how: 'notes' | 'basket') => update((p) => { const w = p.weeks[week.start]; return w?.plan ? { ...p, weeks: saveList(p.weeks, week.start, w.haveAlready, how) } : p; });
  const copyList = async () => {
    const ok = await copy(listAsText(plan, week.haveAlready, `Estimated ${store.name} prices, checked ${checkedAtFor(store.id) ? shortDate(checkedAtFor(store.id)!) : 'not yet'}`, week.wantCupboard, store), 'this');
    if (ok) markShopped('notes');
    return ok;
  };
  const checkout = () => window.dispatchEvent(new Event('tp:checkout'));
  const goList = () => setListOpen(true);
  const copy = async (text: string, key: string): Promise<boolean> => {
    try { await navigator.clipboard.writeText(text); setCopied(key); return true; } catch { setCopied('fail:' + text); return false; }
  };
  const dismiss = () => due && update((p) => ({ ...p, reminders: { ...p.reminders, shown: [...p.reminders.shown, `${due.week}:${due.kind}`] } }));
  const enableReminders = () => {
    // Switch on straight away; the browser's permission prompt is a bonus and must never hold the button up.
    update((p) => ({ ...p, reminders: { ...p.reminders, on: true } }));
    try { if (typeof Notification !== 'undefined') void Notification.requestPermission(); } catch { /* optional */ }
  };

  return (
    <Screen footer={accessLoaded && !access ? <Link className="btn shopbtn glare" href="/subscribe" aria-label={`Save and checkout with ${store.name}, about ${money(shopping.totalPence)}`}>
        <span className="sp">≈ {money(shopping.totalPence)}</span><i className="ssep" aria-hidden /><span>Checkout With</span><span className="slogo" aria-hidden>{STORE_LOGOS[store.id] ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={STORE_LOGOS[store.id]!.light} alt="" height={16} /> : store.name}</span>
      </Link>
      : access && tab === 'this' && !started && plan.days.length > 0 && sub === 'plan' && !shopped
        ? <button className="btn glare" onClick={goList}>Save &amp; Checkout</button>
      : access && tab === 'this' && !started && plan.days.length > 0 && shopped && sub === 'ingredients' && view !== 'recipes'
        ? <CheckoutBar store={store} onCopy={copyList} copied={copied === 'this'} onCheckout={checkout} />
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
          <h1>{menuTab ? 'Your Menu' : finished ? 'Last Week' : started ? 'This Week' : Object.keys(weeks).length > 3 ? 'Next Up' : 'Your Table Plan'} {(!menuTab || menuFilter === 'week') && <WeekRange start={week.start} />}</h1>
          {menuTab && (<>
            <p className="sub">{menuFilter === 'week' ? `Everything you're cooking ${started ? 'this week' : `from Mon ${dayLabel(week.start)}`}, by day. Tap one for the recipe.`
              : menuFilter === 'liked' ? 'The meals you picked when you set up, and ones you\'ve liked since. The planner draws from these. Tap one to rate or remove it.'
              : 'Meals you\'ve ticked off as eaten, most often first. Tap one to rate it.'}</p>
            <div className="chips menufilter" role="group" aria-label="Show">
              <button className={'chip' + (menuFilter === 'week' ? ' on' : '')} aria-pressed={menuFilter === 'week'} onClick={() => goFilter('week')}>This Week</button>
              <button className={'chip' + (menuFilter === 'liked' ? ' on' : '')} aria-pressed={menuFilter === 'liked'} onClick={() => goFilter('liked')}>Liked · {likedRecipes.length}</button>
              <button className={'chip' + (menuFilter === 'eaten' ? ' on' : '')} aria-pressed={menuFilter === 'eaten'} onClick={() => goFilter('eaten')}>Eaten · {eatenRecipes.length}</button>
            </div>
          </>)}
          {sub !== 'recipes' && finished && <p className="sub">Nothing is planned for this week. Plan the next one from Upcoming.</p>}
          {shopped && !started && view !== 'recipes' && (
            <div className="seg2">
              <button className={sub === 'plan' ? 'on' : ''} onClick={() => goSub('plan')}>Plan</button>
              <button className={sub === 'recipes' ? 'on' : ''} onClick={() => goSub('recipes')}>Recipes</button>
              <button className={sub === 'ingredients' ? 'on' : ''} onClick={() => goSub('ingredients')}>Ingredients</button>
            </div>
          )}

          <div key={`${sub}-${menuFilter}`} className="fade">
          {sub === 'plan' && <>
            {/* Built from the days, not plan.issues, so plans saved before the wording changed show the current message. */}
            {(plan.days.length ? explainMisses(plan.days, t.band, t.protein) : plan.issues).map((i) => <div key={i} className="estimate-flag">{i}</div>)}
            {plan.days.length > 0 && !shopped && <PriceNote totalPence={shopping.totalPence} store={store} />}
            {plan.days.length > 0 && (finished || (started && allEaten(plan, week.ticks)))
              ? <WeekDone store={store} s={summariseWeek(plan, week.ticks, shopping)} t={t} />
              : plan.days.length > 0 && (todayIdx >= 0 && !plan.days[todayIdx].off
                ? <DailyProgress eaten={dayEaten(plan.days[todayIdx], todayIdx, week.ticks)} t={t} />
                : <DailyAverage averages={weekAverages(plan)} t={t} />)}
            {dayOrder.map(({ d, i }) => (
              <DayCard key={d.day} d={d} index={i} ticks={eating ? week.ticks : undefined} onOpen={setSheet} today={started && !finished && addDays(week.start, i) === londonDate(now)}
                onSwap={finished || shopped ? undefined : (day, meal) => setSwap({ week: week.start, day, meal })}
                onTick={eating && !finished ? (k) => { const [di, mi] = k.split(':').map(Number); const rid = plan.days[di]?.meals[mi]?.recipeId; if (rid && !week.ticks[k] && !profile.likedRecipes.includes(rid) && !profile.skippedRecipes.includes(rid)) setRate(rid); update((p) => ({ ...p, weeks: toggleTick(p.weeks, week.start, k) })); } : undefined} newIds={newIds} />
            ))}
            <WeekendGuide profile={profile} onOpen={setSheet} />
          </>}

          {sub === 'ingredients' && shopped && !started && (
            <>
              <ListStepBody store={store} shopping={shopping} have={week.haveAlready} want={wantCup} onToggleCupboard={toggleCupboard} onCheckedOut={() => markShopped('basket')} onToggle={toggleHave} />
              {copied?.startsWith('fail:') && <textarea className="copybox" readOnly value={copied.slice(5)} onFocus={(e) => e.currentTarget.select()} />}
            </>
          )}

          {sub === 'recipes' && (!menuTab || menuFilter === 'week') && plan.days.filter((d) => !d.off && d.meals.length > 0).map((d) => {
            const i = plan.days.indexOf(d);
            return (
              <section key={d.day} className="rday">
                <p className="group-title">{d.day} <span className="rdate">{dayLabel(addDays(week.start, i))}</span></p>
                <div className="rgrid">
                  {d.meals.map((m, mi) => {
                    const r = recipeById.get(m.recipeId);
                    if (!r) return null;
                    return (
                      <button key={`${m.recipeId}-${mi}`} className="rcard" onClick={() => setSheet(m.recipeId)}>
                        {r.img ? <MealImage r={r} size="thumb" sizes="(max-width: 430px) 45vw, 200px" /> : <span className="emoji">{r.e}</span>}
                        <span className="rslot">{{ breakfast: 'Breakfast', lunch: 'Lunch', snack: 'Snack', dinner: 'Dinner' }[m.slot]}</span>
                        <span className="nm">{r.n}</span>
                      </button>
                    );
                  })}
                </div>
              </section>
            );
          })}
          {sub === 'recipes' && menuTab && menuFilter === 'liked' && (likedRecipes.length === 0
            ? <p className="muted">Nothing liked yet. Swipe through meals in Adjust My Taste, or tap Like It on any recipe.</p>
            : COURSES.filter((c) => likedRecipes.some((r) => r.c === c)).map((c) => (
              <section key={c} className="rday">
                <p className="group-title">{COURSE_PLURAL[c]}</p>
                <div className="rgrid">
                  {likedRecipes.filter((r) => r.c === c).map((r) => (
                    <button key={r.id} className="rcard" onClick={() => setSheet(r.id)}>
                      {r.img ? <MealImage r={r} size="thumb" sizes="(max-width: 430px) 45vw, 200px" /> : <span className="emoji">{r.e}</span>}
                      <span className="nm">{r.n}</span>
                    </button>
                  ))}
                </div>
              </section>
            )))}
          {sub === 'recipes' && menuTab && menuFilter === 'eaten' && (eatenRecipes.length === 0
            ? <p className="muted">Nothing eaten yet. Tick meals off as you eat them and they&apos;ll collect here.</p>
            : <div className="rgrid" style={{ marginTop: 14 }}>
              {eatenRecipes.map((r) => (
                <button key={r.id} className="rcard" onClick={() => setSheet(r.id)}>
                  {r.img ? <MealImage r={r} size="thumb" sizes="(max-width: 430px) 45vw, 200px" /> : <span className="emoji">{r.e}</span>}
                  <span className="rslot">Eaten {eatenCounts[r.id]}×{profile.likedRecipes.includes(r.id) ? ' · Liked' : ''}</span>
                  <span className="nm">{r.n}</span>
                </button>
              ))}
            </div>)}
          {sub === 'recipes' && (
            <div className="card tastelink">
              <h3 className="ico-h"><Heart size={18} aria-hidden />Not Feeling These?</h3>
              <p className="muted">The planner picks from the meals you keep. Adjust your taste and your next plan changes.</p>
              <button className="btn ghost" onClick={() => { update((p) => ({ ...p, completed: false, step: 'taste' })); router.push('/onboarding'); }}>Adjust My Taste</button>
            </div>
          )}

          {!profile.reminders.on && profile.reminders.asked && (
            <div className="card remind-card">
              <h3>Never Miss a Week</h3>
              <p className="muted">Sunday morning: next week&apos;s meals are open. The Sunday after, 4pm: last chance, pick by midnight.</p>
              <button className="btn ghost" onClick={enableReminders}>Turn On Reminders</button>
            </div>
          )}
          {profile.reminders.on && <p className="muted">Reminders are on. For now they appear when you open Table Plan; alerts while the app is closed need the server side, coming next.</p>}
          </div>
        </div>
      )}

      {tab === 'upcoming' && (
        <div className="fade" key="up">
          <h1>Upcoming</h1>
          <p className="sub">Each week opens for planning on Sunday at 6am, after we refresh {store.name} prices, so your list always uses the latest ones.</p>
          <div className="pricefresh"><RefreshCw size={16} aria-hidden /><span>Prices last checked {checkedAtFor(store.id) ? shortDate(checkedAtFor(store.id)!) : 'not yet'}. Next refresh: Sunday morning.</span></div>
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
                  {sel && upcomingSel && <div className="wkbody"><UpcomingCard week={upcomingSel.week} status={upcomingSel.status} weeks={weeks} now={now} store={store}
            onPlan={() => router.push(access ? '/plan/next' : '/subscribe')}
            onSkip={() => update((p) => ({ ...p, weeks: skipWeek(p.weeks, upcomingSel.week.start, now) }))}
            onUndo={() => update((p) => ({ ...p, weeks: undoSkip(p.weeks, upcomingSel.week.start, now) }))}
            onCopy={(text) => copy(text, upcomingSel.week.start)} copied={copied} onOpen={setSheet}
            onSwap={(day, meal) => setSwap({ week: upcomingSel.week.start, day, meal })}
            onToggleCupboard={(k) => update((p) => { const w = p.weeks[upcomingSel.week.start]; const cur = w.wantCupboard ?? []; return { ...p, weeks: { ...p.weeks, [w.start]: { ...w, wantCupboard: cur.includes(k) ? cur.filter((x) => x !== k) : [...cur, k] } } }; })}
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
      {listOpen && access && (
        <CheckoutSheet onClose={() => setListOpen(false)} footer={<CheckoutBar store={store} onCopy={async () => { if (await copyList()) setTimeout(() => setListOpen(false), 1300); }} copied={copied === 'this'} onCheckout={checkout} />}>
          <ListStepBody store={store} shopping={shopping} have={week.haveAlready} want={wantCup} onToggleCupboard={toggleCupboard} onToggle={toggleHave} onCheckedOut={() => markShopped('basket')} />
          {copied?.startsWith('fail:') && <textarea className="copybox" readOnly value={copied.slice(5)} onFocus={(e) => e.currentTarget.select()} />}
        </CheckoutSheet>
      )}
      {rate && recipeById.get(rate) && (
        <RateSheet meal={recipeById.get(rate)!.n} onLike={() => { update((p) => likeMeal(p, rate)); setRate(null); }}
          onNever={() => { update((p) => neverAgain(p, rate)); setRate(null); }} onClose={() => setRate(null)} />
      )}
      <RecipeSheet store={store} id={sheet} onClose={() => setSheet(null)} portions={1} onNever={(rid) => update((p) => neverAgain(p, rid))} rating={sheet ? { ...rating, liked: profile.likedRecipes.includes(sheet) } : undefined} />
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

function UpcomingCard({ week, status, weeks, now, store, onPlan, onSkip, onUndo, onCopy, copied, onOpen, onSwap, onToggleHave, onToggleCupboard }: {
  week: Week; status: WeekStatus; weeks: Record<string, Week>; now: Date; store: Store; onPlan: () => void; onSkip: () => void; onUndo: () => void;
  onCopy: (t: string) => void; copied: string | null; onOpen: (id: string) => void; onSwap: (day: number, meal: number) => void; onToggleHave: (k: string) => void; onToggleCupboard: (k: string) => void;
}) {
  const deadline = `midnight Sun ${dayLabel(addDays(week.start, -1))}`;
  if (status === 'locked') return <div className="card"><h3>Why Sunday at 6am?</h3><p className="muted" style={{ margin: 0 }}>We refresh the {store.name} prices first, so your shopping list uses the latest ones. Only one week is open to plan at a time.</p></div>;
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
  const shopping = buildShoppingFor(plan, store.id);
  return (
    <div>
      <p className="muted">Planned. Starts Mon {dayLabel(week.start)}.</p>
      {plan.days.map((d, i) => <DayCard key={d.day} d={d} index={i} onOpen={onOpen} onSwap={onSwap} />)}
      <h2 style={{ marginTop: 22 }}>Shopping List</h2>
      <ListStepBody store={store} shopping={shopping} have={week.haveAlready} onToggle={onToggleHave} want={week.wantCupboard ?? []} onToggleCupboard={onToggleCupboard} />
      <CheckoutBar store={store} onCopy={() => onCopy(listAsText(plan, week.haveAlready, `Estimated ${store.name} prices, checked ${checkedAtFor(store.id) ? shortDate(checkedAtFor(store.id)!) : 'not yet'}`, week.wantCupboard, store))} copied={copied === week.start} />
      {copied?.startsWith('fail:') && <textarea className="copybox" readOnly value={copied.slice(5)} onFocus={(e) => e.currentTarget.select()} />}
    </div>
  );
}
