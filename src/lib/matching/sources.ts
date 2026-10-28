import type { StoreId } from '../stores';
import type { SourceRow } from './types';

export type SourceKind = 'yappman' | 'hobnight' | 'generic';

/** A small CSV reader (quotes, commas and newlines inside quotes) into one object per line, keyed by the header. */
export function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; }
    else if (c === '"') q = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cell); if (row.some((x) => x !== '')) rows.push(row); row = []; cell = ''; }
    else cell += c;
  }
  if (cell !== '' || row.length) { row.push(cell); if (row.some((x) => x !== '')) rows.push(row); }
  const [head, ...body] = rows;
  return head ? body.map((r) => Object.fromEntries(head.map((h, k) => [h.trim(), r[k] ?? '']))) : [];
}

const get = (o: Record<string, unknown>, keys: string[]): unknown => { for (const k of keys) { const v = o[k]; if (v !== undefined && v !== null && v !== '') return v; } return undefined; };
const str = (v: unknown) => (v == null ? undefined : String(v).trim() || undefined);
const bool = (v: unknown): boolean | null => (v === true || v === 'true' || v === 'True' || v === '1' || v === 1 ? true : v === false || v === 'false' || v === 'False' || v === '0' || v === 0 ? false : null);

/** Column names each source is known (or likely) to use. `map` overrides them: { productId: 'external_id', ... }. */
const ALIASES: Record<keyof Omit<SourceRow, 'store'>, string[]> = {
  productId: ['retailerProductId', 'productId', 'product_id', 'external_id', 'externalId', 'id', 'sku', 'tpnb'],
  name: ['name', 'title', 'product_name', 'productName'],
  brand: ['brand', 'brand_name'],
  packSize: ['packSize', 'pack_size', 'size', 'weight', 'pack'],
  price: ['price', 'currentPrice', 'current_price', 'price_gbp', 'shelfPrice'],
  unitPence: ['unitPrice', 'unit_price', 'unitPence', 'price_per_unit'],
  ean: ['ean', 'gtin', 'barcode', 'ean13'],
  url: ['url', 'link', 'product_url'],
  inStock: ['inStock', 'in_stock', 'available', 'availability'],
  scrapedAt: ['scrapedAt', 'scraped_at', 'updated_at', 'observed_at', 'last_seen', 'timestamp'],
};

const RETAILER_KEYS = ['retailer', 'store', 'supermarket', 'shop', 'retailer_slug', 'supermarket_slug'];
const retailerOf = (v: unknown): string => String(v ?? '').toLowerCase().replace(/[^a-z]/g, '');

/** "£1.20/100g", "1.2", 120 -> pence per 100 g/ml (best effort); undefined if it can't be read. */
function unitPence(v: unknown, priceUnit: 'pounds' | 'pence'): number | undefined {
  if (v == null || v === '') return undefined;
  const m = String(v).replace(',', '.').match(/(\d+(?:\.\d+)?)\s*(p)?/);
  if (!m) return undefined;
  const n = Number(m[1]);
  const isPence = !!m[2] || /\bp\b|pence/i.test(String(v));
  return Math.round(isPence ? n : priceUnit === 'pounds' ? n * 100 : n);
}

export interface NormaliseOptions {
  store: StoreId;
  source?: SourceKind;
  /** Whether numeric prices are in pounds (the usual) or pence. */
  priceUnit?: 'pounds' | 'pence';
  /** Column overrides for a source whose names differ: { productId: 'external_id' }. */
  map?: Partial<Record<keyof Omit<SourceRow, 'store'>, string>>;
}

/**
 * Turns rows from a vendor file into SourceRows for one store. Skips rows for other retailers (when the file says which), rows with
 * no id, name or usable price, and uses the SHELF price only: wasPrice, loyalty and promotion prices are ignored on purpose.
 */
export function normaliseRows(raw: Record<string, unknown>[], opts: NormaliseOptions): SourceRow[] {
  const pu = opts.priceUnit ?? 'pounds';
  const out: SourceRow[] = [];
  for (const o of raw) {
    const retailer = get(o, RETAILER_KEYS);
    if (retailer !== undefined && retailerOf(retailer) !== opts.store && !retailerOf(retailer).startsWith(opts.store)) continue;
    const pick = (k: keyof typeof ALIASES) => get(o, opts.map?.[k] ? [opts.map[k]!, ...ALIASES[k]] : ALIASES[k]);
    const id = str(pick('productId')), name = str(pick('name'));
    const p = Number(String(pick('price') ?? '').replace(/[£,]/g, ''));
    if (!id || !name || !Number.isFinite(p) || p <= 0) continue;
    out.push({
      store: opts.store, productId: id, name, brand: str(pick('brand')), packSize: str(pick('packSize')),
      price: Math.round(pu === 'pounds' ? p * 100 : p), unitPence: unitPence(pick('unitPence'), pu),
      ean: str(pick('ean')), url: str(pick('url')), inStock: bool(pick('inStock')), scrapedAt: str(pick('scrapedAt')),
    });
  }
  return out;
}
