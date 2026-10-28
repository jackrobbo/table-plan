'use client';
import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Clock } from 'lucide-react';
import { timeLabel } from '@/lib/cookTime';
import MealImage from '@/components/MealImage';
import { money, recipeById } from '@/components/week';
import { tierMark } from '@/lib/budget';
import { swapOptions } from '@/lib/planner/swap';
import type { Plan, PlanInput } from '@/lib/planner/types';

const SLOT: Record<string, string> = { breakfast: 'breakfast', lunch: 'lunch', snack: 'snack', dinner: 'dinner' };
const signed = (n: number, unit: string) => `${n > 0 ? '+' : n < 0 ? '−' : '±'}${Math.abs(n)}${unit}`;

/** "Swap Monday lunch": same-course alternatives, each showing what it does to the day (and the week's shop) before you choose. */
export default function SwapSheet({ plan, target, input, onPick, onClose }: {
  plan: Plan; target: { day: number; meal: number } | null; input: PlanInput; onPick: (recipeId: string) => void; onClose: () => void;
}) {
  const all = useMemo(() => (target ? swapOptions(plan, target.day, target.meal, input, 14) : []), [plan, target, input]);
  const [filter, setFilter] = useState<'fit' | 'cheaper' | 'new'>('fit');
  const options = useMemo(() => {
    const pool = filter === 'new' ? all.filter((o) => !o.liked) : all;
    const inBand = (o: (typeof all)[number]) => Number(!o.day.inBand);
    const sorted = filter === 'cheaper' ? [...pool].sort((a, b) => inBand(a) - inBand(b) || a.dWeekPence - b.dWeekPence) : pool;
    return sorted.slice(0, 6);
  }, [all, filter]);
  if (!target) return null;
  const day = plan.days[target.day];
  const cur = day?.meals[target.meal];
  const now = cur && recipeById.get(cur.recipeId);
  if (!day || !cur || !now) return null;

  return createPortal(
    <div className="sheet-wrap" onClick={onClose}>
      <div className="sheet" role="dialog" aria-label={`Swap ${day.day} ${SLOT[cur.slot]}`} onClick={(e) => e.stopPropagation()}>
        <div className="grab" />
        <h2>Swap {day.day} {SLOT[cur.slot]}</h2>
        <p className="muted" style={{ margin: '2px 0 8px' }}>Now: {now.e} {now.n}. Your day is {day.protein}g protein · {day.kcal.toLocaleString('en-GB')} kcal.</p>
        <div className="chips" role="group" aria-label="Sort options" style={{ margin: '4px 0 8px' }}>
          {([['fit', 'Similar macros'], ['cheaper', 'Cheaper'], ['new', 'New for you']] as const).map(([k, l]) => (
            <button key={k} className={'chip' + (filter === k ? ' on' : '')} aria-pressed={filter === k} onClick={() => setFilter(k)}>{l}</button>
          ))}
        </div>
        {options.length === 0 && <p className="estimate-flag">{filter === 'new' ? 'No unrated meals fit this slot.' : 'There\u2019s nothing else to swap in that fits your allergies and taste choices.'}</p>}
        {options.map((o) => {
          const wk = Math.abs(o.dWeekPence) >= 5 ? ` · week ${o.dWeekPence > 0 ? '+' : '−'}${money(Math.abs(o.dWeekPence))}` : '';
          return (
            <button key={o.recipe.id} className="swapopt" onClick={() => onPick(o.recipe.id)}>
              {o.recipe.img ? <MealImage r={o.recipe} size="thumb" sizes="64px" /> : <span className="emoji">{o.recipe.e}</span>}
              <span className="sbody">
                <span className="sname">{o.recipe.n}</span>
                <span className="tags" style={{ margin: '4px 0 2px' }}>
                  <span className="p">P {o.recipe.p}g</span><span>{o.recipe.k} kcal</span>
                  {timeLabel(o.recipe.t) && <span className="time"><Clock size={11} aria-hidden />{timeLabel(o.recipe.t)}</span>}
                  {o.recipe.cost != null && <span>≈ {money(o.recipe.cost)} · {tierMark(o.recipe.b)}</span>}
                  {!o.liked && <span>New for you</span>}
                  {!o.withinSpend && <span className="adj">Over your spend</span>}
                </span>
                <span className={'sday' + (o.day.inBand ? '' : ' amber')} style={{ display: 'block' }}>
                  {o.day.inBand ? `${day.day} stays in your band` : `${day.day} would land outside your band`}: {signed(o.dProtein, 'g protein')} · {signed(o.dKcal, ' kcal')}{wk}
                </span>
              </span>
            </button>
          );
        })}
        <button className="btn ghost" style={{ marginTop: 14 }} onClick={onClose}>Cancel</button>
      </div>
    </div>,
    document.body,
  );
}
