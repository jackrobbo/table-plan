'use client';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ListChecks, Monitor, Smartphone } from 'lucide-react';
import Link from 'next/link';
import ShopMode from '@/components/ShopMode';
import type { Shopping } from '@/lib/planner/shopping';
import { track } from '@/lib/analytics';
import { basketItems, basketUrl, clearFill, extensionInstalled, fillOutcome, loadFill, nativeMorrisons, saveFill, type FillReport } from '@/lib/basket';
import { DEFAULT_STORE, STORES, type Store } from '@/lib/stores';

/**
 * "Checkout at Morrisons": hands the list to the Table Plan browser extension, which presses Add on each product in the
 * person's own Morrisons session. Without the extension we say so rather than showing a button that does nothing.
 */
export default function BasketButton({ shopping, have, onDone, store = STORES[DEFAULT_STORE] }: { shopping: Shopping; have: string[]; onDone?: () => void; store?: Store }) {
  const [installed, setInstalled] = useState(false);
  const [app, setApp] = useState(false);
  const [report, setReport] = useState<FillReport | null>(null);
  const [shopping_, setShop] = useState(false);
  const [choose, setChoose] = useState(false);
  // The app and extension fill only the stores they have an adapter for (see stores.ts `fill`).
  useEffect(() => { setInstalled(store.fill.extension && extensionInstalled()); setApp(store.fill.app && !!nativeMorrisons()); setReport(loadFill()); }, [store]);
  const items = basketItems(shopping, have, store);
  const url = basketUrl(items, store);
  const packs = items.reduce((a, x) => a + x.q, 0);

  // The pinned "Checkout With Morrisons" button lives in the page footer and asks us to start: fill the trolley with the app or
  // extension when there is one, otherwise let the person choose how.
  const run = () => {
    if (!url) return;
    if (app) { track('basket_fill_started', { items: items.length, packs, app: true }); void nativeMorrisons()?.open({ items }).then((r) => { if (r.results?.length) { saveFill(r); setReport(r); onDone?.(); } }).catch(() => undefined); }
    else if (installed) { track('basket_fill_started', { items: items.length, packs }); window.open(url, '_blank', 'noopener'); onDone?.(); }
    else setChoose(true);
  };
  const latest = useRef(run);
  latest.current = run;
  useEffect(() => {
    const on = () => latest.current();
    window.addEventListener('tp:checkout', on);
    return () => window.removeEventListener('tp:checkout', on);
  }, []);

  if (!url) return null;
  const outcome = report ? fillOutcome(shopping, have, report, store) : null;

  if (app) {
    return (
      <div id="checkout" style={{ marginTop: 4, textAlign: 'center' }}>
        <button className="linkbtn" onClick={() => setShop(true)}>Shop Item by Item Instead</button>
        {shopping_ && <ShopMode store={store} shopping={shopping} have={outcome ? [...have, ...outcome.added.map((l) => l.key)] : have} onClose={() => setShop(false)} onFinish={onDone} />}
        {outcome && (
          <div className="note" style={{ marginTop: 12 }} role="status">
            <b>Last fill: {outcome.added.length} of {outcome.added.length + outcome.todo.length} in your trolley.</b>
            {outcome.todo.length > 0 ? (<>
              <p style={{ margin: '6px 0 2px' }}>Still to add yourself:</p>
              <ul className="plain">{outcome.todo.map(({ line, note }) => (
                <li key={line.key}>{line.name}{line.packs > 1 ? ` ×${line.packs}` : ''} <span className="muted">· {note}</span></li>
              ))}</ul>
              <button className="linkbtn" onClick={() => setShop(true)}>Add These Item by Item</button>
            </>) : <p style={{ margin: '6px 0 0' }}>Everything on your list went in. Check the trolley and pick a slot.</p>}
            <button className="linkbtn" onClick={() => { clearFill(); setReport(null); }}>Clear</button>
          </div>
        )}
      </div>
    );
  }
  if (installed) {
    return (
      <div id="checkout" style={{ marginTop: 4, textAlign: 'center' }}>
        <button className="linkbtn" onClick={() => setShop(true)}>Shop Item by Item Instead</button>
        {shopping_ && <ShopMode store={store} shopping={shopping} have={have} onClose={() => setShop(false)} onFinish={onDone} />}
      </div>
    );
  }
  return (
    <div id="checkout">
      {choose && createPortal(
        <div className="sheet-wrap" onClick={() => setChoose(false)}>
          <div className="sheet" role="dialog" aria-label={`Check out at ${store.name}`} onClick={(e) => e.stopPropagation()}>
            <div className="grab" />
            <h2>Check Out at {store.name}</h2>
            <p className="muted">{store.name} doesn&apos;t let other apps fill a trolley, so we do it in your own browser. Pick what suits you.</p>
            <div className="opts">
              <Link className="opt" href="/app"><span className="opt-ico"><Smartphone size={20} aria-hidden /></span><span className="opt-txt"><b>Android App</b><span className="d">Fills your trolley in one tap. Best on your phone.</span></span></Link>
              <Link className="opt" href="/extension"><span className="opt-ico"><Monitor size={20} aria-hidden /></span><span className="opt-txt"><b>Chrome Add-on</b><span className="d">Fills your trolley from a computer.</span></span></Link>
              <button className="opt" onClick={() => { setChoose(false); setShop(true); }}><span className="opt-ico"><ListChecks size={20} aria-hidden /></span><span className="opt-txt"><b>Shop Item by Item</b><span className="d">Works anywhere. One tap per product.</span></span></button>
            </div>
            <div className="sheet-foot"><button className="btn ghost" onClick={() => setChoose(false)}>Cancel</button></div>
          </div>
        </div>, document.body)}
      {shopping_ && <ShopMode store={store} shopping={shopping} have={have} onClose={() => setShop(false)} onFinish={onDone} />}
    </div>
  );
}
