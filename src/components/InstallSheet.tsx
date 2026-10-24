'use client';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { track } from '@/lib/analytics';
import { useInstall, wireInstallEvents } from '@/lib/pwa/useInstall';

/** Mounted in the root layout so the browser's one-shot install event is never missed. Renders nothing. */
export function PwaInit() {
  useEffect(() => { wireInstallEvents(); }, []);
  return null;
}

const ShareIcon = () => (
  <svg className="inline-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M12 15V3M8 7l4-4 4 4" /><path d="M6 11H5a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2h-1" />
  </svg>
);
const PlusIcon = () => (
  <svg className="inline-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
    <rect x="3" y="3" width="18" height="18" rx="4" /><path d="M12 8v8M8 12h8" />
  </svg>
);

/**
 * "Add Table Plan to your home screen" bottom sheet. Shown once `when` is true (we use: right after a week is saved),
 * after a short beat so the confirmation lands first. Only appears where we can action it (iOS steps / Chromium prompt),
 * never inside the installed app, and backs off after "Not now" (see install.ts).
 */
export default function InstallSheet({ when, delayMs = 900 }: { when: boolean; delayMs?: number }) {
  const { available, platform, install, dismiss } = useInstall();
  const [open, setOpen] = useState(false);
  const primary = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!when || !available || open) return;
    const t = setTimeout(() => { setOpen(true); track('install_prompt_shown', { platform }); }, delayMs);
    return () => clearTimeout(t);
  }, [when, available, open, platform, delayMs]);

  useEffect(() => {
    if (!open) return;
    primary.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') notNow(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  const notNow = () => { dismiss(); setOpen(false); track('install_prompt_dismissed', { platform }); };
  const add = async () => {
    const ok = await install();
    track(ok ? 'install_prompt_accepted' : 'install_prompt_dismissed', { platform });
    setOpen(false);
  };

  // Portalled to <body>: <main> runs an entrance animation, which traps z-index and let the sticky footer paint over the sheet.
  return createPortal(
    <div className="sheet-wrap" onClick={notNow}>
      <div className="sheet install" role="dialog" aria-modal="true" aria-labelledby="install-title" onClick={(e) => e.stopPropagation()}>
        <div className="grab" />
        <div className="install-head">
          <div className="logo" aria-hidden>T</div>
          <div>
            <h2 id="install-title" style={{ fontSize: 22 }}>Add Table Plan to your home screen</h2>
            <p className="muted" style={{ margin: '4px 0 0' }}>Open your week like an app: full screen, one tap away, with your shopping list ready in the shop.</p>
          </div>
        </div>
        {platform === 'ios' && (
          <ol className="install-steps">
            <li><span className="n">1</span><span>Tap <b>Share</b> <ShareIcon /> in the Safari toolbar</span></li>
            <li><span className="n">2</span><span>Scroll and choose <b>Add to Home Screen</b> <PlusIcon /></span></li>
            <li><span className="n">3</span><span>Tap <b>Add</b></span></li>
          </ol>
        )}
        {platform === 'ios' && <p className="muted" style={{ margin: '0 0 12px' }}>The first time you open it from your home screen you&apos;ll sign in once more with a code, then you stay signed in.</p>}
        <div className="install-actions">
          {platform === 'ios'
            ? <button ref={primary} className="btn" onClick={notNow}>Got it</button>
            : <button ref={primary} className="btn" onClick={add}>Add to home screen</button>}
          {platform !== 'ios' && <button className="linkbtn" onClick={notNow}>Not now</button>}
        </div>
      </div>
    </div>,
    document.body,
  );
}
