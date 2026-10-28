# Multi-store research: Tesco, Asda and others (28 Oct 2026)

Question: can we get prices (and fill trolleys) from Tesco and Asda, and if so how do we build it into pricing, checkout and product naming?

## Short answer

- **There is no official, public price or product API from Tesco, Asda, Sainsbury's, Ocado or Waitrose.** Everything on offer is third-party scraping or paid data feeds. (Searches 28 Oct; Tesco's old "Tesco Labs" developer API is from 2013 and I found no sign it is open today.)
- **We cannot read their pages from our own servers.** I tested from this Mac with an honest user agent: Tesco, Sainsbury's, Asda and Ocado all returned HTTP 403, even for Tesco's and Sainsbury's `robots.txt`. Morrisons returns 200, which is why our nightly price check works only for Morrisons.
- **In the person's own browser it does work**, because it is a normal browser session. That is how our trolley filling already works, so *checkout* is feasible for other stores; *price collection* needs a different route.
- **Recommended route:** (1) keep Morrisons as the reference store; (2) add a second store's prices from a paid data feed or actor used for prices only (cheap, see below), after Jack has taken legal advice on terms; (3) in parallel, apply to the retailers' affiliate programmes (Tesco is on Awin), which may give us a legitimate product feed, deep links and a revenue line; (4) build the product and pricing model for many stores first, because that work is needed whichever data route we pick and is where most of the effort is.

## What I verified myself (28 Oct, from this Mac, one or two polite requests each)

| Site | `robots.txt` | A page | Notes |
|---|---|---|---|
| groceries.morrisons.com | 200 | 200 | `/api/` disallowed; product pages and sitemap open. Our price check uses product pages. |
| www.ocado.com | 200 | 403 (product page) | Same layout of rules as Morrisons (`/api/` disallowed, sitemap index): consistent with the shared platform. Product pages and sitemaps are allowed in robots, but the page was blocked for our script. |
| groceries.asda.com | 200 | 403 (home) | Cloudflare-managed `robots.txt`: `Content-Signal: search=yes, ai-train=no, use=reference`, `Allow: /` for general crawlers; AI-training crawlers named and disallowed. |
| www.tesco.com | **403** | 403 | Blocked even for `robots.txt`. Vendors say Akamai Bot Manager. |
| www.sainsburys.co.uk | **403** | 403 | Same. |

Nothing here tried to get around a block, and nothing should: bypassing bot protection is the kind of thing that turns a grey area into a breach.

## Options for getting prices

| Option | Works for | Cost (vendor-stated, unverified) | Legal / risk | Verdict |
|---|---|---|---|---|
| **Official API / partnership** | none found | n/a | Cleanest | Ask each retailer (Tesco, Asda) for a data or partner route; low odds, high value. |
| **Affiliate programme product feeds** (Awin etc.) | Tesco (Awin, per Awin's own announcement); Asda unclear | free to join; we earn commission | Legitimate relationship; feeds usually carry price, EAN, deep link. Grocery coverage in feeds is **unverified** | **Do first, in parallel.** Also gives a revenue line for "checkout at Tesco". |
| **Paid scraping actors** (Apify: Tesco, Asda, Sainsbury's, Ocado, Waitrose; a cross-store matrix by EAN) | all | about $2–8 per 1,000 products | Scraping may breach the site's terms (contract) and, at scale, database right. Prices are facts and our volume is tiny (about 120 products a week), which lowers the risk but doesn't remove it. Vendors disclaim affiliation | **Pragmatic start for prices only.** Get legal advice; show prices as estimates with the date, as we do now. |
| **Commercial data vendors** (Actowiz, Jsonify and similar) | all | quote-based | Same terms question, but a contract and an SLA; some offer free samples | Worth a quote if actors prove flaky. |
| **Comparison sites** (Trolley.co.uk etc.) | all | no licence found | Their data is itself scraped; no stated licence | Not recommended. |
| **Crowdsourced** (Open Food Facts "Open Prices", ODbL licence, daily export) | any | free | Open licence but thin: about 125k prices worldwide | Not enough for weekly basket prices. |
| **Prices read in the user's own browser** (extension / Android WebView, while they shop) | any store they use | free | Acts on the person's behalf in their session, same posture as trolley filling; but prices are per delivery slot and per person, and it is slow (a page per product) | Good later for *confirming* prices at checkout, not for planning. |
| **Our own server scraping** | Morrisons only | free | Blocked elsewhere (403) | Not possible without bypassing protection. |

Cost of the paid route, for scale: about 120 products × 3 stores × weekly is well under $5 a month at the quoted rates.

## Legal notes (orientation only, not legal advice)

- No single UK law bans scraping. The risks are **breach of the site's terms** (contract), **database right** if you take a substantial part of the database (including by repeated small extractions), copyright in descriptions and photos, and data protection if personal data is involved.
- Fact-only collection (today's price for a product we already know) is lower risk than copying descriptions or images. We should **store only price, pack size, availability and our own mapping**, never their photos or text.
- Government statisticians scrape supermarket sites for food-price inflation (ONS), which shows the practice exists, but it is not a ruling on any retailer's terms.
- Action for Jack: read Tesco's and Asda's website terms for automated-access wording, and get a short legal opinion before relying on scraped prices in a paid product.

## Checkout in other stores

- **Same mechanism as Morrisons**: our script runs in the person's own browser or in the Android app's WebView, opens each product page and presses Add. Needs per store: the product URL or SKU per ingredient, selectors for Add / + / quantity, a handoff format, host permission in `extension/manifest.json`, and the Android WebView allow-list (currently Morrisons only).
- **Ocado** runs the same shop software as Morrisons (Morrisons has used Ocado's platform since 2014), so its adapter should be a small variation; the earlier note in `todo.md` already says this.
- **Tesco / Asda / Sainsbury's** use their own front ends. Each needs its own adapter and ongoing upkeep when the site changes. Expect Tesco's front end to be the most fragile.
- **Deep links / affiliate**: I could not confirm an add-to-basket URL for Tesco or Asda. If affiliate approval comes through, deep links to product pages are standard on Awin.
- Lidl and Aldi have no online grocery shop to fill, so only "price comparison" would apply, and I found no feed for them.

## Update: vendor options from Jack's research (`uk_supermarket_price_feeds_tldr.md`), checked against the vendors' own pages (28 Oct)

| Source | What I verified | What is still unknown |
|---|---|---|
| **Yappman free dataset** (data.yappman.com) | Daily 212-item basket, 4 UK supermarkets (Tesco, Sainsbury's, Asda, Aldi; Morrisons planned). Labelled **CC BY 4.0**, attribution "Yappman Data". Free monthly snapshot on Kaggle. | Field list and file format are not on the page. The licence covers their dataset, not rows from actor runs, and not retailer images or descriptions. |
| **Yappman paid datasets** | Daily basket from **£2,400/yr**, weekly catalogue from **£6,000/yr**, one-month free trial, per buyer entity. | Catalogue size and coverage; whether the licence covers customer-facing display and caching. |
| **Yappman Apify actor** (`yappman/uk-supermarket-price-scraper`) | Tesco, Sainsbury's, Asda, Aldi (Morrisons opt-in). Output per product per store: `ean` (nearly all Tesco and Sainsbury's, about 99% of Asda, none for Morrisons or Aldi), `matchKey`, `retailerProductId`, name, brand, pack size, price, **was price, loyalty (Clubcard/Nectar) price, promotion**, unit price, in stock, `scrapedAt`. **`POST /basket`** prices a list by EAN, name and pack size, or retailer product ID at **$0.002 per matched line per retailer**. Search mode **$2.50 per 1,000 products**. No postcode: Asda has a store id; Tesco and Sainsbury's are not store-specific. | Its README says plainly: "We make no claim that any retailer permits this use." Retailer terms are summarised as restricting automated access. |
| **Hobnight API** (hobnight.com) | Read-only JSON API with bearer key, OpenAPI 3.1, endpoints for products, **product history**, categories and **cross-shop matches**. Retailers listed: Tesco, ASDA, Ocado, Morrisons, Sainsbury's, Waitrose, Iceland; "250k+ UK grocery products". Keys issued **manually** after a use-case request. | Pricing, free trial, update frequency, fields (EAN, loyalty price, pack size), **how the data is obtained**, and the commercial-use and caching terms: none are stated publicly. |

**What this changes**
- **Cost is not the question.** Pricing our whole catalogue weekly through the actor's basket endpoint is about 120 lines × 3 stores × $0.002, roughly **$0.70 a week**. The paid datasets cost far more than the data we need.
- **The risk is unchanged in kind.** Every one of these is an intermediary that collects from the retailers' sites. Yappman says outright that it makes no claim retailers allow it. A paid licence gives us a contract with the vendor, not permission from Tesco. Only an affiliate feed or a retailer agreement is clean. The legal read of Tesco's terms still comes first.
- **Loyalty prices must be kept apart.** The actor returns shelf, was and Clubcard/Nectar prices. We should estimate from the **shelf price** and never mix in loyalty prices, so we don't undersell a store's real cost.
- **Matching is still ours to do.** EANs help for branded lines only (Morrisons publishes none). Own-brand equivalence ("Tesco Everyday Value mixed peppers" for "Morrisons Savers mixed peppers") needs our match-and-confirm tool whichever source we use. Hobnight's cross-shop matches may speed up branded lines.
- **Build source-agnostic.** The tool should read any of these as a normalised row (`store, productId, name, brand, packSize, price, unitPrice, ean?, scrapedAt`), so we can swap vendors without rework.
- **Store variation.** Asda has a store setting and prices may vary by store; Tesco and Sainsbury's are national in the actor. Note this in the UI as "estimated prices".

**Sequence I recommend:** (1) Jack requests a Hobnight key and sends both vendors a short licence question list (drafted below in the chat reply); (2) Jack downloads the free Yappman CSV and I measure how many of our ingredients it covers and sanity-check prices against Morrisons; (3) I build the source-agnostic match-and-confirm tool and pilot about 20 ingredients with a tiny paid run; (4) choose the source on licence wording and coverage, not price; (5) keep the Awin application going as the long-term clean route.

## What has to change in our code (store-neutral model)

Today everything is Morrisons-shaped: `content/ingredients.json` has one `product` per ingredient, recipe cost and tier are computed at import from Morrisons prices, and the shopping list shows the Morrisons product name.

1. **Catalogue**: `ingredient_products(store, ingredient, sku, slug, name, pack_size, unit, price_pence, status, checked_at)`, as sketched in `todo.md`. Prices file becomes per store (`content/prices.<store>.json`). `PRODUCTS` becomes a lookup by (store, ingredient).
2. **Matching**: own-brand lines have no cross-store equivalent (Morrisons Savers vs Tesco Everyday Value), so mapping is by *role* ("British chicken breast fillets, about 1 kg"), not by barcode. Plan: a search-and-confirm tool per store that proposes candidates by name, size and unit price, and a human confirms. About 83 mapped products plus cupboard items per store. EAN helps for branded lines only (Sainsbury's exposes it; Ocado does not).
3. **Product naming**: split the *ingredient name* (neutral, used in recipes and the cooking sheet, for example "Chicken breast fillets") from the *product name* (store specific, used on the shopping list and in checkout, for example "Tesco British Chicken Breast Fillets 1kg"). Right now recipe sheets show `PRODUCTS[k].n` including the "Morrisons" prefix. Needs a `display_name` per ingredient (can be generated by stripping brand and size, then reviewed).
4. **Pack maths**: packs needed, leftovers and waste use `pack` and `unit` per store, so a different pack size changes the cost even at the same unit price. Already generic in `buildShopping`; it just needs the store passed in.
5. **Price consideration in the planner**: spend tiers use `recipe.cost`, precomputed from Morrisons. Make cost a runtime function `costPerPortion(recipe, store)` over the store's prices, and keep the tier limits per course. The planner still picks meals store-neutrally (using a reference store or a cheapest-of basket) so plans don't change when someone switches store; only the totals and the list change.
6. **Choosing a store**: onboarding or Account setting (default Morrisons), plus a Plan screen line such as "£56.57 at Morrisons · £53.10 at Tesco" once we have two stores' prices. Price comparison is a selling point; display it as an estimate with the check date per store.
7. **Checkout**: the "Checkout With Morrisons" button becomes "Checkout With {store}" and calls that store's adapter. Package the adapters behind one interface (`items → fill → report`) as the Morrisons script already reports back results.
8. **Freshness**: each store has its own "checked" date, and the same staleness rules apply per store. The weekly refresh job needs one source per store.
9. **Data model note**: the profile is stored as JSON, and `store` is a new top-level preference, so no migration is needed for the user side; the catalogue tables are new.

## Suggested phases

1. **Foundations (no external dependency)**: neutral ingredient names; per-store catalogue and prices file with Morrisons migrated into it; runtime cost; store preference and "Checkout With {store}" wiring. Still one store live.
2. **Second store**: pick the cheapest reliable source (affiliate feed if approved, otherwise a paid actor for prices only). Build the match-and-confirm tool, map the catalogue, show comparison totals.
3. **Checkout adapters**: Ocado first (same platform), then Tesco or Asda in the extension and Android WebView.
4. **Third store and polish**: Sainsbury's/Waitrose if wanted; per-person price confirmation at checkout.

## Decisions needed from Jack

1. Which second store first (Tesco has the biggest share and an Awin programme; Asda is the cheapest-for-shoppers story; Ocado is the easiest build).
2. OK to apply for the Tesco and Asda affiliate programmes, and to ask each retailer about a data route?
3. OK to budget a few dollars a month for a paid price source, subject to a legal read of the terms?
4. Is a "compare stores" total on the Plan screen part of the launch story, or is store choice enough at first?

## Sources

- Tesco scrapers and bot-protection notes: [ScrapingBee Tesco](https://www.scrapingbee.com/scrapers/tesco-api/), [Apify Tesco (studio-amba)](https://apify.com/studio-amba/tesco-scraper), [Apify Tesco IE](https://apify.com/studio-amba/tesco-ie-scraper). Old Tesco Labs API: [The Grocer](https://thegrocer.co.uk/news/tesco-gives-app-developers-access-to-product-information/544428.article).
- Asda: [Apify Asda (studio-amba)](https://apify.com/studio-amba/asda-scraper), [Apify Asda (solidcode)](https://apify.com/solidcode/asda-scraper); vendor feeds: [Actowiz Asda](https://www.actowizsolutions.com/asda-grocery-products-data-extraction.php).
- Cross-store: [UK Grocery Price Matrix](https://apify.com/studio-amba/uk-grocery-price-matrix), [Trolley scraper](https://apify.com/studio-amba/trolley-scraper), [Ocado scraper](https://apify.com/studio-amba/ocado-scraper), [Sainsbury's scraper](https://apify.com/studio-amba/sainsburys-scraper/api), [Waitrose scraper](https://apify.com/studio-amba/waitrose-scraper/api).
- Affiliate: [Awin on Tesco](https://www.awin.com/au/news-and-events/awin-news/tesco-partner-exclusively-with-awin), [Awin deep links](https://success.awin.com/articles/en_US/Knowledge/What-is-deep-linking-and-why-should-I-use-this).
- Open Prices: [wiki](https://wiki.openfoodfacts.org/Prices), [data.gouv.fr](https://www.data.gouv.fr/datasets/open-prices).
- Legal orientation: [Sprintlaw: scraping in the UK](https://sprintlaw.co.uk/articles/is-web-scraping-legal-in-the-uk/), [webscraping.fyi UK](https://webscraping.fyi/legal/UK/), [ONS: Better Scraping, Better Statistics](https://analysisfunction.civilservice.gov.uk/wp-content/uploads/2018/01/Better-Scraping-Better-Statistics-1.pdf).
- Ocado and Morrisons: [Wikipedia: Ocado](https://en.wikipedia.org/wiki/Ocado).

Vendor pages are marketing: their coverage and price claims are unverified. The 403 results above are from my own requests on 28 Oct 2026.
