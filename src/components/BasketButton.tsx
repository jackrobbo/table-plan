'use client';
import { useEffect, useState } from 'react';
import type { Shopping } from '@/lib/planner/shopping';
import { track } from '@/lib/analytics';
import { basketItems, basketUrl, extensionInstalled } from '@/lib/basket';

/**
 * "Fill my Morrisons trolley": hands the list to the Table Plan browser extension, which presses Add on each product in the
 * person's own Morrisons session. Without the extension we say so rather than showing a button that does nothing.
 */
export default function BasketButton({ shopping, have }: { shopping: Shopping; have: string[] }) {
  const [installed, setInstalled] = useState(false);
  useEffect(() => { setInstalled(extensionInstalled()); }, []);
  const items = basketItems(shopping, have);
  const url = basketUrl(items);
  if (!url) return null;
  const packs = items.reduce((a, x) => a + x.q, 0);

  if (installed) {
    return (
      <div className="card" style={{ marginTop: 12 }}>
        <button className="btn" onClick={() => { track('basket_fill_started', { items: items.length, packs }); window.open(url, '_blank', 'noopener'); }}>
          Fill my Morrisons trolley
        </button>
        <p className="muted" style={{ margin: '8px 0 0' }}>Opens Morrisons and adds {items.length} item{items.length === 1 ? '' : 's'} ({packs} pack{packs === 1 ? '' : 's'}) for you. You pick the slot and check out.</p>
      </div>
    );
  }
  return (
    <p className="muted" style={{ marginTop: 12 }}>
      On a computer? The Table Plan browser extension (beta) can fill your Morrisons trolley for you. It isn&apos;t available on phones yet, so tap an item&apos;s &ldquo;Morrisons&rdquo; link there.
    </p>
  );
}
