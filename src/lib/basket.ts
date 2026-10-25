import type { ShopLine, Shopping } from '@/lib/planner/shopping';

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

export interface FillResult { s: string; n?: string; q?: number; status: string; got?: number; note?: string }
/** What the app reports when the person leaves the Morrisons screen. Empty `results` if they left before anything ran. */
export interface FillReport { state?: string; total?: number; results?: FillResult[] }
interface MorrisonsPlugin { open(opts: { items: BasketItem[] }): Promise<FillReport> }
/** Inside the Android app, a native Morrisons screen does the adding (android-app/). Absent in a normal browser. */
export function nativeMorrisons(): MorrisonsPlugin | null {
  if (typeof window === 'undefined') return null;
  const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean; Plugins?: { Morrisons?: MorrisonsPlugin } } }).Capacitor;
  return cap?.isNativePlatform?.() && cap.Plugins?.Morrisons ? cap.Plugins.Morrisons : null;
}

const isIn = (r: FillResult) => r.status === 'added' || r.status === 'already';

/** Splits the shopping list by what the run got into the trolley and what the person still has to add. */
export function fillOutcome(shopping: Shopping, have: readonly string[], report: FillReport): { added: ShopLine[]; todo: { line: ShopLine; note: string }[] } {
  const bySku = new Map((report.results ?? []).map((r) => [r.s, r]));
  const added: ShopLine[] = [], todo: { line: ShopLine; note: string }[] = [];
  for (const l of shopping.lines) {
    if (have.includes(l.key) || !PRODUCT_PATH.test(l.slug)) continue;
    const r = bySku.get(l.slug);
    if (r && isIn(r)) added.push(l);
    else todo.push({ line: l, note: !r ? 'Not tried' : r.status === 'partial' ? `Only ${r.got ?? 0} of ${l.packs} added` : r.note || 'Could not be added' });
  }
  return { added, todo };
}

const FILL_KEY = 'tp_fill';
const FILL_MAX_AGE = 3 * 864e5;
export function saveFill(report: FillReport, now = Date.now()): void {
  try { localStorage.setItem(FILL_KEY, JSON.stringify({ at: now, report })); } catch { /* private mode */ }
}
export function loadFill(now = Date.now()): FillReport | null {
  try {
    const v = JSON.parse(localStorage.getItem(FILL_KEY) || 'null') as { at: number; report: FillReport } | null;
    return v && now - v.at < FILL_MAX_AGE && v.report?.results?.length ? v.report : null;
  } catch { return null; }
}
export function clearFill(): void { try { localStorage.removeItem(FILL_KEY); } catch { /* ignore */ } }
