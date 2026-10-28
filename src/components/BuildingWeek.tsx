'use client';
import { useEffect, useState } from 'react';
import { Check, Coffee, Utensils } from 'lucide-react';
import { DEFAULT_STORE, STORES, type Store } from '@/lib/stores';

const steps = (shop: string) => [
  'Matching meals to your tastes and allergies',
  'Sizing portions to your calories',
  'Checking protein on every day',
  'Sharing ingredients to cut waste',
  `Pricing the week at ${shop}`,
];
const TICK_MS = 650;

/** Shown once, while the first week is built. The planner itself is quick; this lets the person see what it checks. */
export default function BuildingWeek({ onDone, store = STORES[DEFAULT_STORE] }: { onDone: () => void; store?: Store }) {
  const STEPS = steps(store.name);
  const [done, setDone] = useState(0);

  useEffect(() => {
    if (done > STEPS.length) { onDone(); return; }
    const t = setTimeout(() => setDone((d) => d + 1), done === STEPS.length ? 500 : TICK_MS);
    return () => clearTimeout(t);
  }, [done, onDone]);

  return (
    <div className="bw" role="status" aria-live="polite">
      <div className="bw-cards" aria-hidden>
        <div className="bw-card a"><Coffee size={34} /><b>Monday</b></div>
        <div className="bw-card b"><Utensils size={34} /><b>Tuesday</b></div>
      </div>
      <h2>Building Your Week</h2>
      <p className="sub">Checking every day against your targets.</p>
      <ul className="bw-steps">
        {STEPS.map((s, i) => (
          <li key={s} className={i < done ? 'done' : i === done ? 'now' : ''}>
            <span className="bw-mark">{i < done ? <Check size={14} aria-hidden /> : null}</span>
            {s}
          </li>
        ))}
      </ul>
    </div>
  );
}
