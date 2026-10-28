import { CalendarDays } from 'lucide-react';
import { weekLabel } from '@/lib/cycle/dates';

/** "2–6 Nov" with a small calendar icon: the week a screen is about. Pass the week's Monday (YYYY-MM-DD). */
export default function WeekRange({ start }: { start: string }) {
  return <span className="wk"><CalendarDays size={14} aria-hidden />{weekLabel(start)}</span>;
}
