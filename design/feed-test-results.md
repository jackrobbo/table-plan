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

## Stage 2 done (7 Nov 2026): price tables in Supabase
Migration `supabase/migrations/0009_price_feed.sql`, applied to project `dyaztrnlrmhcyrbctsbs`:
`price_runs`, `store_products`, `store_prices` (history, rows can be held), view `latest_prices`, `recipe_costs`. RLS on, no policies, grants to `anon` and `authenticated` revoked: only the server's service role can read or write, because the vendor licence allows display but not bulk redistribution.

Loaded from the full run above with `npm run feed:sql` (writes three SQL files in `content/feed/`, no secrets, no network) and applied in order:
- 1 run, 206 price rows (sum 39,638p, identical to the local snapshot), 0 held, 5 out of stock, 23 with a promotion.
- 206 store products: 120 Morrisons (our mapping) and 86 Tesco (confirmed matches). 0 mapped products without a price.
- 288 recipe costs at Morrisons, all complete. Cost uses the regular (was) price when a simple offer is running, so a one-week promotion does not swing a recipe's cost. Tiers: 82 low, 105 medium, 101 high.

The app does not read these tables yet; it still uses the bundled data. Wiring it (a server route that returns the signed-in person's store prices and costs, and the planner using them) is the next step.

### Tesco matches to revisit when the review resumes
The load showed some confirmed Tesco matches that are not like for like:
- `mission`: Tesco Mission **Original** wraps, but our product is Mission **Protein** wraps (different nutrition).
- `grenade`: a single 35 g bar, ours is a 4 x 60 g pack of a different bar size.
- `porkmince`: 10% fat, ours is 5% fat. `lambmince` 10% fat.
- `loaf`: a 400 g loaf against our 800 g one. `bagels`: thin bagels against plain.
- `chilliflakes`: chipotle flakes, ours are plain chilli flakes.
- Packs without a parseable size (eggs, wraps, bananas, naan, garlic): the count is in the product name.

## Stage 3 built (7 Nov 2026): the weekly job
Code: `src/lib/server/feed.ts` (logic, tested in `tests/priceFeedJob.test.ts`), `/api/cron/price-feed` (Vercel cron, Mondays 05:00 UTC, `vercel.json`), `/api/feed/ingest` (Apify webhook back to us).
Flow: cron records a run per store (Morrisons, Tesco) and asks Apify to price the exact product pages; Apify calls the webhook when done; we check the rows, store them (price moves over 50% are held, never served), recompute every Morrisons meal cost from `src/data/costing.json`, and close the run. If under 80% of products come back, or Apify fails, the run is marked failed and the app keeps serving the previous snapshot.

Setup before it can run (Jack, in Vercel > table-plan-app > Settings > Environment Variables, Production):
1. `CRON_SECRET`: any long random string. Vercel sends it to the cron route.
2. `FEED_SECRET`: another long random string. Apify sends it back to the webhook.
3. `APIFY_TOKEN`: from Apify Console > Settings > API & Integrations.
4. `SUPABASE_SERVICE_ROLE_KEY` should already be set (used by `/api/prices`).
Then redeploy. To test without waiting for Monday, call the cron route once by hand with the CRON_SECRET (costs about $0.50).
`.github/workflows/prices.yml` is manual-only (Morrisons blocks GitHub), so it is left as a fallback.

## First live run of the weekly job (7 Nov 2026, 18:00 UTC): passed
Triggered by hand from Vercel (Settings > Observability > Schedules > Cron Jobs > row menu > Run). Morrisons 120 of 120 and Tesco 86 of 86 came back, 0 held, 206 price rows and 288 Morrisons recipe costs written by the new run.
Two things the first attempt (17:50) taught us, both fixed in `7d0d874`:
- Apify marked the runs "Failed" even though they pushed every row (exit code 0). The ingest now reads any run that has a dataset and lets the coverage check decide.
- The secret header is trimmed on both sides (`pbcopy` adds a trailing newline).
Four test runs from that attempt were closed as failed in `price_runs`. Real cost of a full two-store run: about $0.53 (Morrisons $0.31, Tesco $0.22). Runs take 2 to 4 minutes.
