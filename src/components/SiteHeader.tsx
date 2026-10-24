'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import StatusBanner from '@/components/StatusBanner';
import { useSignedIn } from '@/lib/useSignedIn';

/** Focused flows keep the brand but drop the nav, so nobody wanders off mid-setup. */
const FOCUSED = ['/signin', '/onboarding', '/plan/next', '/subscribe'];

/** Site header: logo + BETA on the left, nav on the right. Nav follows sign-in state (re-read on every route change). */
export default function SiteHeader() {
  const path = usePathname() ?? '/';
  const signedIn = useSignedIn(path);

  const focused = FOCUSED.some((p) => path === p || path.startsWith(p + '/'));
  const link = (href: string, label: string) => (
    <Link href={href} className="hnav-link" aria-current={path === href || (href === '/plan' && path.startsWith('/plan')) ? 'page' : undefined}>{label}</Link>
  );

  return (
    <>
    <header className="site-header">
      <div className="site-header-in">
        <Link href={signedIn ? '/plan' : '/'} className="hbrand" aria-label="Table Plan, beta">
          <span className="logo sm" aria-hidden>T</span>
          <span className="hname">Table Plan</span>
          <span className="beta" aria-hidden>BETA</span>
        </Link>
        {!focused && signedIn !== null && (
          <nav className="hnav" aria-label="Main">
            {signedIn ? <>{link('/plan', 'Plan')}{link('/account', 'Account')}</> : link('/signin', 'Sign in')}
          </nav>
        )}
      </div>
    </header>
    <StatusBanner />
    </>
  );
}
