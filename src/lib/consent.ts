import { skipStat } from './onboarding';
import type { Profile } from './profile';
import { CONSENT_VERSION } from './legal/config';

/** Everyone must have agreed (to our use of their health information, and to the terms) at the current version before we ask for any of it. */
export const needsConsent = (p: Profile): boolean => p.consent?.version !== CONSENT_VERSION || !p.consent.health || !p.consent.terms;

export function giveConsent(p: Profile, now = new Date()): Profile {
  const at = now.toISOString();
  return { ...p, consent: { health: at, terms: at, version: CONSENT_VERSION } };
}

/**
 * Withdrawing consent stops us holding the health information it covered: body measurements, allergies and the plans built from
 * them go, and the person is asked to agree again before they can carry on. Their login, subscription and food likes stay.
 */
export function withdrawConsent(p: Profile): Profile {
  const cleared = (['height', 'weight', 'age', 'sex'] as const).reduce((acc, s) => skipStat(acc, s), p);
  return { ...cleared, consent: null, allergies: [], noAllergies: false, skipped: {}, weeks: {}, completed: false, step: 'goal' };
}
