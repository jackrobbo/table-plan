'use client';
import { useEffect, useRef, useState } from 'react';
import { Check, Clock, Heart, X } from 'lucide-react';
import { safeRecipes } from '@/lib/allergens';
import { timeLabel } from '@/lib/cookTime';
import { MIN_LIKES, swipe, swipeCourses, tasteDeck, tasteProgress } from '@/lib/onboarding';
import type { MealTime } from '@/lib/profile';
import type { Recipe } from '@/data';
import MealImage from '@/components/MealImage';
import { money } from '@/components/week';
import { Title, type SP } from '@/components/profile-fields';

const LABEL: Record<MealTime, string> = { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner' };
const PLURAL: Record<MealTime, string> = { breakfast: 'breakfasts', lunch: 'lunches', dinner: 'dinners' };
const cap = (s: string) => s[0].toUpperCase() + s.slice(1);
const FLING_AT = 90;   // px of drag that counts as a decision

/** One card. Drag it left (skip) or right (keep), or use the buttons; either way it flies off before the next one comes up. */
function SwipeCard({ r, kind, command, onDecide }: { r: Recipe; kind: string; command: 'keep' | 'skip' | null; onDecide: (keep: boolean) => void }) {
  const [dx, setDx] = useState(0);
  const [gone, setGone] = useState<0 | 1 | -1>(0);
  const [dragging, setDragging] = useState(false);
  const start = useRef<number | null>(null);
  const decided = useRef(false);

  const fling = (keep: boolean) => {
    if (decided.current) return;
    decided.current = true;
    setGone(keep ? 1 : -1);
    setTimeout(() => onDecide(keep), 220);
  };
  useEffect(() => { if (command) fling(command === 'keep'); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [command]);

  const keepAmt = Math.min(1, Math.max(0, dx / FLING_AT)) || (gone === 1 ? 1 : 0);
  const skipAmt = Math.min(1, Math.max(0, -dx / FLING_AT)) || (gone === -1 ? 1 : 0);
  const style = {
    transform: gone ? `translateX(${gone * 520}px) rotate(${gone * 22}deg)` : `translateX(${dx}px) rotate(${dx / 16}deg)`,
    // The fade needs its own transition: with only `transform` animated, the card would vanish at once when a button flings it.
    transition: dragging ? 'none' : 'transform .28s var(--ease-out, ease), opacity .24s ease .06s',
    opacity: gone ? 0 : 1,
  } as const;

  return (
    <div
      className="swipecard front" style={style} role="group" aria-label={`${r.n}. Swipe right to keep, left to skip.`}
      onPointerDown={(e) => { start.current = e.clientX; setDragging(true); e.currentTarget.setPointerCapture(e.pointerId); }}
      onPointerMove={(e) => { if (start.current !== null) setDx(e.clientX - start.current); }}
      onPointerUp={() => { start.current = null; setDragging(false); if (Math.abs(dx) > FLING_AT) fling(dx > 0); else setDx(0); }}
      onPointerCancel={() => { start.current = null; setDragging(false); setDx(0); }}
    >
      {r.img ? <MealImage r={r} size="hero" sizes="(max-width: 430px) 100vw, 430px" /> : <div className="photo" aria-hidden>{r.e}</div>}
      <span className="stamp keep" style={{ opacity: keepAmt }}>Keep</span>
      <span className="stamp skip" style={{ opacity: skipAmt }}>Skip</span>
      <div className="body">
        <span className="kind">{kind}</span>
        <h3>{r.n}</h3>
        <div className="tags">
          <span className="p">P {r.p}g</span><span>{r.k} kcal</span>
          {timeLabel(r.t) && <span className="time" title="Estimated prep and cooking time"><Clock size={11} aria-hidden />{timeLabel(r.t)}</span>}
          {r.cost != null && <span title="Estimated cost of one portion">≈ {money(r.cost)} a portion</span>}
          {r.serves > 1 && <span>serves {r.serves}</span>}
        </div>
      </div>
    </div>
  );
}

/**
 * The taste step as a card stack: swipe or tap to keep or skip. After the minimum likes for a meal type we stop and ask whether
 * to keep going (more likes, more variety) or move on to the next meal type.
 */
export default function TasteSwipe({ p, update, onFinish }: SP & { onFinish: () => void }) {
  const courses = swipeCourses(p);
  const prog = tasteProgress(p);
  const firstOpen = courses.find((c) => prog[c].liked < prog[c].needed) ?? courses[courses.length - 1] ?? 'dinner';
  const [tab, setTab] = useState<MealTime>(firstOpen);
  const [asked, setAsked] = useState<MealTime[]>([]);        // meal types we've already offered "keep going or move on" for
  const [prompt, setPrompt] = useState<MealTime | null>(null);
  const [command, setCommand] = useState<'keep' | 'skip' | null>(null);

  const seen = new Set([...p.likedRecipes, ...p.skippedRecipes]);
  const pool = tasteDeck(safeRecipes(p.allergies).filter((r) => r.c === tab));
  const upcoming = pool.filter((r) => !seen.has(r.id));
  const [next, after] = upcoming;
  const allDone = courses.every((c) => prog[c].liked >= prog[c].needed);
  const nextCourse = courses.slice(courses.indexOf(prompt ?? tab) + 1).find((c) => prog[c].liked < prog[c].needed) ?? null;

  const decide = (r: Recipe, keep: boolean) => {
    setCommand(null);
    update((x) => swipe(x, r.id, keep));
    // That like just reached the minimum for this meal type: pause and ask.
    if (keep && prog[tab].liked + 1 === prog[tab].needed && !asked.includes(tab)) { setAsked((a) => [...a, tab]); setPrompt(tab); }
  };

  const keepGoing = () => setPrompt(null);
  const moveOn = () => {
    const to = nextCourse;
    setPrompt(null);
    if (to) setTab(to);
  };

  return (
    <>
      <Title sub="Swipe right on meals you'd happily eat, left on the rest.">What Do You Like to Eat?</Title>
      <div className="tabs">
        {courses.map((c) => (
          <button key={c} className={(tab === c ? 'on' : '') + (prog[c].liked >= prog[c].needed ? ' done' : '')} onClick={() => { setTab(c); setPrompt(null); }}>
            {LABEL[c]} {prog[c].liked >= prog[c].needed ? <Check size={13} aria-hidden /> : `${prog[c].liked}/${prog[c].needed}`}
          </button>
        ))}
      </div>

      {prompt ? (
        <div className="taste-prompt fade" role="status">
          <span className="tp-ico"><Check size={26} aria-hidden /></span>
          <h3>That&apos;s {MIN_LIKES} {cap(PLURAL[prompt])} Picked</h3>
          <p className="muted">
            {nextCourse
              ? `Keep going for more variety in your plans, or move on to ${PLURAL[nextCourse]}.`
              : allDone ? 'That’s all three. Keep going for more variety, or finish up.' : 'Keep going for more variety, or finish up.'}
          </p>
          {nextCourse ? (
            <button className="btn" onClick={moveOn}>On to {cap(PLURAL[nextCourse])}</button>
          ) : (
            <button className="btn" onClick={onFinish}>Finish</button>
          )}
          <button className="btn ghost" onClick={keepGoing}>Keep Picking {cap(PLURAL[prompt])}</button>
        </div>
      ) : next ? (
        <>
          <div className="swipestack">
            {after && <div className="swipecard peek" aria-hidden>{after.img ? <MealImage r={after} size="hero" sizes="(max-width: 430px) 100vw, 430px" /> : <div className="photo">{after.e}</div>}</div>}
            <SwipeCard key={next.id} r={next} kind={LABEL[tab]} command={command} onDecide={(k) => decide(next, k)} />
          </div>
          <div className="swipebtns round">
            <button className="skip" aria-label={`Skip ${next.n}`} onClick={() => setCommand('skip')}><X size={28} aria-hidden /></button>
            <button className="keep" aria-label={`Keep ${next.n}`} onClick={() => setCommand('keep')}><Heart size={28} aria-hidden /></button>
          </div>
          <p className="muted swipehint">{prog[tab].liked >= prog[tab].needed ? 'You have enough here. Tap another meal type above, or keep going.' : `${prog[tab].needed - prog[tab].liked} more ${PLURAL[tab]} to go.`}</p>
        </>
      ) : (
        <div className="note">
          That&apos;s all the {LABEL[tab].toLowerCase()} options for now.
          {prog[tab].liked < prog[tab].needed && (
            <> You need {prog[tab].needed - prog[tab].liked} more.{' '}
              <button className="linkbtn accent" onClick={() => update((x) => ({ ...x, skippedRecipes: x.skippedRecipes.filter((id) => !pool.some((r) => r.id === id)) }))}>Revisit Skipped</button></>
          )}
        </div>
      )}
    </>
  );
}
