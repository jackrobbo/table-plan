'use client';
import { useState } from 'react';
import { Check, Heart, X } from 'lucide-react';
import MealImage from '@/components/MealImage';
import { SwipeCard } from '@/components/TasteSwipe';
import type { Recipe } from '@/data';
import type { MealTime } from '@/lib/profile';

const LABEL: Record<MealTime, string> = { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner' };

/**
 * A quick taste refresh before a week is planned: the same swipe as set-up. Right keeps a meal in the pool the planner draws from,
 * left takes it out. Meals from earlier weeks come first and are flagged, so it's easy to drop any you've gone off; then unrated ones.
 */
export default function TasteRefresh({ courses, pool, liked, past, onDecide }: {
  courses: MealTime[]; pool: Recipe[]; liked: string[]; past: Record<string, number>; onDecide: (id: string, keep: boolean) => void;
}) {
  const [done, setDone] = useState<string[]>([]);       // decided in this refresh
  const [command, setCommand] = useState<'keep' | 'skip' | null>(null);

  // One mixed deck, each card tagged with its meal type: everything planned in an earlier week (most-had first), then a random handful
  // of meals not rated yet, so it stays quick. Fixed when the step opens, so swiping doesn't reshuffle what's left.
  const NEW_MEALS = 12;
  const [deckAll] = useState<Recipe[]>(() => {
    const inScope = pool.filter((r) => (courses as string[]).includes(r.c));
    const prev = inScope.filter((r) => past[r.id]).sort((a, b) => past[b.id] - past[a.id]);
    const fresh = inScope.filter((r) => !past[r.id] && !liked.includes(r.id)).map((r) => [Math.random(), r] as const).sort((a, b) => a[0] - b[0]).slice(0, NEW_MEALS).map(([, r]) => r);
    return [...prev, ...fresh];
  });
  const deck = deckAll.filter((r) => !done.includes(r.id));
  const [next, after] = deck;
  const had = next ? past[next.id] ?? 0 : 0;

  const decide = (r: Recipe, keep: boolean) => { setCommand(null); setDone((x) => [...x, r.id]); onDecide(r.id, keep); };

  return (
    <>
      {deckAll.length > 0 && <p className="muted tastecount" aria-live="polite">{Math.min(done.length + 1, deckAll.length)} of {deckAll.length}</p>}
      {next ? (
        <>
          <div className="swipestack">
            {after && <div className="swipecard peek" aria-hidden>{after.img ? <MealImage r={after} size="hero" sizes="(max-width: 430px) 100vw, 430px" /> : <div className="photo">{after.e}</div>}</div>}
            <SwipeCard key={next.id} r={next} kind={LABEL[next.c as MealTime] ?? next.c} command={command} onDecide={(k) => decide(next, k)}
              badge={had ? `Had ${had === 1 ? 'Once' : `${had}×`} Before${liked.includes(next.id) ? ' · Liked' : ''}` : 'New for You'} />
          </div>
          <div className="swipebtns round">
            <button className="skip" aria-label={`Not for me: ${next.n}`} onClick={() => setCommand('skip')}><X size={28} aria-hidden /></button>
            <button className="keep" aria-label={`Keep ${next.n}`} onClick={() => setCommand('keep')}><Heart size={28} aria-hidden /></button>
          </div>
          <p className="muted swipehint">Build your week any time.</p>
        </>
      ) : (
        <div className="note"><Check size={14} aria-hidden style={{ marginRight: 6, verticalAlign: -2 }} />{deckAll.length === 0 ? 'Nothing to review.' : 'All done.'}</div>
      )}
    </>
  );
}
