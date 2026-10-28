'use client';
import { useEffect, useRef, useState } from 'react';

/** A number that counts up from zero when it first appears (and eases to a new value if it changes). Honours reduced motion. */
export default function CountUp({ value, ms = 900, delay = 0, locale = true, format }: { value: number; ms?: number; delay?: number; locale?: boolean; format?: (n: number) => string }) {
  const [shown, setShown] = useState(0);
  const from = useRef(0);
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setShown(value); return; }
    const start0 = from.current;
    let raf = 0;
    const t0 = performance.now() + delay;
    const tick = (now: number) => {
      const k = Math.min(1, Math.max(0, (now - t0) / ms));
      const eased = 1 - Math.pow(1 - k, 3);
      const v = Math.round(start0 + (value - start0) * eased);
      from.current = v; setShown(v);
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, ms, delay]);
  return <span style={{ fontVariantNumeric: 'tabular-nums' }} aria-label={format ? format(value) : String(value)}>{format ? format(shown) : locale ? shown.toLocaleString('en-GB') : shown}</span>;
}
