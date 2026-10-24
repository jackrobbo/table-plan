'use client';
import { useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { RECIPES } from '@/data';
import PriceNote from '@/components/PriceNote';
import Screen from '@/components/Screen';
import { getBackend } from '@/lib/db';
import { planInputFrom } from '@/lib/planner/fromProfile';
import { buildShopping } from '@/lib/planner/shopping';
import { planWeek } from '@/lib/planner/solve';
import type { PlannedDay, PlannedMeal } from '@/lib/planner/types';
import { computeTargets } from '@/lib/targets';
import { useProfile } from '@/lib/useProfile';

const recipeById = new Map(RECIPES.map((r) => [r.id, r]));
const SLOT_LABEL: Record<string, string> = { breakfast: 'Breakfast', lunch: 'Lunch', snack: 'Snack', dinner: 'Dinner' };
const money = (p: number) => '£' + (p / 100).toFixed(2);

/** First day of the next full Mon–Fri week, e.g. "Mon 2 Nov". */
function nextMonday(now = new Date()) {
  const d = new Date(now);
  d.setDate(d.getDate() + ((8 - d.getDay()) % 7 || 7));
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}

function MealRow({ m }: { m: PlannedMeal }) {
  const r = recipeById.get(m.recipeId)!;
  return (
    <div className="meal">
      <span className="slot">{SLOT_LABEL[m.slot]}</span>
      <div className="mbody">
        <div className="mname">{r.e} {r.n}</div>
        <div className="tags">
          <span className="p">P {m.protein}g</span><span>{m.kcal} kcal</span>
          {Math.abs(m.scale - 1) >= 0.02 && <span className="adj">Portion {Math.round(m.scale * 100)}%</span>}
          {m.extra > 0 && <span>+{m.extra} to share</span>}
        </div>
      </div>
    </div>
  );
}

function DayCard({ d }: { d: PlannedDay }) {
  return (
    <section className={'daycard' + (d.adjusted ? ' adjusted' : '')} aria-label={d.day}>
      <header>
        <h3>{d.day}</h3>
        <span className="daytot"><i className={'dot' + (d.inBand ? '' : ' amber')} />{d.protein}g protein · {d.kcal.toLocaleString('en-GB')} kcal</span>
      </header>
      {d.meals.map((m, i) => <MealRow key={i} m={m} />)}
      {d.topups.map((t) => (
        <div className="meal" key={t.n}>
          <span className="slot">Top-up</span>
          <div className="mbody">
            <div className="mname">{t.n}</div>
            <div className="tags"><span className="p">P {t.p}g</span><span>{t.k} kcal</span><span className="adj">Added to hit your day</span></div>
          </div>
        </div>
      ))}
      {d.reserved.kcal > 0 && (
        <p className="muted reserved">{d.reserved.kcal} kcal and {d.reserved.protein}g protein kept for meals you sort yourself.</p>
      )}
    </section>
  );
}

export default function Plan() {
  const router = useRouter();
  const { session, profile, ready, update } = useProfile();

  useEffect(() => {
    if (!ready) return;
    if (!session) router.replace('/signin');
    else if (profile && !profile.completed) router.replace('/onboarding');
  }, [ready, session, profile, router]);

  const needsPlan = ready && !!profile?.completed && !profile.plan;
  useEffect(() => {
    if (needsPlan) update((p) => ({ ...p, plan: planWeek(planInputFrom(p)) }));
  }, [needsPlan, update]);

  const plan = profile?.plan ?? null;
  const shopping = useMemo(() => (plan?.days.length ? buildShopping(plan) : null), [plan]);

  if (!ready || !profile?.completed || !session || !plan) return <Screen><p className="muted">Building your week…</p></Screen>;
  const t = computeTargets(profile.goal ?? 'lose', profile.stats);

  return (
    <Screen footer={<>
      <button className="btn ghost" onClick={() => update((p) => ({ ...p, plan: planWeek(planInputFrom(p), 24, Math.floor(Math.random() * 1e6)) }))}>
        Shuffle my week
      </button>
      <button className="linkbtn" onClick={() => update((p) => ({ ...p, completed: false, step: 'goal', plan: null }))}>Edit my answers</button>
      <button className="linkbtn" onClick={async () => { await getBackend().auth.signOut(); router.replace('/'); }}>Sign out ({session.email})</button>
    </>}>
      <h1>Here&apos;s your first week</h1>
      <p className="sub">
        Starts {nextMonday()}. Built from what you like, kept inside {t.band[0].toLocaleString('en-GB')}–{t.band[1].toLocaleString('en-GB')} kcal
        and ≥{t.protein}g protein a day.
      </p>
      <div className="legend"><span><i className="dot" />in band</span><span><i className="dot amber" />resized, topped up or off target</span></div>
      {plan.issues.map((i) => <div key={i} className="estimate-flag">{i}</div>)}
      {plan.days.map((d) => <DayCard key={d.day} d={d} />)}

      {shopping && (
        <>
          <h2 style={{ marginTop: 28 }}>Your shopping list</h2>
          <PriceNote totalPence={shopping.totalPence} />
          <div className="card list">
            {shopping.lines.map((l) => (
              <div className="line" key={l.key}>
                <div>
                  <b>{l.name}{l.packs > 1 ? ` ×${l.packs}` : ''}</b>
                  <div className="muted">{l.usedBy.slice(0, 3).join(', ')}</div>
                  {l.status && l.status !== 'ok' && <div className="flag">May be unavailable at the moment</div>}
                </div>
                <span className="price">{money(l.costPence)}</span>
              </div>
            ))}
          </div>
          <p className="muted">≈ {money(Math.round(shopping.totalPence / 5))} a day, before anything you already have.</p>
          <div className="note"><b>Store cupboard check.</b> Staples this week dips into; buy only if you&apos;re out:<br />{shopping.cupboard.join(' · ')}</div>
        </>
      )}
    </Screen>
  );
}
