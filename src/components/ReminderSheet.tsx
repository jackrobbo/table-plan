'use client';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Bell } from 'lucide-react';
import { track } from '@/lib/analytics';

/**
 * The "Never Miss a Week" prompt, as a bottom sheet right after a week is saved (the moment reminders make sense). Answering it either
 * way marks it asked, which lets the next prompt (add to home screen) follow.
 */
export default function ReminderSheet({ when, delayMs = 700, onAnswer }: { when: boolean; delayMs?: number; onAnswer: (on: boolean) => void }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!when || open) return;
    const t = setTimeout(() => { setOpen(true); track('reminders_prompt_shown'); }, delayMs);
    return () => clearTimeout(t);
  }, [when, open, delayMs]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') answer(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  if (!open) return null;

  const answer = (on: boolean) => {
    setOpen(false);
    track(on ? 'reminders_prompt_accepted' : 'reminders_prompt_dismissed');
    if (on) { try { if (typeof Notification !== 'undefined') void Notification.requestPermission(); } catch { /* optional */ } }
    onAnswer(on);
  };

  return createPortal(
    <div className="sheet-wrap" onClick={() => answer(false)}>
      <div className="sheet" role="dialog" aria-modal="true" aria-labelledby="remind-title" onClick={(e) => e.stopPropagation()}>
        <div className="grab" />
        <div className="install-head">
          <div className="logo" aria-hidden><Bell size={20} /></div>
          <div>
            <h2 id="remind-title" style={{ fontSize: 22 }}>Never Miss a Week</h2>
            <p className="muted" style={{ margin: '4px 0 0' }}>Sunday morning: next week&apos;s meals are open. The Sunday after, 4pm: last chance, pick by midnight.</p>
          </div>
        </div>
        <div className="install-actions sheet-foot">
          <button className="btn" onClick={() => answer(true)}>Turn On Reminders</button>
          <button className="linkbtn" onClick={() => answer(false)}>Not Now</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
