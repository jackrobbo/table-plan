export type Availability = 'in_stock' | 'out_of_stock' | 'unknown';

export interface ParsedProduct {
  sku: string | null;
  name: string | null;
  pricePence: number;
  availability: Availability;
}

/** Pulls the schema.org Product out of a product page's JSON-LD. Returns null if there isn't one. */
export function parseProductPage(html: string): ParsedProduct | null {
  const re = /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi;
  for (let m; (m = re.exec(html)); ) {
    let data: unknown;
    try { data = JSON.parse(m[1]); } catch { continue; }
    for (const node of Array.isArray(data) ? data : [data]) {
      const d = node as Record<string, any>;
      if (d?.['@type'] !== 'Product') continue;
      const offer = Array.isArray(d.offers) ? d.offers[0] : d.offers;
      const price = Number(offer?.price);
      if (!offer || !Number.isFinite(price)) continue;
      const avail = String(offer.availability ?? '');
      return {
        sku: d.sku ? String(d.sku) : null,
        name: d.name ? String(d.name).replace(/\s+/g, ' ').trim() : null,
        pricePence: Math.round(price * 100),
        availability: /InStock/i.test(avail) ? 'in_stock' : /OutOfStock|Discontinued|SoldOut/i.test(avail) ? 'out_of_stock' : 'unknown',
      };
    }
  }
  return null;
}
