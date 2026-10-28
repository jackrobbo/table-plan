'use client';
import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';

const OUT_MS = 200;
const PAGE_OUT_MS = 140;
const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Exit motion for things React removes outright. Sheets are portalled to <body>, so when one unmounts we put the same node back
 * with an `.out` class for the length of its exit animation. In-app links fade the page out first, then navigate.
 */
export default function MotionLayer() {
  const router = useRouter();
  const path = usePathname();

  useEffect(() => { delete document.documentElement.dataset.leaving; }, [path]);

  useEffect(() => {
    const seen = new WeakSet<Node>();
    const mo = new MutationObserver((list) => {
      if (reduced()) return;
      for (const m of list) m.removedNodes.forEach((n) => {
        if (!(n instanceof HTMLElement) || !n.classList.contains('sheet-wrap') || seen.has(n) || m.target !== document.body) return;
        seen.add(n);
        n.classList.add('out');
        document.body.appendChild(n);
        setTimeout(() => n.remove(), OUT_MS);
      });
    });
    mo.observe(document.body, { childList: true });

    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || reduced()) return;
      const a = (e.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
      if (!a || a.target || a.hasAttribute('download') || a.closest('.tabbar, .sheet-wrap')) return;
      const u = new URL(a.href, location.href);
      if (u.origin !== location.origin || (u.pathname === location.pathname && u.search === location.search)) return;
      e.preventDefault(); e.stopPropagation();
      document.documentElement.dataset.leaving = '1';
      setTimeout(() => router.push(u.pathname + u.search + u.hash), PAGE_OUT_MS);
    };
    document.addEventListener('click', onClick, true);
    return () => { mo.disconnect(); document.removeEventListener('click', onClick, true); };
  }, [router]);

  return null;
}
