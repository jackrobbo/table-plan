'use client';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { money } from '@/components/week';
import { byAisle, type Shopping } from '@/lib/planner/shopping';

/**
 * "Shop item by item": for phones, where nothing can add to the Morrisons trolley for you. One item at a time in aisle order, a big
 * button that opens it at Morrisons, then one tap to move on. A tap or two per item instead of hunting through the list.
 */
export default function ShopMode({ shopping, have, onClose, onFinish }: { shopping: Shopping; have: string[]; onClose: () => void; onFinish?: () => void }) {
  const lines = byAisle(shopping.lines.filter((l) => !have.includes(l.key) && l.slug)).flatMap((g) => g.lines);
  const [i, setI] = useState(0);
  const l = lines[i];
  // Reaching the end of the list counts as having done the shop.
  useEffect(() => { if (!l && lines.length > 0) onFinish?.(); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!l]);
  const pct = lines.length ? Math.round((Math.min(i, lines.length) / lines.length) * 100) : 100;
  return createPortal(
    <div className="sheet-wrap" onClick={onClose}>
      <div className="sheet" role="dialog" aria-label="Shop item by item" onClick={(e) => e.stopPropagation()}>
        <div className="grab" />
        <div className="avgtrack" role="progressbar" aria-valuemin={0} aria-valuemax={lines.length} aria-valuenow={Math.min(i, lines.length)}><i className="ok" style={{ width: `${pct}%` }} /></div>
        {l ? (<>
          <p className="muted" style={{ margin: '10px 0 0' }}>{i + 1} of {lines.length} · {l.category}</p>
          <h2 style={{ margin: '4px 0' }}>{l.name}{l.packs > 1 ? ` ×${l.packs}` : ''}</h2>
          <p className="muted" style={{ margin: 0 }}>≈ {money(l.costPence)} · for {l.usedBy.slice(0, 3).join(', ')}</p>
          <p className="muted" style={{ margin: '14px 0 8px' }}>Add {l.packs > 1 ? `${l.packs} of these` : 'it'} to your trolley at Morrisons, then come back here.</p>
        </>) : (<>
          <h2>That&apos;s the List</h2>
          <p className="muted">Open your Morrisons trolley to check it, choose a delivery slot and pay. Anything you skipped is still on your list.</p>
        </>)}
        <div className="sheet-foot">
          {l ? (<>
            <a className="btn" href={`https://groceries.morrisons.com/products/${l.slug}`} target="_blank" rel="noopener noreferrer">Open at Morrisons ↗</a>
            <button className="btn ghost" onClick={() => setI(i + 1)}>Added It, Next</button>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <button className="linkbtn" disabled={i === 0} onClick={() => setI(i - 1)}>Back</button>
              <button className="linkbtn" onClick={() => setI(i + 1)}>Skip This One</button>
            </div>
          </>) : <a className="btn" href="https://groceries.morrisons.com/" target="_blank" rel="noopener noreferrer">Open Morrisons ↗</a>}
          <button className="linkbtn" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
