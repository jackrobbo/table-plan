# Yappman feed test, 7 Nov 2026 (stage 1, dry run)

Script: `npm run feed` (`scripts/yappman-feed.ts`). Local only: nothing touched the app or the database. Snapshots and the report are in `content/feed/` (gitignored).

## What was run
1. Probe: 3 Morrisons and 3 Tesco products (about 3 cents).
2. Full run: 120 Morrisons products (the product pages we map) and 86 Tesco products (the matches Jack confirmed), product mode, one call per store. At most $0.53 on the Apify free plan (rates: $0.005 per run, $0.0025 per product row).

## Results
| Store | Asked for | Came back | Coverage |
|---|---|---|---|
| Morrisons | 120 | 120 | 100% |
| Tesco | 86 | 86 | 100% |
| Sainsbury's, Asda | none confirmed yet | n/a | n/a |

Errors 0. Warnings 7.

- **Prices are live, not a weekly snapshot.** Every row carried a timestamp from the minutes of the run (14:19 to 14:22 on 7 Nov), unlike the basket endpoint, which answers from a weekly snapshot.
- **Morrisons agrees with our catalogue.** 108 of 120 prices were identical to what we hold (last checked around 25 Oct). 12 differed by a few pence, plus two promotions (Mission wraps now £1.60, was £1.80; a bundle offer on the vegetable medley). Cranberry sauce showed a regular price of £1.95 against 146p, which was a loyalty price recorded by mistake when the product was added; the catalogue is now corrected to £1.95. The feed caught it.
- **Tesco:** 86 of 86 returned. 14 of the 86 prices had moved since we confirmed them on 5 Nov (mostly 5 to 10p; tuna 63p to 80p, a 27% move, flagged). **Five products were out of stock:** prawns, apple, chopped tomatoes, rice and curry. This is real information the app does not have today.
- **Promotions come through** (promo text, was price, loyalty price): 11 of the Morrisons rows and 13 of the Tesco rows carried one.
- **Stability:** a dry run on saved basket answers showed the basket endpoint matching by name can return a different product (halloumi became halloumi fries). The feed therefore asks for each confirmed product by its page address, and returned exactly the products asked for.

## What the checks do
Per store: coverage, duplicates, missing or impossible prices, price moves over 50% (held for review, over 15% warned), pack-size changes, out of stock, and vendor prices older than 8 days. These are unit tested (`tests/yappmanFeed.test.ts`).

## Not yet known
- Sainsbury's and Asda: no confirmed matches and no known product page address pattern (Tesco's is built from the id). Needs the matching review first.
- Behaviour over several weeks (how often products vanish or change size).
- Real cost over a month and the effect when the catalogue grows to about 200 products.
- The retailer terms and the licence (display and about a week's caching, no resale) are unchanged and still for Jack and a solicitor.

## Next (stage 2, needs Jack's go-ahead before touching Supabase)
Price tables with an `as_of` date and a run record, the import writing each run into them, per-store recipe cost and tier recalculated from the latest prices. See `design/architecture.md` section 6.
