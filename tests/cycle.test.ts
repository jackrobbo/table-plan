import { describe, expect, it } from 'vitest';
import { addDays, londonDate, londonInstant, mondayOf, nextMondayAfter, weekLabel } from '@/lib/cycle/dates';
import { dueReminders, remindersFor } from '@/lib/cycle/reminders';
import {
  badgeCount, blankWeek, effectiveStatus, ensureWeeks, firstWeek, savePlan, saveList, saveProgress, skipWeek, snapshot, toggleTick, undoSkip, type Weeks,
} from '@/lib/cycle/week';
import type { Plan } from '@/lib/planner/types';

const plan: Plan = { seed: 1, days: [], issues: [] };
const at = (s: string) => new Date(s);

describe('dates (Europe/London)', () => {
  it('finds Mondays', () => {
    expect(mondayOf('2026-10-24')).toBe('2026-10-19');   // Saturday
    expect(mondayOf('2026-10-26')).toBe('2026-10-26');   // Monday itself
    expect(nextMondayAfter('2026-10-26')).toBe('2026-11-02'); // strictly after, even on a Monday
    expect(nextMondayAfter('2026-10-25')).toBe('2026-10-26');
  });
  it('labels weeks', () => {
    expect(weekLabel('2026-10-26')).toBe('26–30 Oct');
    expect(weekLabel('2026-10-26')).not.toBe('2–6 Nov');
    expect(weekLabel('2026-11-02')).toBe('2–6 Nov');
    expect(weekLabel('2026-09-28')).toBe('28 Sep – 2 Oct');
  });
  it('handles the clocks going back on Sun 25 Oct 2026', () => {
    // Monday 26 Oct 00:00 is GMT (UTC+0); Monday 19 Oct 00:00 is BST (UTC+1).
    expect(londonInstant('2026-10-26').toISOString()).toBe('2026-10-26T00:00:00.000Z');
    expect(londonInstant('2026-10-19').toISOString()).toBe('2026-10-18T23:00:00.000Z');
    expect(londonDate(at('2026-10-25T23:30:00Z'))).toBe('2026-10-25');
    expect(londonDate(at('2026-10-19T23:30:00Z'))).toBe('2026-10-20'); // BST: already Tuesday in London
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
  });
});

describe('week states', () => {
  const now0 = at('2026-10-24T10:00:00Z'); // Saturday
  const first = firstWeek(plan, now0);
  const base = (): Weeks => ensureWeeks({ [first.start]: first }, now0);

  it('first week always starts the next Monday, whatever day the user signs up', () => {
    expect(first.start).toBe('2026-10-26');
    expect(firstWeek(plan, at('2026-10-26T09:00:00Z')).start).toBe('2026-11-02'); // signing up on a Monday
    expect(firstWeek(plan, at('2026-10-25T09:00:00Z')).start).toBe('2026-10-26'); // on a Sunday
  });

  it('only one upcoming week is "to plan" at a time', () => {
    const w = base();
    expect(effectiveStatus(w, w['2026-10-26'], now0)).toBe('planned');
    expect(effectiveStatus(w, w['2026-11-02'], now0)).toBe('locked');
    const mon = at('2026-10-26T08:00:00Z');
    const w2 = ensureWeeks(w, mon);
    expect(effectiveStatus(w2, w2['2026-10-26'], mon)).toBe('active');
    expect(effectiveStatus(w2, w2['2026-11-02'], mon)).toBe('to_plan');
    expect(effectiveStatus(w2, w2['2026-11-09'], mon)).toBe('locked');
    expect(badgeCount(snapshot(w2, mon))).toBe(1);
  });

  it('missed deadline = missed week; nothing is auto-picked', () => {
    const w = ensureWeeks(base(), at('2026-11-01T23:59:00Z'));
    expect(effectiveStatus(w, w['2026-11-02'], at('2026-11-01T23:59:00Z'))).toBe('to_plan');
    const later = at('2026-11-02T00:01:00Z');
    const w2 = ensureWeeks(w, later);
    expect(effectiveStatus(w2, w2['2026-11-02'], later)).toBe('missed');
    expect(w2['2026-11-02'].plan).toBeNull();
    expect(effectiveStatus(w2, w2['2026-11-09'], later)).toBe('to_plan'); // next one opens
  });

  it('a planned week becomes active on Monday and done after Friday', () => {
    let w = base();
    w = savePlan(w, '2026-11-02', plan);
    const mon = at('2026-11-02T00:00:00Z');
    expect(effectiveStatus(w, w['2026-11-02'], at('2026-11-01T23:59:00Z'))).toBe('planned');
    expect(effectiveStatus(w, w['2026-11-02'], mon)).toBe('active');
    expect(effectiveStatus(w, w['2026-11-02'], at('2026-11-06T22:00:00Z'))).toBe('active');
    expect(effectiveStatus(w, w['2026-11-02'], at('2026-11-07T00:00:00Z'))).toBe('done');
  });

  it('skipping opens the following week early, and undo restores the order', () => {
    const now = at('2026-10-26T10:00:00Z');
    let w = ensureWeeks(base(), now);
    w = skipWeek(w, '2026-11-02', now);
    expect(effectiveStatus(w, w['2026-11-02'], now)).toBe('skipped');
    expect(effectiveStatus(w, w['2026-11-09'], now)).toBe('to_plan');
    expect(snapshot(w, now).toPlan?.start).toBe('2026-11-09');
    w = undoSkip(w, '2026-11-02', now);
    expect(effectiveStatus(w, w['2026-11-02'], now)).toBe('to_plan');
    expect(effectiveStatus(w, w['2026-11-09'], now)).toBe('locked');
  });

  it('cannot skip a missed or planned week, or undo after the deadline', () => {
    const late = at('2026-11-03T10:00:00Z');
    let w = ensureWeeks(base(), late);
    expect(skipWeek(w, '2026-11-02', late)).toBe(w);
    const now = at('2026-10-26T10:00:00Z');
    w = savePlan(ensureWeeks(base(), now), '2026-11-02', plan);
    expect(skipWeek(w, '2026-11-02', now)).toBe(w);
    const s = skipWeek(ensureWeeks(base(), now), '2026-11-02', now);
    expect(undoSkip(s, '2026-11-02', late)).toBe(s);
  });

  it('tracks in-progress picks, then saves plan and list', () => {
    const now = at('2026-10-26T10:00:00Z');
    let w = ensureWeeks(base(), now);
    w = saveProgress(w, '2026-11-02', ['a', 'b']);
    expect(effectiveStatus(w, w['2026-11-02'], now)).toBe('in_progress');
    w = saveProgress(w, '2026-11-02', []);
    expect(effectiveStatus(w, w['2026-11-02'], now)).toBe('to_plan');
    w = savePlan(w, '2026-11-02', plan);
    w = saveList(w, '2026-11-02', ['eggs'], 'notes');
    expect(w['2026-11-02']).toMatchObject({ status: 'shopped', haveAlready: ['eggs'], checkout: 'notes' });
    expect(saveList(w, '2026-11-09', [], 'notes')).toBe(w); // no plan, nothing to save
  });

  it('ticks toggle and survive reload shape', () => {
    let w = base();
    w = toggleTick(w, '2026-10-26', '0:1');
    expect(w['2026-10-26'].ticks['0:1']).toBe(true);
    w = toggleTick(w, '2026-10-26', '0:1');
    expect(w['2026-10-26'].ticks['0:1']).toBe(false);
  });

  it('snapshot: this week is the first planned week before it starts', () => {
    const s = snapshot(base(), now0);
    expect(s.thisWeek?.start).toBe('2026-10-26');
    expect(s.toPlan).toBeNull();
  });

  it('keeps showing the latest finished week when nothing is active or planned (e.g. after a missed week)', () => {
    const late = at('2026-11-08T17:00:00Z');
    const w = ensureWeeks(base(), late);
    const s = snapshot(w, late);
    expect(s.thisWeek?.start).toBe('2026-10-26');
    expect(s.toPlan?.start).toBe('2026-11-09');
  });

  it('blank weeks are not created before the first plan', () => {
    expect(Object.keys(base()).sort()[0]).toBe('2026-10-26');
    expect(blankWeek('2026-11-02').status).toBe('open');
  });
});

describe('reminders', () => {
  const now0 = at('2026-10-24T10:00:00Z');
  const base = () => ensureWeeks({ '2026-10-26': firstWeek(plan, now0) }, now0);

  it('schedules Monday 09:00 and Sunday 16:00 London time', () => {
    const [open, last] = remindersFor('2026-11-02');
    expect(open.at.toISOString()).toBe('2026-10-26T09:00:00.000Z');
    expect(last.at.toISOString()).toBe('2026-11-01T16:00:00.000Z');
  });
  it('is due only while the week still needs planning, and never stacks', () => {
    const w = ensureWeeks(base(), at('2026-10-26T10:00:00Z'));
    expect(dueReminders(w, at('2026-10-26T08:00:00Z'), [])).toHaveLength(0);
    const mon = dueReminders(w, at('2026-10-26T10:00:00Z'), []);
    expect(mon.map((r) => r.kind)).toEqual(['opens']);
    expect(dueReminders(w, at('2026-10-26T10:00:00Z'), ['2026-11-02:opens'])).toHaveLength(0);
    const sun = dueReminders(w, at('2026-11-01T17:00:00Z'), []);
    expect(sun.map((r) => r.kind)).toEqual(['last_chance']);
    expect(dueReminders(savePlan(w, '2026-11-02', plan), at('2026-11-01T17:00:00Z'), [])).toHaveLength(0);
    expect(dueReminders(w, at('2026-11-02T00:30:00Z'), [])).toHaveLength(0); // missed: no more nudges for it
  });
});
