import CountUp from '@/components/CountUp';
import { DEFAULT_STORE, STORES, type Store } from '@/lib/stores';
import { money } from '@/components/week';
import type { WeekSummary } from '@/lib/cycle/summary';
import type { dayEaten } from '@/lib/cycle/summary';
import type { Targets } from '@/lib/targets';

type Avg = WeekSummary['averages'];

type Tgt = Pick<Targets, 'target' | 'protein' | 'carbs' | 'fat'>;

/** One macro row: a coloured bar that grows to the marker (the target) as the figure counts up. */
function MacroRows({ values, t }: { values: { kcal: number; protein: number; carbs: number; fat: number }; t: Tgt }) {
  const rows: [string, number, number, string][] = [
    ['Protein', values.protein, t.protein, 'g'], ['Carbs', values.carbs, t.carbs, 'g'], ['Fat', values.fat, t.fat, 'g'], ['Calories', values.kcal, t.target, ' kcal'],
  ];
  return (
    <>
      {rows.map(([label, v, target, unit], i) => (
        <div className={'avgrow m-' + label.toLowerCase()} key={label} style={{ '--i': i } as React.CSSProperties}>
          <div className="avghead"><span className="mlabel"><i className="mdot" aria-hidden />{label}</span><span><b><CountUp value={v} delay={i * 90} /></b> / {label === 'Protein' ? '≥' : '~'}{target.toLocaleString('en-GB')}{unit}</span></div>
          <div className="avgtrack" role="img" aria-label={`${label} ${v}${unit} against a target of ${target}${unit}`}>
            <i className={label === 'Protein' && v >= target ? 'ok' : ''} style={{ width: `${Math.min(100, (v / Math.max(1, target)) * 80)}%` }} />
            <em style={{ left: '80%' }} />
          </div>
        </div>
      ))}
    </>
  );
}

/** "Daily average": what the week delivers per day against the target (marker). Carbs and fat are a floor: top-ups and macros-only meals carry none. */
export function DailyAverage({ averages, t }: { averages: Avg; t: Tgt }) {
  return (
    <div className="card avgbars" aria-label="Daily average against your target">
      <h3>Daily Average</h3>
      <MacroRows values={averages} t={t} />
    </div>
  );
}

/** "Today's progress": the same bars, filled by the meals ticked off so far, moving towards today's goal. */
export function DailyProgress({ eaten, t }: { eaten: ReturnType<typeof dayEaten>; t: Tgt }) {
  return (
    <div className="card avgbars" aria-label="Today's progress against your target">
      <h3>Today&apos;s Progress <span className="avgsub">{eaten.eaten} of {eaten.meals} meals eaten</span></h3>
      <MacroRows values={eaten} t={t} />
    </div>
  );
}

/** "Week done": the payoff screen at the end of Friday. */
export function WeekDone({ s, t, store = STORES[DEFAULT_STORE] }: { s: WeekSummary; t: Pick<Targets, 'target' | 'protein' | 'carbs' | 'fat'>; store?: Store }) {
  return (
    <div className="card weekdone" role="status">
      <h2 style={{ margin: 0 }}>Week Done ✓</h2>
      <div className="bignum" style={{ margin: '12px 0' }}>
        <div><div className="n">{s.eaten}/{s.planned}<small>Meals Eaten</small></div></div>
        <div><div className="n">{s.daysInBand}/{s.days}<small>Days on Target</small></div></div>
      </div>
      <p style={{ margin: '0 0 8px' }}>About <b>{money(s.perMealPence)}</b> a meal, against about £6.50 from a meal-prep service{s.savedPence >= 100 ? <>: roughly <b>{money(s.savedPence)}</b> saved this week</> : ''}.</p>
      <p className="muted" style={{ margin: 0 }}>Estimates from dated {store.name} prices and typical meal-prep prices.</p>
      <DailyAverage averages={s.averages} t={t} />
    </div>
  );
}
