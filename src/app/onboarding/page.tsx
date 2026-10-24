'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ALLERGENS, safeRecipes, type Allergen } from '@/lib/allergens';
import { DISLIKE_GROUPS } from '@/lib/dislikes';
import {
  SKIPPABLE, advance, back, canContinue, setAllergies, skipStat, stepIndex, STEPS, swipe, swipeCourses,
  tasteProgress, MIN_LIKES, type SkippableStep,
} from '@/lib/onboarding';
import type { Goal, Profile, MealTime } from '@/lib/profile';
import { computeTargets, type Sex } from '@/lib/targets';
import { cmToFtIn, ftInToCm, kgToLb, kgToStLb, lbToKg, stLbToKg } from '@/lib/units';
import { useProfile } from '@/lib/useProfile';

type Upd = (fn: (p: Profile) => Profile) => void;
const num = (v: string) => (v === '' ? undefined : Number(v));

export default function Onboarding() {
  const router = useRouter();
  const { session, profile, ready, update } = useProfile();

  useEffect(() => { if (ready && !session) router.replace('/signin'); }, [ready, session, router]);
  useEffect(() => { if (profile?.completed) router.replace('/plan'); }, [profile?.completed, router]);

  if (!ready || !profile) return <p className="muted">Loading…</p>;

  const step = profile.step;
  const ok = canContinue(profile, step);
  const skippable = (SKIPPABLE as readonly string[]).includes(step);

  return (
    <>
      <div className="progress" aria-label={`Step ${stepIndex(step) + 1} of ${STEPS.length}`}>
        {STEPS.map((s, i) => <div key={s} className={'seg' + (i <= stepIndex(step) ? ' on' : '')} />)}
      </div>

      {step === 'goal' && <GoalStep p={profile} update={update} />}
      {step === 'height' && <HeightStep p={profile} update={update} />}
      {step === 'weight' && <WeightStep p={profile} update={update} />}
      {step === 'age' && <AgeStep p={profile} update={update} />}
      {step === 'sex' && <SexStep p={profile} update={update} />}
      {step === 'activity' && <ActivityStep p={profile} update={update} />}
      {step === 'meals' && <MealsStep p={profile} update={update} />}
      {step === 'allergies' && <AllergiesStep p={profile} update={update} />}
      {step === 'target' && <TargetStep p={profile} />}
      {step === 'dislikes' && <DislikesStep p={profile} update={update} />}
      {step === 'taste' && <TasteStep p={profile} update={update} />}

      <div className="sticky">
        <button className="btn" disabled={!ok} onClick={() => update(advance)}>
          {step === 'taste' ? 'Finish' : 'Continue'}
        </button>
        {stepIndex(step) > 0 && <button className="btn ghost" onClick={() => update(back)}>Back</button>}
        {skippable && (
          <button className="linkbtn" onClick={() => update((p) => advance(skipStat(p, step as SkippableStep)))}>
            Prefer not to say
          </button>
        )}
      </div>
      {skippable && <p className="muted">Optional. Your stats make your numbers more personal; skip and we&apos;ll use sensible defaults.</p>}
    </>
  );
}

interface SP { p: Profile; update: Upd }

function GoalStep({ p, update }: SP) {
  const goals: [Goal, string, string][] = [
    ['lose', 'Lose weight', 'Steady loss, about 1 lb a week'],
    ['maintain', 'Maintain', 'Keep your weight where it is'],
    ['gain', 'Build', 'A small surplus with plenty of protein'],
  ];
  return (
    <>
      <h2>What&apos;s your goal?</h2>
      <div className="opts">
        {goals.map(([g, t, d]) => (
          <button key={g} className={'opt' + (p.goal === g ? ' on' : '')} onClick={() => update((x) => ({ ...x, goal: g }))}>
            <b>{t}</b><span>{d}</span>
          </button>
        ))}
      </div>
    </>
  );
}

function HeightStep({ p, update }: SP) {
  const cm = p.stats.heightCm;
  const ft = cm ? cmToFtIn(cm) : { ft: undefined, inch: undefined };
  const set = (heightCm: number | undefined) => update((x) => ({ ...x, stats: { ...x.stats, heightCm }, skipped: { ...x.skipped, height: undefined } }));
  return (
    <>
      <h2>How tall are you?</h2>
      <div className="seg2">
        {(['cm', 'ftin'] as const).map((u) => (
          <button key={u} className={p.heightUnit === u ? 'on' : ''} onClick={() => update((x) => ({ ...x, heightUnit: u }))}>
            {u === 'cm' ? 'cm' : 'ft / in'}
          </button>
        ))}
      </div>
      {p.heightUnit === 'cm' ? (
        <div className="grid2"><div><label className="f">Height (cm)</label>
          <input type="number" inputMode="numeric" value={cm ?? ''} onChange={(e) => set(num(e.target.value))} /></div></div>
      ) : (
        <div className="grid2">
          <div><label className="f">Feet</label>
            <input type="number" inputMode="numeric" value={ft.ft ?? ''} onChange={(e) => set(e.target.value === '' ? undefined : ftInToCm(+e.target.value, ft.inch ?? 0))} /></div>
          <div><label className="f">Inches</label>
            <input type="number" inputMode="numeric" value={ft.inch ?? ''} onChange={(e) => set(ftInToCm(ft.ft ?? 0, +e.target.value))} /></div>
        </div>
      )}
    </>
  );
}

function WeightStep({ p, update }: SP) {
  const kg = p.stats.weightKg;
  const stlb = kg ? kgToStLb(kg) : { st: undefined, lb: undefined };
  const set = (weightKg: number | undefined) => update((x) => ({ ...x, stats: { ...x.stats, weightKg }, skipped: { ...x.skipped, weight: undefined } }));
  return (
    <>
      <h2>How much do you weigh?</h2>
      <div className="seg2">
        {([['kg', 'kg'], ['stlb', 'st / lb'], ['lb', 'lb']] as const).map(([u, l]) => (
          <button key={u} className={p.weightUnit === u ? 'on' : ''} onClick={() => update((x) => ({ ...x, weightUnit: u }))}>{l}</button>
        ))}
      </div>
      {p.weightUnit === 'kg' && (
        <div className="grid2"><div><label className="f">Weight (kg)</label>
          <input type="number" inputMode="decimal" value={kg ?? ''} onChange={(e) => set(num(e.target.value))} /></div></div>
      )}
      {p.weightUnit === 'lb' && (
        <div className="grid2"><div><label className="f">Weight (lb)</label>
          <input type="number" inputMode="numeric" value={kg ? kgToLb(kg) : ''} onChange={(e) => set(e.target.value === '' ? undefined : lbToKg(+e.target.value))} /></div></div>
      )}
      {p.weightUnit === 'stlb' && (
        <div className="grid2">
          <div><label className="f">Stone</label>
            <input type="number" inputMode="numeric" value={stlb.st ?? ''} onChange={(e) => set(e.target.value === '' ? undefined : stLbToKg(+e.target.value, stlb.lb ?? 0))} /></div>
          <div><label className="f">Pounds</label>
            <input type="number" inputMode="numeric" value={stlb.lb ?? ''} onChange={(e) => set(stLbToKg(stlb.st ?? 0, +e.target.value))} /></div>
        </div>
      )}
    </>
  );
}

function AgeStep({ p, update }: SP) {
  return (
    <>
      <h2>How old are you?</h2>
      <div className="grid2"><div><label className="f">Age</label>
        <input type="number" inputMode="numeric" value={p.stats.age ?? ''}
          onChange={(e) => update((x) => ({ ...x, stats: { ...x.stats, age: num(e.target.value) }, skipped: { ...x.skipped, age: undefined } }))} /></div></div>
      <p className="muted">Table Plan is for adults (18+).</p>
    </>
  );
}

function SexStep({ p, update }: SP) {
  return (
    <>
      <h2>Are you male or female?</h2>
      <p className="muted">Used only for the calorie formula.</p>
      <div className="opts">
        {([['f', 'Female'], ['m', 'Male']] as [Sex, string][]).map(([v, l]) => (
          <button key={v} className={'opt' + (p.stats.sex === v ? ' on' : '')}
            onClick={() => update((x) => ({ ...x, stats: { ...x.stats, sex: v }, skipped: { ...x.skipped, sex: undefined } }))}>
            <b>{l}</b>
          </button>
        ))}
      </div>
    </>
  );
}

function ActivityStep({ p, update }: SP) {
  const opts: [number, string, string][] = [
    [1.2, 'Mostly sitting', 'Desk job, little exercise'],
    [1.375, 'Lightly active', 'On your feet some of the day, or a few walks'],
    [1.55, 'Active', 'Regular training or a physical job'],
    [1.725, 'Very active', 'Hard training most days'],
  ];
  return (
    <>
      <h2>How active are you?</h2>
      <div className="opts">
        {opts.map(([v, t, d]) => (
          <button key={v} className={'opt' + (p.stats.activity === v ? ' on' : '')}
            onClick={() => update((x) => ({ ...x, stats: { ...x.stats, activity: v } }))}>
            <b>{t}</b><span>{d}</span>
          </button>
        ))}
      </div>
    </>
  );
}

function MealsStep({ p, update }: SP) {
  const labels: Record<MealTime, string> = { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner' };
  const set = (m: MealTime, patch: Partial<Profile['meals'][MealTime]>) =>
    update((x) => ({ ...x, meals: { ...x.meals, [m]: { ...x.meals[m], ...patch } } }));
  return (
    <>
      <h2>Which meals should we plan?</h2>
      <p className="muted">&quot;Macros only&quot; reserves the calories and protein for a meal you sort yourself.</p>
      {(Object.keys(labels) as MealTime[]).map((m) => {
        const s = p.meals[m];
        return (
          <div className="mealrow" key={m}>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <h3>{labels[m]}</h3>
              <div className="seg2" style={{ margin: 0 }}>
                <button className={s.mode === 'plan' ? 'on' : ''} onClick={() => set(m, { mode: 'plan' })}>Plan it</button>
                <button className={s.mode === 'macros' ? 'on' : ''} onClick={() => set(m, { mode: 'macros', extraServings: 0 })}>Macros only</button>
              </div>
            </div>
            {s.mode === 'plan' && (
              <div className="row" style={{ justifyContent: 'space-between', marginTop: 8 }}>
                <span className="muted">Extra servings for others</span>
                <span className="stepper">
                  <button aria-label="Fewer" onClick={() => set(m, { extraServings: Math.max(0, s.extraServings - 1) })}>−</button>
                  <b>{s.extraServings}</b>
                  <button aria-label="More" onClick={() => set(m, { extraServings: Math.min(8, s.extraServings + 1) })}>+</button>
                </span>
              </div>
            )}
          </div>
        );
      })}
      {swipeCourses(p).length === 0 && <p className="err">Plan at least one meal.</p>}
    </>
  );
}

function AllergiesStep({ p, update }: SP) {
  const toggle = (a: Allergen) =>
    update((x) => setAllergies(x, x.allergies.includes(a) ? x.allergies.filter((y) => y !== a) : [...x.allergies, a]));
  return (
    <>
      <h2>Any allergies in your household?</h2>
      <p className="muted">Anyone you cook for. Meals containing these are never suggested.</p>
      <div className="chips">
        {ALLERGENS.map(([k, l]) => (
          <button key={k} className={'chip' + (p.allergies.includes(k) ? ' on' : '')} onClick={() => toggle(k)}>{l}</button>
        ))}
      </div>
      <div className="chips">
        <button className={'chip' + (p.noAllergies ? ' on' : '')}
          onClick={() => update((x) => ({ ...setAllergies(x, []), noAllergies: true }))}>No one has allergies</button>
      </div>
      <p className="muted">Vegetarian and vegan plans: coming soon.</p>
    </>
  );
}

function TargetStep({ p }: { p: Profile }) {
  const t = computeTargets(p.goal ?? 'lose', p.stats);
  return (
    <>
      <h2>Your daily target</h2>
      <div className="targets">
        <div className="ticketc"><span className="lbl">Calories</span><span className="big">{t.band[0]}–{t.band[1]}</span></div>
        <div className="ticketc"><span className="lbl">Protein floor</span><span className="big">{t.protein}g</span></div>
      </div>
      <p className="muted">
        {t.maintenance ? `Based on your stats (estimated maintenance ${t.maintenance} kcal). ` : 'Using a sensible default; add your stats for a personal number. '}
        Steady, not extreme.
      </p>
      <div className="note">General nutrition guidance, not medical advice. If you have a medical condition or take medication, talk to your GP before changing your diet.</div>
    </>
  );
}

function DislikesStep({ p, update }: SP) {
  const [q, setQ] = useState('');
  const toggle = (d: string) =>
    update((x) => ({ ...x, dislikes: x.dislikes.includes(d) ? x.dislikes.filter((y) => y !== d) : [...x.dislikes, d] }));
  return (
    <>
      <h2>Anything you don&apos;t like?</h2>
      <p className="muted">We&apos;ll rank these lower. Optional — skip if you eat anything.</p>
      <input placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} />
      {DISLIKE_GROUPS.map((g) => {
        const items = g.items.filter((i) => i.toLowerCase().includes(q.toLowerCase()));
        if (!items.length) return null;
        return (
          <div key={g.group}>
            <h3 style={{ marginTop: 16 }}>{g.group}</h3>
            <div className="chips">
              {items.map((i) => (
                <button key={i} className={'chip' + (p.dislikes.includes(i) ? ' on' : '')} onClick={() => toggle(i)}>{i}</button>
              ))}
            </div>
          </div>
        );
      })}
    </>
  );
}

function TasteStep({ p, update }: SP) {
  const courses = swipeCourses(p);
  const [tab, setTab] = useState<MealTime>(courses[0] ?? 'dinner');
  const prog = tasteProgress(p);
  const seen = new Set([...p.likedRecipes, ...p.skippedRecipes]);
  const pool = safeRecipes(p.allergies).filter((r) => r.c === tab);
  const next = pool.find((r) => !seen.has(r.id));
  const label: Record<MealTime, string> = { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner' };
  return (
    <>
      <h2>What would you happily eat?</h2>
      <p className="muted">Keep at least {MIN_LIKES} for each meal type. There&apos;s no upper limit.</p>
      <div className="tabs">
        {courses.map((c) => (
          <button key={c} className={'chip' + (tab === c ? ' on' : '')} onClick={() => setTab(c)}>
            {label[c]} {prog[c].liked}/{prog[c].needed}
          </button>
        ))}
      </div>
      {next ? (
        <div className="swipecard">
          <span className="emoji">{next.e}</span>
          <h3>{next.n}</h3>
          <p className="muted" style={{ margin: '0 auto' }}>{next.p}g protein · {next.k} kcal{next.serves > 1 ? ` · serves ${next.serves}` : ''}</p>
          <div className="row" style={{ justifyContent: 'center', marginTop: 14 }}>
            <button className="btn ghost" onClick={() => update((x) => swipe(x, next.id, false))}>Skip</button>
            <button className="btn" onClick={() => update((x) => swipe(x, next.id, true))}>Keep</button>
          </div>
        </div>
      ) : (
        <div className="note">
          That&apos;s all the {label[tab].toLowerCase()} options for now.
          {prog[tab].liked < prog[tab].needed && (
            <> You need {prog[tab].needed - prog[tab].liked} more —{' '}
              <button className="linkbtn" onClick={() => update((x) => ({ ...x, skippedRecipes: x.skippedRecipes.filter((id) => !pool.some((r) => r.id === id)) }))}>
                revisit skipped
              </button>.</>
          )}
        </div>
      )}
    </>
  );
}
