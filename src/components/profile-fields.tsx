'use client';
import { createContext, useContext, useState } from 'react';
import { Armchair, Bike, Coffee, Dumbbell, Footprints, Sandwich, Scale, TrendingDown, TrendingUp, Utensils, type LucideIcon } from 'lucide-react';
import { ALLERGENS, type Allergen } from '@/lib/allergens';
import { DISLIKE_GROUPS } from '@/lib/dislikes';
import { advance, setAllergies, swipeCourses } from '@/lib/onboarding';
import type { Goal, MealTime, Profile } from '@/lib/profile';
import type { Sex } from '@/lib/targets';
import { cmToFtIn, ftInToCm, kgToLb, kgToStLb, lbToKg, stLbToKg } from '@/lib/units';

/** The question editors shared by onboarding (one per screen) and Settings (all on one page). */
export type Upd = (fn: (p: Profile) => Profile) => void;
const num = (v: string) => (v === '' ? undefined : Number(v));

/** In Settings the section supplies its own heading and answering never moves to a next step. */
export const Plain = createContext(false);

export interface SP { p: Profile; update: Upd }

export const Title = ({ children, sub }: { children: React.ReactNode; sub?: string }) => {
  const plain = useContext(Plain);
  return plain ? (sub ? <p className="muted" style={{ marginTop: 0 }}>{sub}</p> : null) : <><h2>{children}</h2>{sub && <p className="sub">{sub}</p>}</>;
};

function Radio({ on, title, desc, icon: Icon, onClick }: { on: boolean; title: string; desc?: string; icon?: LucideIcon; onClick: () => void }) {
  return (
    <button className={'opt' + (on ? ' on' : '')} role="radio" aria-checked={on} onClick={onClick}>
      {Icon && <span className="opt-ico"><Icon size={20} aria-hidden /></span>}
      <span className="opt-txt"><b>{title}</b>{desc && <span className="d">{desc}</span>}</span><span className="radio" />
    </button>
  );
}

export function GoalStep({ p, update }: SP) {
  const goals: [Goal, string, string, LucideIcon][] = [
    ['lose', 'Lose Weight', 'Steady loss, about 1 lb a week', TrendingDown],
    ['maintain', 'Maintain', 'Steady energy', Scale],
    ['gain', 'Gain Weight', 'Surplus for muscle', TrendingUp],
  ];
  return (
    <>
      <Title sub="Sets your calorie band and protein floor.">What&apos;s Your Goal?</Title>
      <div className="opts" role="radiogroup">
        {goals.map(([g, t, d, ic]) => <Radio key={g} on={p.goal === g} title={t} desc={d} icon={ic} onClick={() => update((x) => ({ ...x, goal: g }))} />)}
      </div>
    </>
  );
}

export function HeightStep({ p, update }: SP) {
  const cm = p.stats.heightCm;
  const ft = cm ? cmToFtIn(cm) : { ft: undefined, inch: undefined };
  const set = (heightCm: number | undefined) => update((x) => ({ ...x, stats: { ...x.stats, heightCm }, skipped: { ...x.skipped, height: undefined } }));
  return (
    <>
      <Title sub="Private. Only used to size your portions.">How Tall Are You?</Title>
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

export function WeightStep({ p, update }: SP) {
  const kg = p.stats.weightKg;
  const stlb = kg ? kgToStLb(kg) : { st: undefined, lb: undefined };
  const set = (weightKg: number | undefined) => update((x) => ({ ...x, stats: { ...x.stats, weightKg }, skipped: { ...x.skipped, weight: undefined } }));
  return (
    <>
      <Title sub="Private. You can update it any time.">What Do You Weigh?</Title>
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

export function AgeStep({ p, update }: SP) {
  return (
    <>
      <Title sub="Calorie needs change with age. Table Plan is for adults (18+).">How Old Are You?</Title>
      <div className="value"><label><input aria-label="Age in years" type="number" inputMode="numeric" placeholder="34" value={p.stats.age ?? ''}
        onChange={(e) => update((x) => ({ ...x, stats: { ...x.stats, age: num(e.target.value) }, skipped: { ...x.skipped, age: undefined } }))} /><span className="unit">years</span></label></div>
    </>
  );
}

export function SexStep({ p, update }: SP) {
  const plain = useContext(Plain);
  return (
    <>
      <Title sub="Men and women need slightly different calories.">Are You Male or Female?</Title>
      <div className="opts" role="radiogroup">
        {([['f', 'Female'], ['m', 'Male']] as [Sex, string][]).map(([v, l]) => (
          <Radio key={v} on={p.stats.sex === v} title={l}
            onClick={() => update((x) => { const next = { ...x, stats: { ...x.stats, sex: v }, skipped: { ...x.skipped, sex: undefined } }; return plain ? next : advance(next); })} />
        ))}
      </div>
    </>
  );
}

export function ActivityStep({ p, update }: SP) {
  const opts: [number, string, string, LucideIcon][] = [
    [1.2, 'Mostly Sitting', 'Desk job, little exercise', Armchair],
    [1.375, 'Lightly Active', 'On your feet, walks', Footprints],
    [1.55, 'Active', 'Exercise 3–5 days', Bike],
    [1.725, 'Very Active', 'Physical job or daily training', Dumbbell],
  ];
  return (
    <>
      <Title sub="Most days, including work.">How Active Are You?</Title>
      <div className="opts" role="radiogroup">
        {opts.map(([v, t, d, ic]) => <Radio key={v} on={p.stats.activity === v} title={t} desc={d} icon={ic} onClick={() => update((x) => ({ ...x, stats: { ...x.stats, activity: v } }))} />)}
      </div>
    </>
  );
}

export function MealsStep({ p, update }: SP) {
  const labels: Record<MealTime, string> = { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner' };
  const mealIcon: Record<MealTime, LucideIcon> = { breakfast: Coffee, lunch: Sandwich, dinner: Utensils };
  const set = (m: MealTime, patch: Partial<Profile['meals'][MealTime]>) =>
    update((x) => ({ ...x, meals: { ...x.meals, [m]: { ...x.meals[m], ...patch } } }));
  return (
    <>
      <Title sub="Planned meals come with recipes and go on your list. For the rest, you just get a macro target.">Which Meals Should We Plan?</Title>
      {(Object.keys(labels) as MealTime[]).map((m) => {
        const s = p.meals[m];
        return (
          <div className="mealrow" key={m}>
            <div className="top">
              <h3 className="ico-h">{(() => { const Icon = mealIcon[m]; return <Icon size={18} aria-hidden />; })()}{labels[m]}</h3>
              <div className="seg2 small">
                <button className={s.mode === 'plan' ? 'on' : ''} onClick={() => set(m, { mode: 'plan' })}>Plan It</button>
                <button className={s.mode === 'macros' ? 'on' : ''} onClick={() => set(m, { mode: 'macros', extraServings: 0 })}>Macros Only</button>
              </div>
            </div>
            {s.mode === 'plan' ? (
              <div className="extra">
                <span>Extra Servings for Others</span>
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

export function AllergiesStep({ p, update }: SP) {
  const toggle = (a: Allergen) =>
    update((x) => setAllergies(x, x.allergies.includes(a) ? x.allergies.filter((y) => y !== a) : [...x.allergies, a]));
  return (
    <>
      <Title sub="Everyone eats the same meals, so include anyone you're cooking for. Recipes with these are fully excluded.">Any Allergies in Your Household?</Title>
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

export function DislikesStep({ p, update }: SP) {
  const [q, setQ] = useState('');
  const toggle = (d: string) =>
    update((x) => ({ ...x, dislikes: x.dislikes.includes(d) ? x.dislikes.filter((y) => y !== d) : [...x.dislikes, d] }));
  return (
    <>
      <Title sub="We'll show these less often. Skip if you eat anything.">Anything You Don&apos;t Like?</Title>
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

