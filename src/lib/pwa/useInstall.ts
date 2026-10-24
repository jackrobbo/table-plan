'use client';
import { useCallback, useEffect, useState } from 'react';
import { MEMORY_KEY, afterDismiss, afterInstall, parseMemory, platformFor, shouldOffer, type InstallMemory, type InstallPlatform } from './install';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

// Chromium fires `beforeinstallprompt` once, early, so it is captured at module level (PwaInit mounts in the root layout).
let deferred: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

const read = (): InstallMemory => {
  try { return parseMemory(localStorage.getItem(MEMORY_KEY)); } catch { return { dismissals: 0 }; }
};
const write = (m: InstallMemory) => { try { localStorage.setItem(MEMORY_KEY, JSON.stringify(m)); } catch { /* private mode: we just may ask again */ } };

let wired = false;
export function wireInstallEvents() {
  if (wired || typeof window === 'undefined') return;
  wired = true;
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferred = e as BeforeInstallPromptEvent; notify(); });
  window.addEventListener('appinstalled', () => { deferred = null; write(afterInstall(read())); notify(); });
}

const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;

export interface InstallState {
  /** Whether it is appropriate to offer the prompt right now (platform supports it, not installed, not recently dismissed). */
  available: boolean;
  platform: InstallPlatform;
  /** Chromium: opens the browser's own install dialog. Returns whether the person accepted. iOS: no-op (false). */
  install: () => Promise<boolean>;
  /** "Not now": starts the cool-down. */
  dismiss: () => void;
}

export function useInstall(): InstallState {
  const [, bump] = useState(0);
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    wireInstallEvents();
    setMounted(true);
    const l = () => bump((n) => n + 1);
    listeners.add(l);
    return () => { listeners.delete(l); };
  }, []);

  const platform = mounted ? platformFor(navigator.userAgent, navigator.maxTouchPoints, !!deferred) : 'none';
  const available = mounted && shouldOffer({ platform, standalone: isStandalone(), memory: read(), now: Date.now() });

  const install = useCallback(async () => {
    const e = deferred;
    if (!e) return false;
    deferred = null; // the event can only be used once
    await e.prompt();
    const { outcome } = await e.userChoice;
    if (outcome === 'accepted') write(afterInstall(read())); else write(afterDismiss(read(), Date.now()));
    notify();
    return outcome === 'accepted';
  }, []);
  const dismiss = useCallback(() => { write(afterDismiss(read(), Date.now())); notify(); }, []);

  return { available, platform, install, dismiss };
}
