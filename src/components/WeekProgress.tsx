import { money } from '@/components/week';
import type { WeekSummary } from '@/lib/cycle/summary';
import type { Targets } from '@/lib/targets';

type Avg = WeekSummary['averages'];

/** "Daily average": what the week delivers per day against the target (marker). Carbs and fat are a floor: top-ups and macros-only meals carry none. */
export function DailyAverage({ averages, t }: { averages: Avg; t: Pick<Targets, 'target' | 'protein' | 'carbs' | 'fat'> }) {
  const rows: [string, number, number, string][] = [
    ['Protein', averages.protein, t.protein, 'g'], ['Carbs', averages.carbs, t.carbs, 'g'], ['Fat', averages.fat, t.fat, 'g'], ['Calories', averages.kcal, t.target, ' kcal'],
  ];
  return (
    <div className="card avgbars" aria-label="Daily average against your target">
      <h3>Daily Average</h3>
      {rows.map(([label, v, target, unit]) => (
        <div className="avgrow" key={label}>
          <div className="avghead"><span>{label}</span><span><b>{v.toLocaleString('en-GB')}</b> / {label === 'Protein' ? '≥' : '~'}{target.toLocaleString('en-GB')}{unit}</span></div>
          <div className="avgtrack" role="img" aria-label={`${label} ${v}${unit} against a target of ${target}${unit}`}>
            <i className={label === 'Protein' && v >= target ? 'ok' : ''} style={{ width: `${Math.min(100, (v / Math.max(1, target)) * 80)}%` }} />
            <em style={{ left: '80%' }} />
          </div>
        </div>
      ))}
    </div>
  );
}

/** "Week done": the payoff screen at the end of Friday. */
export function WeekDone({ s, t }: { s: WeekSummary; t: Pick<Targets, 'target' | 'protein' | 'carbs' | 'fat'> }) {
  return (
    <div className="card weekdone" role="status">
      <h2 style={{ margin: 0 }}>Week Done ✓</h2>
      <div className="bignum" style={{ margin: '12px 0' }}>
        <div><div className="n">{s.eaten}/{s.planned}<small>meals eaten</small></div></div>
        <div><div className="n">{s.daysInBand}/{s.days}<small>days on target</small></div></div>
      </div>
      <p style={{ margin: '0 0 8px' }}>About <b>{money(s.perMealPence)}</b> a meal, against about £6.50 from a meal-prep service{s.savedPence >= 100 ? <>: roughly <b>{money(s.savedPence)}</b> saved this week</> : ''}.</p>
      <p className="muted" style={{ margin: 0 }}>Estimates from dated Morrisons prices and typical meal-prep prices.</p>
      <DailyAverage averages={s.averages} t={t} />
    </div>
  );
}
