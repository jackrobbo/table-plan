/**
 * "Add to home screen" prompt logic. Pure so it can be unit-tested; the browser wiring is in useInstall.ts.
 * iOS has no install API, so we show Share-menu steps there. Chromium fires `beforeinstallprompt`, which we hold
 * and replay from our own button. Anywhere else we say nothing (a prompt we can't action is just noise).
 */
export type InstallPlatform = 'ios' | 'prompt' | 'none';

export interface InstallMemory {
  /** ms epoch of the last "Not now". */
  dismissedAt?: number;
  dismissals: number;
  /** Set on `appinstalled` or after an accepted prompt: never ask again. */
  installed?: boolean;
}

/** Wait this long after the 1st and 2nd "Not now"; after the 3rd we stop asking. */
export const COOLDOWN_DAYS = [14, 60];
export const MAX_DISMISSALS = COOLDOWN_DAYS.length + 1;
const DAY = 86_400_000;

/** iPhone/iPad. iPadOS 13+ reports as a Mac, so a touch screen on "Macintosh" counts. */
export function isIos(ua: string, maxTouchPoints = 0): boolean {
  return /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && maxTouchPoints > 1);
}

export function platformFor(ua: string, maxTouchPoints: number, hasDeferredPrompt: boolean): InstallPlatform {
  if (hasDeferredPrompt) return 'prompt';
  return isIos(ua, maxTouchPoints) ? 'ios' : 'none';
}

export function shouldOffer(o: { platform: InstallPlatform; standalone: boolean; memory: InstallMemory; now: number }): boolean {
  const { platform, standalone, memory, now } = o;
  if (platform === 'none' || standalone || memory.installed) return false;
  if (memory.dismissals >= MAX_DISMISSALS) return false;
  if (memory.dismissals === 0 || memory.dismissedAt === undefined) return true;
  return now - memory.dismissedAt >= COOLDOWN_DAYS[memory.dismissals - 1] * DAY;
}

export const afterDismiss = (m: InstallMemory, now: number): InstallMemory => ({ ...m, dismissals: m.dismissals + 1, dismissedAt: now });
export const afterInstall = (m: InstallMemory): InstallMemory => ({ ...m, installed: true });

export const MEMORY_KEY = 'tp.install.v1';
export function parseMemory(raw: string | null): InstallMemory {
  try {
    const j = raw ? (JSON.parse(raw) as Partial<InstallMemory>) : {};
    return {
      dismissals: Number.isFinite(j.dismissals) ? Math.max(0, Number(j.dismissals)) : 0,
      dismissedAt: Number.isFinite(j.dismissedAt) ? Number(j.dismissedAt) : undefined,
      installed: j.installed === true,
    };
  } catch { return { dismissals: 0 }; }
}
