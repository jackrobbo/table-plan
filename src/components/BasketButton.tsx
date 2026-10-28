'use client';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { ListChecks, Monitor, Smartphone } from 'lucide-react';
import Link from 'next/link';
import ShopMode from '@/components/ShopMode';
import type { Shopping } from '@/lib/planner/shopping';
import { track } from '@/lib/analytics';
import { basketItems, basketUrl, clearFill, extensionInstalled, fillOutcome, loadFill, nativeMorrisons, saveFill, type FillReport } from '@/lib/basket';

/**
 * "Checkout at Morrisons": hands the list to the Table Plan browser extension, which presses Add on each product in the
 * person's own Morrisons session. Without the extension we say so rather than showing a button that does nothing.
 */
export default function BasketButton({ shopping, have }: { shopping: Shopping; have: string[] }) {
  const [installed, setInstalled] = useState(false);
  const [app, setApp] = useState(false);
  const [report, setReport] = useState<FillReport | null>(null);
  const [shopping_, setShop] = useState(false);
  const [choose, setChoose] = useState(false);
  useEffect(() => { setInstalled(extensionInstalled()); setApp(!!nativeMorrisons()); setReport(loadFill()); }, []);
  const items = basketItems(shopping, have);
  const url = basketUrl(items);
  if (!url) return null;
  const outcome = report ? fillOutcome(shopping, have, report) : null;
  const packs = items.reduce((a, x) => a + x.q, 0);

  if (app) {
    return (
      <div className="card" style={{ marginTop: 12 }}>
        <button className="btn" onClick={() => { track('basket_fill_started', { items: items.length, packs, app: true }); void nativeMorrisons()?.open({ items }).then((r) => { if (r.results?.length) { saveFill(r); setReport(r); } }).catch(() => undefined); }}>
          Checkout at Morrisons
        </button>
        <button className="linkbtn" onClick={() => setShop(true)}>Or Shop Item by Item</button>
        {shopping_ && <ShopMode shopping={shopping} have={outcome ? [...have, ...outcome.added.map((l) => l.key)] : have} onClose={() => setShop(false)} />}
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
        <p className="muted" style={{ margin: '8px 0 0' }}>Opens Morrisons inside the app and adds {items.length} item{items.length === 1 ? '' : 's'} ({packs} pack{packs === 1 ? '' : 's'}). Sign in to Morrisons there if you like, then pick your slot and check out.</p>
      </div>
    );
  }
  if (installed) {
    return (
      <div className="card" style={{ marginTop: 12 }}>
        <button className="btn" onClick={() => { track('basket_fill_started', { items: items.length, packs }); window.open(url, '_blank', 'noopener'); }}>
          Checkout at Morrisons
        </button>
        <button className="linkbtn" onClick={() => setShop(true)}>Or Shop Item by Item</button>
        {shopping_ && <ShopMode shopping={shopping} have={have} onClose={() => setShop(false)} />}
        <p className="muted" style={{ margin: '8px 0 0' }}>Opens Morrisons and adds {items.length} item{items.length === 1 ? '' : 's'} ({packs} pack{packs === 1 ? '' : 's'}) for you. You pick the slot and check out.</p>
      </div>
    );
  }
  return (
    <div className="card" style={{ marginTop: 12 }}>
      <h3>Your Morrisons Shop</h3>
      <p className="muted" style={{ margin: '4px 0 10px' }}>We add your list to a Morrisons trolley for you, then you pick a slot and pay at Morrisons.</p>
      <button className="btn" onClick={() => setChoose(true)}>Checkout at Morrisons</button>
      {choose && createPortal(
        <div className="sheet-wrap" onClick={() => setChoose(false)}>
          <div className="sheet" role="dialog" aria-label="Check out at Morrisons" onClick={(e) => e.stopPropagation()}>
            <div className="grab" />
            <h2>Check Out at Morrisons</h2>
            <p className="muted">Morrisons doesn&apos;t let other apps fill a trolley, so we do it in your own browser. Pick what suits you.</p>
            <div className="opts">
              <Link className="opt" href="/app"><span className="opt-ico"><Smartphone size={20} aria-hidden /></span><span className="opt-txt"><b>Android App</b><span className="d">Fills your trolley in one tap. Best on your phone.</span></span></Link>
              <Link className="opt" href="/extension"><span className="opt-ico"><Monitor size={20} aria-hidden /></span><span className="opt-txt"><b>Chrome Add-on</b><span className="d">Fills your trolley from a computer.</span></span></Link>
              <button className="opt" onClick={() => { setChoose(false); setShop(true); }}><span className="opt-ico"><ListChecks size={20} aria-hidden /></span><span className="opt-txt"><b>Shop Item by Item</b><span className="d">Works anywhere. One tap per product.</span></span></button>
            </div>
            <button className="btn ghost" style={{ marginTop: 14 }} onClick={() => setChoose(false)}>Cancel</button>
          </div>
        </div>, document.body)}
      {shopping_ && <ShopMode shopping={shopping} have={have} onClose={() => setShop(false)} />}
    </div>
  );
}
