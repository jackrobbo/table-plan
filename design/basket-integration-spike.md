# Spike: supermarket basket integration (v0.1 research, 24 Oct 2026)

Two separate questions from the UX-flow review.

## Q1 — Can we scrape ingredient prices/availability Monday morning for the week ahead?
**Yes, with the usual caveats — it's the pricing pipeline, timed to the weekly cycle.**
- Morrisons groceries runs on the **Ocado Smart Platform**; the site's product data comes from an **undocumented product endpoint** the website itself uses (the same one third-party scrapers hit). There is **no official public API** — Morrisons has said its APIs are "for our own apps only."
- Scope is bounded: we only price the SKUs in the recipe bank's ingredient→product map (~50 now → a few hundred at 150 recipes), not the whole catalogue. Cacheable and cheap.
- Cadence: nightly SKU-health baseline + an on-demand refresh when the Monday planning window opens. Each SKU carries a `last_checked` timestamp → drives the "≈ dated" honesty UI.
- Lessons already banked on our single-household prototype: JSON-LD `offers.price` is the reliable price field; delistings vanish silently (must detect). These port straight over.
- **Risk:** undocumented endpoint, fragile, ToS-grey. Mitigate with low volume, heavy caching, honest staleness. Never present as live.

## Q2 — How do we move a user's shopping list to an actual checkout?
**No self-serve/official path exists for Morrisons. Every real-world example uses either a partnership or a browser extension / unofficial session calls.**

Market scan:
- **Cherrypick** (Sainsbury's) — formal partnership for products + fulfilment; ingredients auto-added then a delivery slot booked with a partner retailer.
- **Whisk / Samsung** — added Sainsbury's via a partner network.
- **Remy** — auto-fills Tesco/Sainsbury's baskets (mechanism undocumented; likely extension/unofficial).
- **BBC GoodFood + Tesco + Foodity** (2013) and **Tesco + MyDish** (2010) — one-click add-to-basket, via retailer partnership; current status unclear.
- **"Bean Basket Assist"** — a Chrome extension that assists basket-filling → confirms the extension route is real.
- No current official Tesco/Morrisons developer/basket API (Tesco's 2009–10 trial is dead).

What we already have as a proof: on our single-household prototype we **populate a signed-in user's Morrisons account list** (product-page modal) and the list page has an **"Add all" → basket** button. So **list → basket is one tap IF the list is populated in that user's own session.** The unsolved product problem is populating it for arbitrary users without holding their credentials → needs an extension (acts in their session) or an official import/partner feed.

### Options matrix (Morrisons, best-to-worst for MVP)
| Path | Populates basket? | Needs | MVP? |
|---|---|---|---|
| Save-to-Notes / export + "≈" per-store estimates | No (manual) | Nothing | ✅ ship this |
| **Affiliate link** (Morrisons CPA ~4.6–5.5% on orders >£40, new-customer, rechecked monthly) | No | Affiliate signup (FlexOffers/Awin) | ✅ revenue, no basket control |
| Browser extension (fills user's own Morrisons list → "Add all") | Yes | Build + maintain extension, per-retailer | 🔜 fast-follow / power-user |
| Retailer partnership / feed (the Cherrypick route) | Yes | BD deal | ❌ Phase 3 |
| Unofficial gateway calls server-side | Yes | User creds / fragile / ToS breach | ❌ avoid |

## Recommendation
1. **MVP checkout = Save-to-Notes/export + "≈" per-store estimates.** Nothing is blocked on integration.
2. **Add affiliate links** as a second revenue line (doesn't need basket control).
3. **Fast-follow: a browser extension** that generalises the prototype's proven "populate list → Add all" flow — the realistic self-serve basket path before any partnership.
4. **Phase 3: retailer partnership** for true in-app basket + fulfilment (also fixes the incentive-alignment story vs Cherrypick).
5. Keep pricing (Q1) on the OSP endpoint with caching + honesty UI; treat the endpoint as liable to change.

Sources: Apify Morrisons scraper notes (OSP + undocumented product endpoint); Awin/FlexOffers Morrisons grocery affiliate listings; The Grocer / FoodNavigator on Cherrypick; Whisk/Samsung Sainsbury's announcement; Remy (The Grocer); BBC GoodFood+Tesco+Foodity; Tesco+MyDish; Bean Basket Assist extension.
