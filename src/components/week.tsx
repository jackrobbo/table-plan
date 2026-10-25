'use client';
import { useState } from 'react';
import { createPortal } from 'react-dom';
import { PRODUCTS, RECIPES } from '@/data';
import MealImage from '@/components/MealImage';
import { tierMark } from '@/lib/budget';
import { allergenNames, cupboardLines } from '@/lib/recipeFacts';
import { buildShopping, type Shopping } from '@/lib/planner/shopping';
import type { Plan, PlannedDay, PlannedMeal } from '@/lib/planner/types';

export const recipeById = new Map(RECIPES.map((r) => [r.id, r]));
const SLOT_LABEL: Record<string, string> = { breakfast: 'Breakfast', lunch: 'Lunch', snack: 'Snack', dinner: 'Dinner' };
export const money = (p: number) => '£' + (p / 100).toFixed(2);

export function MealRow({ m, tick, onTick, onOpen, onSwap }: { m: PlannedMeal; tick?: boolean; onTick?: () => void; onOpen?: () => void; onSwap?: () => void }) {
  const r = recipeById.get(m.recipeId)!;
  return (
    <div className="meal">
      <span className="slot">{SLOT_LABEL[m.slot]}</span>
      <button className="mbody linkish" onClick={onOpen} disabled={!onOpen}>
        <div className="mname">{r.e} {r.n}</div>
        <div className="tags">
          <span className="p">P {m.protein}g</span><span>{m.kcal} kcal</span>
          {Math.abs(m.scale - 1) >= 0.02 && <span className="adj">Portion {Math.round(m.scale * 100)}%</span>}
          {m.extra > 0 && <span>+{m.extra} to share</span>}
        </div>
      </button>
      {onSwap && <button className="swapbtn" aria-label={`Swap ${r.n}`} onClick={onSwap}>Swap</button>}
      {onTick && (
        <button className={'tick' + (tick ? ' on' : '')} role="checkbox" aria-checked={!!tick} aria-label={`Ate ${r.n}`} onClick={onTick}>
          <svg viewBox="0 0 16 16" aria-hidden><path d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
      )}
    </div>
  );
}

export function DayCard({ d, index, ticks, onTick, onOpen, onSwap, label, today }: {
  d: PlannedDay; index: number; ticks?: Record<string, boolean>; onTick?: (key: string) => void; onOpen?: (id: string) => void; label?: string;
  today?: boolean;
  /** Offered on meals not yet eaten. */
  onSwap?: (dayIndex: number, mealIndex: number) => void;
}) {
  const keys = d.meals.map((_, i) => `${index}:${i}`);
  const done = !!ticks && keys.length > 0 && keys.every((k) => ticks[k]);
  return (
    <section className={'daycard' + (d.adjusted ? ' adjusted' : '') + (done ? ' done' : '')} aria-label={d.day}>
      <header>
        <h3>{d.day}{label && <span className="muted"> · {label}</span>}{today && <span className="todaybadge">Today</span>}</h3>
        {done ? <span className="daytot">Done ✓</span>
          : <span className="daytot"><i className={'dot' + (d.inBand ? '' : ' amber')} />{d.protein}g protein · {d.kcal.toLocaleString('en-GB')} kcal</span>}
      </header>
      {!done && d.meals.map((m, i) => (
        <MealRow key={i} m={m} tick={ticks?.[`${index}:${i}`]} onTick={onTick ? () => onTick(`${index}:${i}`) : undefined} onOpen={onOpen ? () => onOpen(m.recipeId) : undefined}
          onSwap={onSwap && !ticks?.[`${index}:${i}`] ? () => onSwap(index, i) : undefined} />
      ))}
      {!done && d.topups.map((t) => (
        <div className="meal" key={t.n}>
          <span className="slot">Top-up</span>
          <div className="mbody"><div className="mname">{t.n}</div>
            <div className="tags"><span className="p">P {t.p}g</span><span>{t.k} kcal</span><span className="adj">Added to hit your day</span></div></div>
        </div>
      ))}
      {!done && d.reserved.kcal > 0 && <p className="muted reserved">{d.reserved.kcal} kcal and {d.reserved.protein}g protein kept for meals you sort yourself.</p>}
    </section>
  );
}

export function ShoppingList({ shopping, have, onToggle }: { shopping: Shopping; have?: string[]; onToggle?: (key: string) => void }) {
  return (
    <div className="card list">
      {shopping.lines.map((l) => {
        const got = have?.includes(l.key);
        return (
          <div className={'line' + (got ? ' got' : '')} key={l.key}>
            {onToggle && (
              <button className={'tick' + (got ? '' : ' on')} role="checkbox" aria-checked={!got} aria-label={`Buy ${l.name}`} onClick={() => onToggle(l.key)}>
                <svg viewBox="0 0 16 16" aria-hidden><path d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </button>
            )}
            <div className="lbody">
              <b>{l.name}{l.packs > 1 ? ` ×${l.packs}` : ''}</b>
              {l.slug && (
                <a className="shoplink" href={`https://groceries.morrisons.com/products/${l.slug}`} target="_blank" rel="noopener noreferrer" aria-label={`Open ${l.name} at Morrisons (opens in a new tab)`}>Morrisons ↗</a>
              )}
              <div className="muted">{l.usedBy.slice(0, 3).join(', ')}</div>
              {l.status && l.status !== 'ok' && <div className="flag">May be unavailable at the moment</div>}
            </div>
            <span className="price">{money(l.costPence)}</span>
          </div>
        );
      })}
    </div>
  );
}

/** Plain-text list for Save to Notes / share. Honest about prices being dated estimates. */
export function listAsText(plan: Plan, have: string[], dated: string): string {
  const s = buildShopping(plan);
  const lines = s.lines.filter((l) => !have.includes(l.key)).map((l) => `☐ ${l.name}${l.packs > 1 ? ` ×${l.packs}` : ''} (≈ ${money(l.costPence)})`);
  return `Table Plan shopping list\n${dated}\n\n${lines.join('\n')}\n\nStore cupboard (only if you're out):\n${s.cupboard.join('\n')}`;
}

export function RecipeSheet({ id, onClose, portions, onNever }: { id: string | null; onClose: () => void; portions?: number; onNever?: (id: string) => void }) {
  const r = id ? recipeById.get(id) : undefined;
  return r ? createPortal(<RecipeSheetBody key={r.id} r={r} onClose={onClose} portions={portions} onNever={onNever} />, document.body) : null;
}

function RecipeSheetBody({ r, onClose, portions, onNever }: { r: NonNullable<ReturnType<typeof recipeById.get>>; onClose: () => void; portions?: number; onNever?: (id: string) => void }) {
  const [tab, setTab] = useState<'ingredients' | 'cook'>('ingredients');
  const [struck, setStruck] = useState<string[]>([]);
  const [asked, setAsked] = useState(false);
  const allergens = allergenNames(r);
  const cupboard = cupboardLines(r);
  const strike = (k: string) => setStruck((s) => (s.includes(k) ? s.filter((x) => x !== k) : [...s, k]));
  // Portalled to <body> (by RecipeSheet): <main> keeps a transform from its entrance animation, which would otherwise become the
  // containing block for this fixed overlay and push the sheet off the bottom of the screen.
  return (
    <div className="sheet-wrap" onClick={onClose}>
      <div className="sheet" role="dialog" aria-label={r.n} onClick={(e) => e.stopPropagation()}>
        <div className="grab" />
        {r.img ? <MealImage r={r} size="sheet" sizes="(max-width: 430px) 100vw, 430px" /> : <div className="sheet-hero" aria-hidden>{r.e}</div>}
        <h2>{r.n}</h2>
        <div className="tags" style={{ margin: '8px 0 10px' }}>
          <span className="p">P {r.p}g</span>
          {r.cb != null && <span>C {r.cb}g</span>}
          {r.f != null && <span>F {r.f}g</span>}
          <span>{r.k} kcal</span><span>serves {r.serves}</span>
          {r.cost != null && <span title="Cost of the ingredients used, per portion">≈ {money(r.cost)} a portion · {tierMark(r.b)}</span>}
        </div>
        <p className="contains">
          {allergens.length ? <><b>Contains:</b> {allergens.join(', ')}.</> : <b>No major allergens declared on the products used.</b>}{' '}
          <span className="muted">From the pack labels. &ldquo;May contain&rdquo; traces aren&apos;t included, so check the packs if you have a serious allergy.</span>
        </p>
        <div className="seg2" role="tablist" style={{ margin: '12px 0 4px' }}>
          <button role="tab" aria-selected={tab === 'ingredients'} className={tab === 'ingredients' ? 'on' : ''} onClick={() => setTab('ingredients')}>Ingredients</button>
          <button role="tab" aria-selected={tab === 'cook'} className={tab === 'cook' ? 'on' : ''} onClick={() => setTab('cook')}>How to cook</button>
        </div>
        {tab === 'ingredients' ? (<>
          <p className="muted" style={{ margin: '8px 0 4px' }}>Whole dish. Tap an ingredient to cross it off as you go.</p>
          <ul className="plain strike">
            {r.fresh.map(([k, q]) => (
              <li key={k}><button className={'strikebtn' + (struck.includes(k) ? ' on' : '')} aria-pressed={struck.includes(k)} onClick={() => strike(k)}>{PRODUCTS[k]?.n ?? k}: {Math.round(q * 10) / 10} {PRODUCTS[k]?.u}</button></li>
            ))}
            {cupboard.length > 0 && <li className="muted">From your cupboard: {cupboard.join(' · ')}</li>}
          </ul>
          {portions && <div className="note">Your portion for your macros is one serving; the plan scales the rest for the household.</div>}
        </>) : r.m.length > 0 ? <ol className="plain" style={{ marginTop: 10 }}>{r.m.map((x, i) => <li key={i}>{x}</li>)}</ol> : <p className="muted">No method for this one: it&apos;s a grab-and-go item.</p>}
        {onNever && (!asked
          ? <button className="linkbtn" style={{ marginTop: 10 }} onClick={() => setAsked(true)}>Never suggest this again</button>
          : <p className="note warn-note">We won&apos;t plan or offer this meal in future weeks (weeks already planned stay as they are). <button className="linkbtn" onClick={() => { onNever(r.id); onClose(); }}>Yes, never suggest it</button> <button className="linkbtn" onClick={() => setAsked(false)}>Keep it</button></p>)}
        <button className="btn ghost" style={{ marginTop: 14 }} onClick={onClose}>Close</button>
      </div>
    </div>
  );
}
