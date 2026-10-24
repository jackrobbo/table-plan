'use client';
import { useEffect, useState } from 'react';

/** Current time, refreshed every minute and when the tab regains focus (deadlines and states depend on it). */
export function useNow(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const tick = () => setNow(new Date());
    const id = setInterval(tick, 60_000);
    window.addEventListener('focus', tick);
    return () => { clearInterval(id); window.removeEventListener('focus', tick); };
  }, []);
  return now;
}
