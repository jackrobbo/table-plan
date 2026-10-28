'use client';
import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import BasketButton from '@/components/BasketButton';
import PriceNote from '@/components/PriceNote';
import { ShoppingList } from '@/components/week';
import type { Shopping } from '@/lib/planner/shopping';

/** What the person has chosen to buy from the store cupboard, and what that adds to the shop. */
export const cupboardPence = (s: Shopping, want: readonly string[]) =>
  (s.cupboardItems ?? []).filter((c) => want.includes(c.key)).reduce((a, c) => a + (c.pricePence ?? 0), 0);

/** The shopping-list screen, shared by this week's list and the "plan next week" flow so they look and behave the same. */
export function ListStepBody({ shopping, have, onToggle, want, onToggleCupboard, onCheckedOut }: {
  shopping: Shopping; have: string[]; onToggle: (key: string) => void; want: string[]; onToggleCupboard: (key: string) => void; onCheckedOut?: () => void;
}) {
  const toBuy = shopping.lines.filter((l) => !have.includes(l.key));
  const total = toBuy.reduce((a, l) => a + l.costPence, 0) + cupboardPence(shopping, want);
  return (
    <>
      <PriceNote totalPence={total} />
      <ol className="nextsteps" aria-label="What to do next">
        <li><span className="n">1</span><span><b>Untick What You Already Have</b><small>Ticked items go into your trolley.</small></span></li>
        <li><span className="n">2</span><span><b>Check Your Total</b><small>{toBuy.length} item{toBuy.length === 1 ? '' : 's'} ticked. The total above updates as you untick.</small></span></li>
        <li><span className="n">3</span><span><b>Tap Checkout With Morrisons</b><small>Opens Morrisons and fills your trolley. Or copy the list to Notes.</small></span></li>
      </ol>
      <ShoppingList shopping={shopping} have={have} onToggle={onToggle} want={want} onToggleCupboard={onToggleCupboard} />
      <BasketButton shopping={shopping} have={have} onDone={onCheckedOut} />
    </>
  );
}

/** The pinned pair under the list: quiet copy on the left, the main checkout on the right. `onCheckout` lets a flow save first. */
export function CheckoutBar({ onCopy, copied, onCheckout }: { onCopy: () => void; copied: boolean; onCheckout?: () => void }) {
  return (
    <div className="ctarow">
      <button className="btn ghost" onClick={onCopy}>{copied ? 'Copied' : 'Copy to Notes'}</button>
      <button className="btn glare" onClick={onCheckout ?? (() => window.dispatchEvent(new Event('tp:checkout')))}>Checkout With Morrisons</button>
    </div>
  );
}

/** The shopping list as the checkout overlay: opens over the plan, with the copy / checkout pair pinned at the bottom. */
export function CheckoutSheet({ onClose, footer, children }: { onClose: () => void; footer: ReactNode; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return createPortal(
    <div className="sheet-wrap" onClick={onClose}>
      <div className="sheet checkout-sheet" role="dialog" aria-modal="true" aria-label="Shopping list and checkout" onClick={(e) => e.stopPropagation()}>
        <div className="grab" />
        <div className="cs-head"><h2>Shopping List</h2><button className="cs-x" onClick={onClose} aria-label="Close"><X size={18} aria-hidden /></button></div>
        {children}
        <div className="sheet-foot">{footer}</div>
      </div>
    </div>,
    document.body,
  );
}
