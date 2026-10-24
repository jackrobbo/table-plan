import Link from 'next/link';
import type { ReactNode } from 'react';
import { POLICY_UPDATED } from '@/lib/legal/config';

/** Shell for the long-form legal pages: readable column, plain headings, a way back. */
export default function LegalPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="screen legal">
      <div className="nav"><Link className="back" href="/">Back</Link></div>
      <main>
        <h1>{title}</h1>
        <p className="muted">Last updated {POLICY_UPDATED}. Table Plan is in private beta, so this may change as we grow; we&apos;ll tell you about changes that matter.</p>
        {children}
        <p className="muted" style={{ marginTop: 28 }}><Link href="/privacy">Privacy policy</Link> · <Link href="/terms">Terms of use</Link></p>
      </main>
    </div>
  );
}
