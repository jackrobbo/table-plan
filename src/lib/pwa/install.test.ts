import { describe, expect, it } from 'vitest';
import { COOLDOWN_DAYS, MAX_DISMISSALS, afterDismiss, afterInstall, isIos, parseMemory, platformFor, shouldOffer } from './install';

const DAY = 86_400_000;
const NOW = Date.UTC(2026, 9, 24);
const base = { platform: 'ios' as const, standalone: false, memory: { dismissals: 0 }, now: NOW };

describe('platform detection', () => {
  it('detects iPhone, iPad and iPadOS-as-Mac (touch)', () => {
    expect(isIos('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)')).toBe(true);
    expect(isIos('Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)')).toBe(true);
    expect(isIos('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 5)).toBe(true);
    expect(isIos('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 0)).toBe(false);
    expect(isIos('Mozilla/5.0 (X11; Linux x86_64) Chrome/120')).toBe(false);
  });
  it('prefers the native prompt when the browser handed us one, else iOS steps, else nothing', () => {
    expect(platformFor('Chrome Android', 5, true)).toBe('prompt');
    expect(platformFor('iPhone', 5, false)).toBe('ios');
    expect(platformFor('Firefox desktop', 0, false)).toBe('none');
  });
});

describe('shouldOffer', () => {
  it('offers on first time on a supported platform', () => expect(shouldOffer(base)).toBe(true));
  it('never offers where it cannot be actioned, inside the installed app, or once installed', () => {
    expect(shouldOffer({ ...base, platform: 'none' })).toBe(false);
    expect(shouldOffer({ ...base, standalone: true })).toBe(false);
    expect(shouldOffer({ ...base, memory: afterInstall({ dismissals: 0 }) })).toBe(false);
  });
  it('backs off after "Not now": 14 days, then 60, then stops', () => {
    let m = afterDismiss({ dismissals: 0 }, NOW);
    expect(shouldOffer({ ...base, memory: m, now: NOW + 13 * DAY })).toBe(false);
    expect(shouldOffer({ ...base, memory: m, now: NOW + COOLDOWN_DAYS[0] * DAY })).toBe(true);
    m = afterDismiss(m, NOW + 20 * DAY);
    expect(shouldOffer({ ...base, memory: m, now: NOW + 20 * DAY + 59 * DAY })).toBe(false);
    expect(shouldOffer({ ...base, memory: m, now: NOW + 20 * DAY + COOLDOWN_DAYS[1] * DAY })).toBe(true);
    m = afterDismiss(m, NOW + 100 * DAY);
    expect(m.dismissals).toBe(MAX_DISMISSALS);
    expect(shouldOffer({ ...base, memory: m, now: NOW + 1000 * DAY })).toBe(false);
  });
});

describe('parseMemory', () => {
  it('survives junk storage', () => {
    expect(parseMemory(null)).toEqual({ dismissals: 0, dismissedAt: undefined, installed: false });
    expect(parseMemory('not json')).toEqual({ dismissals: 0 });
    expect(parseMemory('{"dismissals":2,"dismissedAt":5,"installed":true}')).toEqual({ dismissals: 2, dismissedAt: 5, installed: true });
    expect(parseMemory('{"dismissals":"x"}').dismissals).toBe(0);
  });
});
