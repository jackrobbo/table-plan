import type { Shopping } from '@/lib/planner/shopping';

/** Morrisons' own limit on the quantity box. */
export const MAX_PACKS = 36;
const BASE = 'https://groceries.morrisons.com/products/';
const PRODUCT_PATH = /^[a-z0-9][a-z0-9-]*\/\d+$/i;

export interface BasketItem { s: string; q: number; n: string }

/** What the browser extension should add: every line still ticked as "to buy". */
export function basketItems(shopping: Shopping, have: readonly string[] = []): BasketItem[] {
  return shopping.lines
    .filter((l) => !have.includes(l.key) && PRODUCT_PATH.test(l.slug))
    .map((l) => ({ s: l.slug, q: Math.max(1, Math.min(MAX_PACKS, l.packs)), n: l.name }));
}

const b64url = (s: string) => btoa(String.fromCharCode(...new TextEncoder().encode(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

/** A Morrisons product page that carries the list in its fragment (never sent to a server). The extension picks it up from there. */
export function basketUrl(items: BasketItem[]): string | null {
  if (!items.length) return null;
  return `${BASE}${items[0].s}#tableplan=${b64url(JSON.stringify({ v: 1, items }))}`;
}

/** The extension leaves this marker on our pages (extension/tableplan.js). */
export const extensionInstalled = (): boolean => typeof document !== 'undefined' && !!document.documentElement.dataset.tableplanExt;
