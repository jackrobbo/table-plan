import type { Plan } from '../planner/types';
import { addDays, londonDate, londonInstant, mondayOf, nextMondayAfter } from './dates';

/**
 * Stored status is what the USER has done; time-driven states (locked / to_plan / missed / active / done)
 * are derived by `effectiveStatus` so nothing needs a background job to tick over.
 */
export type StoredStatus = 'open' | 'in_progress' | 'planned' | 'shopped' | 'skipped';
export type WeekStatus = 'locked' | 'to_plan' | 'in_progress' | 'planned' | 'shopped' | 'active' | 'done' | 'skipped' | 'missed';

export interface Week {
  /** Monday, "YYYY-MM-DD". */
  start: string;
  status: StoredStatus;
  plan: Plan | null;
  /** Recipe ids the user is hand-picking for this week ("Pick my own"), saved so they can finish later. */
  picks: string[];
  /** Ingredient keys the user has unticked on the list (already have it). */
  haveAlready: string[];
  /** Tick marks: `${dayIndex}:${mealIndex}` → eaten. */
  ticks: Record<string, boolean>;
  checkout?: 'notes' | 'basket';
}
export type Weeks = Record<string, Week>;

export const blankWeek = (start: string): Week => ({ start, status: 'open', plan: null, picks: [], haveAlready: [], ticks: {} });

/** Picking opens at 06:00 on the Sunday a week ahead (the price check has run by then), or earlier if the previous week was skipped. */
export const OPENS_HOUR = 6;
export function opensAt(weeks: Weeks, start: string): Date {
  const prev = addDays(start, -7);
  if (weeks[prev]?.status === 'skipped') return opensAt(weeks, prev);
  return londonInstant(addDays(start, -8), OPENS_HOUR);
}
/** Picking closes at midnight Sunday: the instant the week itself starts. */
export const closesAt = (start: string) => londonInstant(start);
/** Cooking runs Mon–Fri; the week is done from 00:00 Saturday. */
export const endsAt = (start: string) => londonInstant(addDays(start, 5));

export function effectiveStatus(weeks: Weeks, w: Week, now: Date): WeekStatus {
  if (w.status === 'skipped') return 'skipped';
  if (w.plan && (w.status === 'planned' || w.status === 'shopped')) {
    if (now >= endsAt(w.start)) return 'done';
    if (now >= closesAt(w.start)) return 'active';
    return w.status;
  }
  if (now >= closesAt(w.start)) return 'missed';
  if (now < opensAt(weeks, w.start)) return 'locked';
  return w.status === 'in_progress' ? 'in_progress' : 'to_plan';
}

/**
 * Makes sure the weeks a user can see exist: from the first plan's Monday up to two weeks ahead of today.
 * Weeks before the first plan are never created (the first week always starts the next Monday).
 */
export function ensureWeeks(weeks: Weeks, now: Date): Weeks {
  const starts = Object.keys(weeks).sort();
  if (!starts.length) return weeks;
  const out = { ...weeks };
  const horizon = addDays(nextMondayAfter(londonDate(now)), 7);
  for (let s = starts[0]; s <= horizon; s = addDays(s, 7)) if (!out[s]) out[s] = blankWeek(s);
  return out;
}

/** The first week: planned during onboarding, starting the next Monday whatever day the user signs up. */
export function firstWeek(plan: Plan, now: Date): Week {
  return { ...blankWeek(nextMondayAfter(londonDate(now))), status: 'planned', plan };
}

export interface Snapshot {
  /** The week being cooked, the next planned week if it hasn't started, or the latest finished week. */
  thisWeek: Week | null;
  /** Weeks still being decided, soonest first (to_plan / in_progress), then planned-but-not-started. */
  upcoming: { week: Week; status: WeekStatus }[];
  /** The one week the user should plan now, if any. */
  toPlan: Week | null;
}

export function snapshot(weeks: Weeks, now: Date): Snapshot {
  const all = Object.values(weeks).sort((a, b) => a.start.localeCompare(b.start)).map((week) => ({ week, status: effectiveStatus(weeks, week, now) }));
  const active = all.find((x) => x.status === 'active');
  const notStarted = all.find((x) => x.status === 'planned' || x.status === 'shopped');
  // With nothing active or on the way (e.g. a missed week), keep showing the most recent finished week.
  const lastDone = [...all].reverse().find((x) => x.status === 'done');
  const thisWeek = active?.week ?? notStarted?.week ?? lastDone?.week ?? null;
  const upcoming = all.filter((x) => x.week.start > (thisWeek?.start ?? '') && x.status !== 'done' && x.status !== 'active');
  const toPlan = upcoming.find((x) => x.status === 'to_plan' || x.status === 'in_progress')?.week ?? null;
  return { thisWeek, upcoming, toPlan };
}

/** Number shown on the "Upcoming" badge: weeks waiting on the user. */
export const badgeCount = (s: Snapshot) => (s.toPlan ? 1 : 0);

// ---- user actions (pure) ----
const put = (weeks: Weeks, w: Week): Weeks => ({ ...weeks, [w.start]: w });
const must = (weeks: Weeks, start: string) => weeks[start] ?? blankWeek(start);

export function saveProgress(weeks: Weeks, start: string, picks: string[]): Weeks {
  const w = must(weeks, start);
  return put(weeks, { ...w, status: picks.length ? 'in_progress' : 'open', picks });
}

export function savePlan(weeks: Weeks, start: string, plan: Plan): Weeks {
  return put(weeks, { ...must(weeks, start), status: 'planned', plan, haveAlready: [], ticks: {} });
}

export function saveList(weeks: Weeks, start: string, haveAlready: string[], checkout: 'notes' | 'basket'): Weeks {
  const w = must(weeks, start);
  if (!w.plan) return weeks;
  return put(weeks, { ...w, status: 'shopped', haveAlready, checkout });
}

export function skipWeek(weeks: Weeks, start: string, now: Date): Weeks {
  const w = must(weeks, start);
  if (effectiveStatus(weeks, w, now) === 'missed' || w.plan) return weeks; // nothing to skip
  return put(weeks, { ...w, status: 'skipped', picks: [] });
}

export function undoSkip(weeks: Weeks, start: string, now: Date): Weeks {
  const w = weeks[start];
  if (!w || w.status !== 'skipped' || now >= closesAt(start)) return weeks;
  return put(weeks, { ...w, status: 'open' });
}

export function toggleTick(weeks: Weeks, start: string, key: string): Weeks {
  const w = weeks[start];
  if (!w) return weeks;
  return put(weeks, { ...w, ticks: { ...w.ticks, [key]: !w.ticks[key] } });
}

export const mondayKey = (now: Date) => mondayOf(londonDate(now));
