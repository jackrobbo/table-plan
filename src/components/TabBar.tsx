'use client';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { CalendarDays, Clock, CookingPot, UserRound, type LucideIcon } from 'lucide-react';
import { useSignedIn } from '@/lib/useSignedIn';
import { useTabBadge } from '@/lib/tabBadge';

/** Main screens for someone signed in. Setup flows (sign-in, onboarding, planning next week) keep their own pinned button instead. */
const MAIN = ['/plan', '/account', '/settings'];

const ICONS: Record<string, LucideIcon> = { plan: CalendarDays, upcoming: Clock, recipes: CookingPot, account: UserRound };

export default function TabBar() {
  const path = usePathname() ?? '/';
  const view = useSearchParams().get('v');
  const signedIn = useSignedIn(path);
  const badge = useTabBadge();
  const show = signedIn === true && MAIN.some((p) => path === p);

  // Tell the page's stylesheet a bar is present so pinned buttons and the last card clear it.
  useEffect(() => {
    if (!show) return;
    document.body.dataset.tabbar = '1';
    return () => { delete document.body.dataset.tabbar; };
  }, [show]);

  // Which way the next screen should slide in: set on tap, before the new content mounts.
  const prev = useRef(0);
  if (!show) return null;
  const onPlan = path === '/plan';
  const tabs = [
    { id: 'plan', label: 'Plan', href: '/plan', on: onPlan && view !== 'upcoming' && view !== 'recipes' },
    { id: 'upcoming', label: 'Upcoming', href: '/plan?v=upcoming', on: onPlan && view === 'upcoming' },
    { id: 'recipes', label: 'Menu', href: '/plan?v=recipes', on: onPlan && view === 'recipes' },
    { id: 'account', label: 'Account', href: '/account', on: !onPlan },
  ];

  const idx = Math.max(0, tabs.findIndex((t) => t.on));
  prev.current = idx;
  const go = (i: number) => { document.documentElement.dataset.navdir = i >= prev.current ? 'fwd' : 'back'; };

  return (
    <nav className="tabbar" aria-label="Main">
      <div className="tabbar-in">
        <span className="tab-pill" aria-hidden style={{ transform: `translateX(${idx * 100}%)` }} />
        {tabs.map((t, i) => (
          <Link key={t.id} href={t.href} replace={onPlan && t.href.startsWith('/plan')} className="tab" aria-current={t.on ? 'page' : undefined} onClick={() => go(i)}>
            {(() => { const Icon = ICONS[t.id]; return <Icon size={22} aria-hidden />; })()}
            <span>{t.label}</span>
            {t.id === 'upcoming' && badge > 0 && <span key={badge} className="badge pop" aria-label={`${badge} to plan`}>{badge}</span>}
          </Link>
        ))}
      </div>
    </nav>
  );
}
