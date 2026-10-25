import { addDays, londonInstant } from './dates';
import { effectiveStatus, type Weeks } from './week';

export type ReminderKind = 'opens' | 'last_chance';
export interface Reminder { week: string; kind: ReminderKind; at: Date; title: string; body: string }

/** Sunday 09:00 "open" nudge (picking opens 06:00 that Sunday, a week ahead) and Sunday 16:00 "last chance" for a week that still needs planning. */
export function remindersFor(start: string): Reminder[] {
  return [
    { week: start, kind: 'opens', at: londonInstant(addDays(start, -8), 9), title: 'Next week is open', body: "Next week's meals are open to pick." },
    { week: start, kind: 'last_chance', at: londonInstant(addDays(start, -1), 16), title: 'Last chance', body: 'Pick next week by midnight tonight.' },
  ];
}

/**
 * Reminders that are due now and still useful: the week is still waiting on the user and the reminder
 * has not been shown. `shown` holds `${week}:${kind}` keys.
 */
export function dueReminders(weeks: Weeks, now: Date, shown: readonly string[]): Reminder[] {
  return Object.values(weeks).flatMap((w) => {
    const st = effectiveStatus(weeks, w, now);
    if (st !== 'to_plan' && st !== 'in_progress') return [];
    return remindersFor(w.start).filter((r) => r.at <= now && !shown.includes(`${r.week}:${r.kind}`));
  }).sort((a, b) => b.at.getTime() - a.at.getTime()).slice(0, 1); // only the most recent one; never stack nudges
}
