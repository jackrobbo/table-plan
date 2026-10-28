'use client';
import { useRef, useState, type ReactNode } from 'react';
import { mealImageSrc, mealImageSrcSet } from '@/lib/images';

/** Small, static pictures of the real screens (example numbers), so each card shows the feature rather than describing it. */
const bar = (label: string, value: string, pct: number) => (
  <div className="mini-bar"><div className="mini-row"><span>{label}</span><b>{value}</b></div><div className="mini-track"><i style={{ width: `${pct}%` }} /></div></div>
);

const FEATURES: { title: string; body: string; photo: string; preview: ReactNode }[] = [
  {
    title: 'Hits your targets',
    photo: 'slide-targets',
    body: 'Calories and protein set from your stats, every day kept in range.',
    preview: bar('Protein', '159 / ≥153g', 92),
  },
  {
    title: 'Meals you’ll actually eat',
    photo: 'slide-meals',
    body: 'Tell us what you like. Allergies are always left out, and you can swap any meal.',
    preview: <div className="mini-tags"><span className="p">P 43g</span><span>616 kcal</span><span>≈ 20 min</span><span>≈ £1.66</span></div>,
  },
  {
    title: 'Priced before you shop',
    photo: 'slide-price',
    body: 'The whole week’s estimated cost at Morrisons, dated, with no surprises.',
    preview: <div className="mini-price"><b>≈ £55.86</b><span>estimated Morrisons prices</span></div>,
  },
  {
    title: 'Fills your trolley',
    photo: 'slide-trolley',
    body: 'Send your list to a Morrisons trolley in a tap, with the Android app or Chrome add-on.',
    preview: <div className="mini-trolley"><b>Fill my Morrisons trolley</b></div>,
  },
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
        {FEATURES.map(({ title, body, photo, preview }, n) => (
          <li key={title} className="slide card" aria-label={`${n + 1} of ${FEATURES.length}`}>
            <div className="slide-pic">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={mealImageSrc(`ph-${photo}`, 960)} srcSet={mealImageSrcSet(`ph-${photo}`)} sizes="(max-width: 430px) 80vw, 340px" alt="" loading="lazy" decoding="async" />
              <div className="slide-ui" aria-hidden>{preview}</div>
              <em aria-hidden>Example</em>
            </div>
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
