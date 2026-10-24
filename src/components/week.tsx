'use client';
import { PRODUCTS, RECIPES } from '@/data';
import { tierMark } from '@/lib/budget';
import { buildShopping, type Shopping } from '@/lib/planner/shopping';
import type { Plan, PlannedDay, PlannedMeal } from '@/lib/planner/types';

export const recipeById = new Map(RECIPES.map((r) => [r.id, r]));
const SLOT_LABEL: Record<string, string> = { breakfast: 'Breakfast', lunch: 'Lunch', snack: 'Snack', dinner: 'Dinner' };
export const money = (p: number) => '£' + (p / 100).toFixed(2);

export function MealRow({ m, tick, onTick, onOpen }: { m: PlannedMeal; tick?: boolean; onTick?: () => void; onOpen?: () => void }) {
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
      {onTick && (
        <button className={'tick' + (tick ? ' on' : '')} role="checkbox" aria-checked={!!tick} aria-label={`Ate ${r.n}`} onClick={onTick}>
          <svg viewBox="0 0 16 16" aria-hidden><path d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
      )}
    </div>
  );
}

export function DayCard({ d, index, ticks, onTick, onOpen, label }: {
  d: PlannedDay; index: number; ticks?: Record<string, boolean>; onTick?: (key: string) => void; onOpen?: (id: string) => void; label?: string;
}) {
  const keys = d.meals.map((_, i) => `${index}:${i}`);
  const done = !!ticks && keys.length > 0 && keys.every((k) => ticks[k]);
  return (
    <section className={'daycard' + (d.adjusted ? ' adjusted' : '') + (done ? ' done' : '')} aria-label={d.day}>
      <header>
        <h3>{d.day}{label && <span className="muted"> · {label}</span>}</h3>
        {done ? <span className="daytot">Done ✓</span>
          : <span className="daytot"><i className={'dot' + (d.inBand ? '' : ' amber')} />{d.protein}g protein · {d.kcal.toLocaleString('en-GB')} kcal</span>}
      </header>
      {!done && d.meals.map((m, i) => (
        <MealRow key={i} m={m} tick={ticks?.[`${index}:${i}`]} onTick={onTick ? () => onTick(`${index}:${i}`) : undefined} onOpen={onOpen ? () => onOpen(m.recipeId) : undefined} />
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

export function RecipeSheet({ id, onClose, portions }: { id: string | null; onClose: () => void; portions?: number }) {
  if (!id) return null;
  const r = recipeById.get(id);
  if (!r) return null;
  return (
    <div className="sheet-wrap" onClick={onClose}>
      <div className="sheet" role="dialog" aria-label={r.n} onClick={(e) => e.stopPropagation()}>
        <div className="grab" />
        <div className="sheet-hero" aria-hidden>{r.e}</div>
        <h2>{r.n}</h2>
        <div className="tags" style={{ margin: '8px 0 14px' }}>
          <span className="p">P {r.p}g</span><span>{r.k} kcal</span><span>serves {r.serves}</span>
          {r.cost != null && <span title="Cost of the ingredients used, per portion">≈ {money(r.cost)} a portion · {tierMark(r.b)}</span>}
        </div>
        <p className="group-title">Ingredients (whole dish)</p>
        <ul className="plain">{r.fresh.map(([k, q]) => <li key={k}>{PRODUCTS[k]?.n ?? k}: {Math.round(q * 10) / 10} {PRODUCTS[k]?.u}</li>)}{r.cup.length > 0 && <li className="muted">Cupboard: {r.cup.join(', ')}</li>}</ul>
        {portions && <div className="note">Your portion for your macros is one serving; the plan scales the rest for the household.</div>}
        {r.m.length > 0 && (<><p className="group-title">How to make it</p><ol className="plain">{r.m.map((x, i) => <li key={i}>{x}</li>)}</ol></>)}
        <button className="btn ghost" style={{ marginTop: 14 }} onClick={onClose}>Close</button>
      </div>
    </div>
  );
}
