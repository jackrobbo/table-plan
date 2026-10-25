'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import ShopMode from '@/components/ShopMode';
import type { Shopping } from '@/lib/planner/shopping';
import { track } from '@/lib/analytics';
import { basketItems, basketUrl, extensionInstalled, nativeMorrisons } from '@/lib/basket';

/**
 * "Fill my Morrisons trolley": hands the list to the Table Plan browser extension, which presses Add on each product in the
 * person's own Morrisons session. Without the extension we say so rather than showing a button that does nothing.
 */
export default function BasketButton({ shopping, have }: { shopping: Shopping; have: string[] }) {
  const [installed, setInstalled] = useState(false);
  const [app, setApp] = useState(false);
  const [shopping_, setShop] = useState(false);
  useEffect(() => { setInstalled(extensionInstalled()); setApp(!!nativeMorrisons()); }, []);
  const items = basketItems(shopping, have);
  const url = basketUrl(items);
  if (!url) return null;
  const packs = items.reduce((a, x) => a + x.q, 0);

  if (app) {
    return (
      <div className="card" style={{ marginTop: 12 }}>
        <button className="btn" onClick={() => { track('basket_fill_started', { items: items.length, packs, app: true }); void nativeMorrisons()?.open({ items }); }}>
          Fill my Morrisons trolley
        </button>
        <button className="linkbtn" onClick={() => setShop(true)}>Or shop item by item</button>
        {shopping_ && <ShopMode shopping={shopping} have={have} onClose={() => setShop(false)} />}
        <p className="muted" style={{ margin: '8px 0 0' }}>Opens Morrisons inside the app and adds {items.length} item{items.length === 1 ? '' : 's'} ({packs} pack{packs === 1 ? '' : 's'}). Sign in to Morrisons there if you like, then pick your slot and check out.</p>
      </div>
    );
  }
  if (installed) {
    return (
      <div className="card" style={{ marginTop: 12 }}>
        <button className="btn" onClick={() => { track('basket_fill_started', { items: items.length, packs }); window.open(url, '_blank', 'noopener'); }}>
          Fill my Morrisons trolley
        </button>
        <button className="linkbtn" onClick={() => setShop(true)}>Or shop item by item</button>
        {shopping_ && <ShopMode shopping={shopping} have={have} onClose={() => setShop(false)} />}
        <p className="muted" style={{ margin: '8px 0 0' }}>Opens Morrisons and adds {items.length} item{items.length === 1 ? '' : 's'} ({packs} pack{packs === 1 ? '' : 's'}) for you. You pick the slot and check out.</p>
      </div>
    );
  }
  return (
    <div className="card" style={{ marginTop: 12 }}>
      <h3>Fill your Morrisons trolley</h3>
      <p className="muted" style={{ margin: '4px 0 10px' }}>On a phone: shop item by item, in aisle order, one tap to open each at Morrisons. On a computer, our browser add-on (beta) can add the whole list for you.</p>
      <button className="btn" onClick={() => setShop(true)}>Shop item by item</button>
      <Link className="btn ghost" style={{ marginTop: 8 }} href="/extension">Get the add-on (computer)</Link>
      {shopping_ && <ShopMode shopping={shopping} have={have} onClose={() => setShop(false)} />}
    </div>
  );
}
