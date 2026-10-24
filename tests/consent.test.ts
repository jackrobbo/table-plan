import { describe, expect, it } from 'vitest';
import { giveConsent, needsConsent, withdrawConsent } from '@/lib/consent';
import { profileToRow, rowToProfile } from '@/lib/db/profileRow';
import { CONSENT_VERSION } from '@/lib/legal/config';
import { emptyProfile, type Profile } from '@/lib/profile';

const onboarded = (): Profile => ({
  ...emptyProfile(), goal: 'lose', stats: { sex: 'f', age: 34, heightCm: 168, weightKg: 74, activity: 1.375 }, allergies: ['milk'], completed: true, step: 'taste',
  weeks: { '2026-10-26': { start: '2026-10-26', status: 'planned', plan: null, picks: [], haveAlready: [], ticks: {} } }, likedRecipes: ['a', 'b'],
});

describe('consent to use health information', () => {
  it('is needed until given, and given means both the health use and the terms, at this version', () => {
    const p = onboarded();
    expect(needsConsent(p)).toBe(true);
    const agreed = giveConsent(p, new Date('2026-10-24T12:00:00Z'));
    expect(agreed.consent).toEqual({ health: '2026-10-24T12:00:00.000Z', terms: '2026-10-24T12:00:00.000Z', version: CONSENT_VERSION });
    expect(needsConsent(agreed)).toBe(false);
    expect(needsConsent({ ...agreed, consent: { ...agreed.consent!, version: 'older' } })).toBe(true);
    expect(needsConsent({ ...agreed, consent: { ...agreed.consent!, health: '' } })).toBe(true);
  });

  it('withdrawing removes the health information and what was built from it, and asks again', () => {
    const w = withdrawConsent(giveConsent(onboarded()));
    expect(w.consent).toBeNull();
    expect(needsConsent(w)).toBe(true);
    expect(w.stats.heightCm).toBeUndefined();
    expect(w.stats.weightKg).toBeUndefined();
    expect(w.stats.age).toBeUndefined();
    expect(w.stats.sex).toBeUndefined();
    expect(w.allergies).toEqual([]);
    expect(w.noAllergies).toBe(false);
    expect(w.weeks).toEqual({});
    expect(w.completed).toBe(false);
    expect(w.likedRecipes).toEqual(['a', 'b']);   // taste in food isn't health information
  });

  it('is stored with the profile and survives a round trip; older rows load as "not yet agreed"', () => {
    const p = giveConsent(onboarded(), new Date('2026-10-24T12:00:00Z'));
    expect(rowToProfile(profileToRow('u1', p)).consent).toEqual(p.consent);
    const { consent: _drop, ...oldRow } = profileToRow('u1', p);
    expect(rowToProfile(oldRow).consent).toBeNull();
  });
});
