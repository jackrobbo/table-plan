import type { StoreId } from '../stores';

/**
 * One product from any price source (Yappman, Hobnight, a hand-made file), in one shape. Sources are normalised into this by
 * sources.ts, so the matcher never cares where a row came from. Prices are SHELF prices in pence: loyalty prices are ignored.
 */
export interface SourceRow {
  store: StoreId;
  /** The store's own product id: what the trolley adapter and price checks use. */
  productId: string;
  name: string;
  brand?: string;
  /** As the source gives it: "1kg", "6 pack", "4 x 145g", "each". */
  packSize?: string;
  price: number;
  /** Pence per 100 g / 100 ml / each, when the source gives it. */
  unitPence?: number;
  ean?: string;
  url?: string;
  inStock?: boolean | null;
  /** ISO time the price was read. */
  scrapedAt?: string;
}

/** A pack in the units we need: weight, volume and/or a count. Any may be missing. */
export interface Pack { grams?: number; ml?: number; count?: number }

export interface Suggestion {
  row: SourceRow;
  /** 0 to 100: how closely it looks like the Morrisons product we use for this ingredient. */
  score: number;
  /** Share of the ingredient's name words found in the product's name (0..1). The name gates everything else. */
  nameMatch: number;
  /** "high" is clear enough to pre-select; a person still confirms every one. */
  confidence: 'high' | 'medium' | 'low';
  /** Pack size in the ingredient's own unit (g, ml or its count), which is what `pack_size` must be. */
  packInUnit: number | null;
  reasons: string[];
  warnings: string[];
}

export type DecisionStatus = 'confirmed' | 'no_equivalent' | 'skipped';
export interface Decision { status: DecisionStatus; row?: SourceRow; note?: string; decidedAt: string }
