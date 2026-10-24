'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ALLERGENS, safeRecipes, type Allergen } from '@/lib/allergens';
import { tierMark } from '@/lib/budget';
import { DISLIKE_GROUPS } from '@/lib/dislikes';
import {
  SKIPPABLE, advance, back, canContinue, setAllergies, skipStat, stepIndex, STEPS, swipe, swipeCourses,
  tasteDeck, tasteProgress, MIN_LIKES, type SkippableStep,
} from '@/lib/onboarding';
import type { Goal, Profile, MealTime } from '@/lib/profile';
import { computeTargets, type Sex } from '@/lib/targets';
import { cmToFtIn, ftInToCm, kgToLb, kgToStLb, lbToKg, stLbToKg } from '@/lib/units';
import MealImage from '@/components/MealImage';
import Screen from '@/components/Screen';
import { track } from '@/lib/analytics';
import { useProfile } from '@/lib/useProfile';

type Upd = (fn: (p: Profile) => Profile) => void;
const num = (v: string) => (v === '' ? undefined : Number(v));

export default function Onboarding() {
  const router = useRouter();
  const { session, profile, ready, update } = useProfile();

  useEffect(() => { if (ready && !session) router.replace('/signin'); }, [ready, session, router]);
  useEffect(() => { if (profile?.completed) router.replace('/plan'); }, [profile?.completed, router]);

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

interface SP { p: Profile; update: Upd }

const Title = ({ children, sub }: { children: React.ReactNode; sub?: string }) => (
  <><h2>{children}</h2>{sub && <p className="sub">{sub}</p>}</>
);

function Radio({ on, title, desc, onClick }: { on: boolean; title: string; desc?: string; onClick: () => void }) {
  return (
    <button className={'opt' + (on ? ' on' : '')} role="radio" aria-checked={on} onClick={onClick}>
      <span><b>{title}</b>{desc && <span className="d">{desc}</span>}</span><span className="radio" />
    </button>
  );
}

function GoalStep({ p, update }: SP) {
  const goals: [Goal, string, string][] = [
    ['lose', 'Lose weight', 'Steady loss, about 1 lb a week'],
    ['maintain', 'Maintain', 'Steady energy'],
    ['gain', 'Gain weight', 'Surplus for muscle'],
  ];
  return (
    <>
      <Title sub="Sets your calorie band and protein floor.">What&apos;s your goal?</Title>
      <div className="opts" role="radiogroup">
        {goals.map(([g, t, d]) => <Radio key={g} on={p.goal === g} title={t} desc={d} onClick={() => update((x) => ({ ...x, goal: g }))} />)}
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
      <Title sub="Private. Only used to size your portions.">How tall are you?</Title>
      <div className="seg2">
        {(['cm', 'ftin'] as const).map((u) => (
          <button key={u} className={p.heightUnit === u ? 'on' : ''} onClick={() => update((x) => ({ ...x, heightUnit: u }))}>{u === 'cm' ? 'cm' : 'ft / in'}</button>
        ))}
      </div>
      {p.heightUnit === 'cm' ? (
        <div className="value"><label><input aria-label="Height in centimetres" type="number" inputMode="numeric" placeholder="170" value={cm ?? ''} onChange={(e) => set(num(e.target.value))} /><span className="unit">cm</span></label></div>
      ) : (
        <div className="value">
          <label><input aria-label="Feet" type="number" inputMode="numeric" placeholder="5" value={ft.ft ?? ''} onChange={(e) => set(e.target.value === '' ? undefined : ftInToCm(+e.target.value, ft.inch ?? 0))} /><span className="unit">ft</span></label>
          <label><input aria-label="Inches" type="number" inputMode="numeric" placeholder="7" value={ft.inch ?? ''} onChange={(e) => set(ftInToCm(ft.ft ?? 0, +e.target.value))} /><span className="unit">in</span></label>
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
      <Title sub="Private. You can update it any time.">What do you weigh?</Title>
      <div className="seg2">
        {([['kg', 'kg'], ['stlb', 'st / lb'], ['lb', 'lb']] as const).map(([u, l]) => (
          <button key={u} className={p.weightUnit === u ? 'on' : ''} onClick={() => update((x) => ({ ...x, weightUnit: u }))}>{l}</button>
        ))}
      </div>
      {p.weightUnit === 'kg' && (
        <div className="value"><label><input className="wide" aria-label="Weight in kilograms" type="number" inputMode="decimal" placeholder="70" value={kg ?? ''} onChange={(e) => set(num(e.target.value))} /><span className="unit">kg</span></label></div>
      )}
      {p.weightUnit === 'lb' && (
        <div className="value"><label><input className="wide" aria-label="Weight in pounds" type="number" inputMode="numeric" placeholder="154" value={kg ? kgToLb(kg) : ''} onChange={(e) => set(e.target.value === '' ? undefined : lbToKg(+e.target.value))} /><span className="unit">lb</span></label></div>
      )}
      {p.weightUnit === 'stlb' && (
        <div className="value">
          <label><input aria-label="Stone" type="number" inputMode="numeric" placeholder="11" value={stlb.st ?? ''} onChange={(e) => set(e.target.value === '' ? undefined : stLbToKg(+e.target.value, stlb.lb ?? 0))} /><span className="unit">st</span></label>
          <label><input aria-label="Pounds" type="number" inputMode="numeric" placeholder="0" value={stlb.lb ?? ''} onChange={(e) => set(stLbToKg(stlb.st ?? 0, +e.target.value))} /><span className="unit">lb</span></label>
        </div>
      )}
    </>
  );
}

function AgeStep({ p, update }: SP) {
  return (
    <>
      <Title sub="Calorie needs change with age. Table Plan is for adults (18+).">How old are you?</Title>
      <div className="value"><label><input aria-label="Age in years" type="number" inputMode="numeric" placeholder="34" value={p.stats.age ?? ''}
        onChange={(e) => update((x) => ({ ...x, stats: { ...x.stats, age: num(e.target.value) }, skipped: { ...x.skipped, age: undefined } }))} /><span className="unit">years</span></label></div>
    </>
  );
}

function SexStep({ p, update }: SP) {
  return (
    <>
      <Title sub="Men and women need slightly different calories.">Are you male or female?</Title>
      <div className="opts" role="radiogroup">
        {([['f', 'Female'], ['m', 'Male']] as [Sex, string][]).map(([v, l]) => (
          <Radio key={v} on={p.stats.sex === v} title={l}
            onClick={() => update((x) => advance({ ...x, stats: { ...x.stats, sex: v }, skipped: { ...x.skipped, sex: undefined } }))} />
        ))}
      </div>
    </>
  );
}

function ActivityStep({ p, update }: SP) {
  const opts: [number, string, string][] = [
    [1.2, 'Mostly sitting', 'Desk job, little exercise'],
    [1.375, 'Lightly active', 'On your feet, walks'],
    [1.55, 'Active', 'Exercise 3–5 days'],
    [1.725, 'Very active', 'Physical job or daily training'],
  ];
  return (
    <>
      <Title sub="Most days, including work.">How active are you?</Title>
      <div className="opts" role="radiogroup">
        {opts.map(([v, t, d]) => <Radio key={v} on={p.stats.activity === v} title={t} desc={d} onClick={() => update((x) => ({ ...x, stats: { ...x.stats, activity: v } }))} />)}
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
      <Title sub="Planned meals come with recipes and go on your list. For the rest, you just get a macro target.">Which meals should we plan?</Title>
      {(Object.keys(labels) as MealTime[]).map((m) => {
        const s = p.meals[m];
        return (
          <div className="mealrow" key={m}>
            <div className="top">
              <h3>{labels[m]}</h3>
              <div className="seg2 small">
                <button className={s.mode === 'plan' ? 'on' : ''} onClick={() => set(m, { mode: 'plan' })}>Plan it</button>
                <button className={s.mode === 'macros' ? 'on' : ''} onClick={() => set(m, { mode: 'macros', extraServings: 0 })}>Macros only</button>
              </div>
            </div>
            {s.mode === 'plan' ? (
              <div className="extra">
                <span>Extra servings for others</span>
                <span className="stepper">
                  <button aria-label="Fewer" onClick={() => set(m, { extraServings: Math.max(0, s.extraServings - 1) })}>−</button>
                  <b>{s.extraServings}</b>
                  <button aria-label="More" onClick={() => set(m, { extraServings: Math.min(8, s.extraServings + 1) })}>+</button>
                </span>
              </div>
            ) : <div className="extra"><span>Calories and protein reserved; you sort this meal</span></div>}
          </div>
        );
      })}
      <p className="muted">Your portion always stays on your macros. Extra servings only add ingredients.</p>
      {swipeCourses(p).length === 0 && <p className="err">Plan at least one meal.</p>}
    </>
  );
}

function AllergiesStep({ p, update }: SP) {
  const toggle = (a: Allergen) =>
    update((x) => setAllergies(x, x.allergies.includes(a) ? x.allergies.filter((y) => y !== a) : [...x.allergies, a]));
  return (
    <>
      <Title sub="Everyone eats the same meals, so include anyone you're cooking for. Recipes with these are fully excluded.">Any allergies in your household?</Title>
      <div className="chips">
        {ALLERGENS.map(([k, l]) => (
          <button key={k} className={'chip amber' + (p.allergies.includes(k) ? ' on' : '')} aria-pressed={p.allergies.includes(k)} onClick={() => toggle(k)}>{l}</button>
        ))}
      </div>
      <p className="muted">The UK&apos;s 14 major allergens. Always check product labels for &quot;may contain&quot; traces.</p>
      <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
        <span className="muted" style={{ margin: 0 }}>Vegetarian or vegan? Coming soon.</span>
        <span className="pill">Notify me</span>
      </div>
    </>
  );
}

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

function DislikesStep({ p, update }: SP) {
  const [q, setQ] = useState('');
  const toggle = (d: string) =>
    update((x) => ({ ...x, dislikes: x.dislikes.includes(d) ? x.dislikes.filter((y) => y !== d) : [...x.dislikes, d] }));
  return (
    <>
      <Title sub="We'll show these less often. Skip if you eat anything.">Anything you don&apos;t like?</Title>
      <input className="text" placeholder="Search ingredients" aria-label="Search ingredients" value={q} onChange={(e) => setQ(e.target.value)} />
      {DISLIKE_GROUPS.map((g) => {
        const items = g.items.filter((i) => i.toLowerCase().includes(q.toLowerCase()));
        if (!items.length) return null;
        return (
          <div key={g.group}>
            <p className="group-title">{g.group}</p>
            <div className="chips">
              {items.map((i) => <button key={i} className={'chip' + (p.dislikes.includes(i) ? ' on' : '')} aria-pressed={p.dislikes.includes(i)} onClick={() => toggle(i)}>{i}</button>)}
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
