'use client';
import { useRef, useState } from 'react';
import { Heart, PoundSterling, ShoppingCart, Target, type LucideIcon } from 'lucide-react';

const FEATURES: { icon: LucideIcon; title: string; body: string }[] = [
  { icon: Target, title: 'Hits your targets', body: 'Calories and protein set from your stats, with every day kept in range. No maths.' },
  { icon: Heart, title: 'Meals you’ll actually eat', body: 'Tell us what you like and what to avoid. Allergies are always left out, and you can swap any meal.' },
  { icon: PoundSterling, title: 'Priced before you shop', body: 'See the estimated cost of the whole week at Morrisons, dated, so there are no surprises.' },
  { icon: ShoppingCart, title: 'Fills your trolley', body: 'Send your list to a Morrisons trolley in a tap with the Android app or Chrome add-on.' },
];

/** Swipeable feature cards: native scroll-snap, with dots that follow and jump. No autoplay. */
export default function FeatureCarousel() {
  const track = useRef<HTMLUListElement>(null);
  const [i, setI] = useState(0);

  const onScroll = () => {
    const el = track.current;
    if (!el) return;
    const first = el.children[0] as HTMLElement | undefined;
    const step = first ? first.offsetWidth + 12 : el.clientWidth;
    setI(Math.min(FEATURES.length - 1, Math.max(0, Math.round(el.scrollLeft / step))));
  };
  const go = (n: number) => {
    const el = track.current;
    const child = el?.children[n] as HTMLElement | undefined;
    if (el && child) el.scrollTo({ left: child.offsetLeft - el.offsetLeft - 20, behavior: 'smooth' });
  };

  return (
    <section aria-label="What Table Plan does" className="carousel-wrap">
      <ul className="carousel" ref={track} onScroll={onScroll}>
        {FEATURES.map(({ icon: Icon, title, body }, n) => (
          <li key={title} className="slide card" aria-label={`${n + 1} of ${FEATURES.length}`}>
            <span className="slide-ico"><Icon size={22} aria-hidden /></span>
            <h3>{title}</h3>
            <p className="muted">{body}</p>
          </li>
        ))}
      </ul>
      <div className="dots" role="group" aria-label="Choose a feature">
        {FEATURES.map((f, n) => (
          <button key={f.title} className={n === i ? 'on' : ''} aria-label={f.title} aria-current={n === i ? 'true' : undefined} onClick={() => go(n)} />
        ))}
      </div>
    </section>
  );
}
