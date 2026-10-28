import { describe, expect, it } from 'vitest';
import { emptyProfile } from '../src/lib/profile';
import { profileToRow, rowToProfile } from '../src/lib/db/profileRow';
import { blankWeek } from '../src/lib/cycle/week';

describe('profile row round trip', () => {
  it('keeps the newer week and reminder fields (weeks and reminders are jsonb, so no migration)', () => {
    const p = emptyProfile();
    p.weeks = { '2026-11-02': { ...blankWeek('2026-11-02'), status: 'shopped', checkout: 'basket', wantCupboard: ['rice', 'soy'], ticks: { '0:0': true } } };
    p.reminders = { on: true, shown: [], asked: true };
    p.meals.dinner = { mode: 'plan', extraServings: 2 };
    const back = rowToProfile(profileToRow('u1', p));
    expect(back.weeks['2026-11-02']).toMatchObject({ status: 'shopped', checkout: 'basket', wantCupboard: ['rice', 'soy'], ticks: { '0:0': true } });
    expect(back.reminders).toEqual({ on: true, shown: [], asked: true });
    expect(back.meals.dinner.extraServings).toBe(2);
  });
  it('loads rows saved before these fields existed', () => {
    const old = rowToProfile({ weeks: { '2026-10-26': { ...blankWeek('2026-10-26') } }, reminders: { on: false, shown: [] } });
    expect(old.weeks['2026-10-26'].wantCupboard).toBeUndefined();
    expect(old.reminders.asked).toBeUndefined();
  });
});
