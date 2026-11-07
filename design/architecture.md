# Table Plan: how it is held together (for a backend review)

Written 7 Nov 2026 from the repository and `design/handoff.md` / `design/master-list.md`. Where I have not verified something in the running system I say so.

## 1. The shape in one paragraph
A Next.js 15 (App Router) PWA on Vercel. The **recipes, ingredients and prices are files in the repo** (`content/`), compiled at build time into static JSON (`src/data/`) that the planner and UI read. The **database (Supabase Postgres)** holds users' profiles, weekly plans, subscriptions, consent and rate limits, not the recipe catalogue at runtime. A **planner** (pure TypeScript, no server) turns a person's goals and liked meals into a week; a **shopping builder** turns the week into whole packs of Morrisons products; a **Chrome extension / Android screen** fills the person's own Morrisons basket by pressing buttons on their own logged-in page. Stripe billing is built but mocked during a free beta.

```
 recipe sites ──(read by us, own wording)──▶ content/recipes/*.json ─┐
 CoFID dataset + Morrisons pack labels ───▶ content/ingredients.json ─┤  npm run content:import
 Morrisons product pages (price check) ───▶ content/prices.json ──────┤  (validates, computes macros / cost /
 other stores (Yappman search + review) ──▶ content/matches/ (local) ─┘   allergens, live recipes only)
                                                                         │
                         ┌───────────────────────────────────────────────┴──────────────┐
                         ▼                                                              ▼
                  src/data/*.json (bundled in the app)                        supabase/seed.sql (idempotent)
                         │
   browser ──▶ Next.js on Vercel ──▶ planner (src/lib/planner) ─▶ plan ─▶ shopping list (whole packs)
      │               │                                                         │
      │               └──▶ Supabase (auth OTP, profiles, weeks, consent,        └──▶ Chrome extension / Android screen
      │                    subscriptions, rate limits) via `Backend` seam             presses Add on the user's own
      └──▶ Stripe (built, mocked in beta)                                           Morrisons session
```

## 2. Layers
- **Frontend:** Next.js 15.5 App Router, React, a "liquid glass" CSS skin (`src/app/glass.css`). PWA (manifest, service worker in `src/lib/pwa`). Screens: sign-in, 11-step onboarding, plan (this week / upcoming), ingredients, recipes, settings, account, legal pages.
- **Planner (`src/lib/planner`):** deterministic, seeded, pure functions. `generatePlan` builds Monday to Friday against a calorie band and protein floor per day (portion resizing 80 to 140%, snack auto-fill, small top-ups). `planWeek` builds several candidate weeks and keeps the best. This week's change: dinners are chosen as a set (shared ingredients, perishable leftovers weighted, a soft protein-variety penalty, short-life food cooked earlier) in `week.ts` and `waste.ts`; breakfasts, lunches and snacks lean toward ingredients already in the dinners (a bonus, never a rule).
- **Shopping (`src/lib/planner/shopping.ts`):** aggregates ingredient quantities across the week and rounds up to whole packs per product, so waste is a by-product of pack sizes.
- **Content pipeline (`scripts/`, `src/lib/content`):** `content:import` validates (unknown ingredients, macro sanity, allergens implied by names, duplicate slugs, live recipes must be priced), computes per-portion macros from per-100 g data, cost per portion and budget tier, allergens (union of ingredient allergens), and writes `src/data/*.json` for **live recipes only** plus `supabase/seed.sql`.
- **Nutrition:** per-100 g values come from the UK CoFID 2021 dataset (`content/cofid`) or the Morrisons pack label when the two agree (`scripts/apply-nutrition.ts`); a label that disagrees with CoFID is not trusted. Status flows `draft` to `verified` to `live`; only live recipes reach the app.
- **Pricing:** `scripts/refresh-prices.ts` reads each mapped Morrisons product page (JSON-LD price) at a polite rate and writes `content/prices.json`; moves over 50% are held for review; delisted or out-of-stock items keep the last price and are flagged. **Status:** Morrisons now returns 403 to scripted fetches (it has for GitHub's servers for a while, and for a plain fetch from here today), so refreshing needs a browser session or a home connection. A cloud scheduled task and a GitHub workflow were set up for this; I have not verified they still succeed.
- **Backend seam (`src/lib/db`):** `getBackend()` returns a localStorage mock when the Supabase env vars are empty, else Supabase. Auth is email OTP (8 digits); sign-up goes through a server route using the service role (`/api/auth/signup`) with a Postgres rate limiter (hashed IP keys, migration 0007).
- **Database (`supabase/migrations/0001` to `0008`):** profiles, weeks/plans, subscriptions, consent, rate limits, store choice. Row-level security is in the migrations; I have not re-audited the policies this session.
- **Billing:** Stripe code, webhook (signature verified, idempotent) and gating logic are written and unit-tested but run against a mock; free beta flag `NEXT_PUBLIC_FREE_BETA=1`.
- **Basket fill:** `extension/morrisons.js` (shared by the Chrome extension and the Android Capacitor app) automates the page UI of the person's own session only; it never calls Morrisons APIs (robots.txt disallows them). Hand-off is a URL fragment `#tableplan=<base64url JSON>` so nothing is sent to our servers.
- **Multi-store (in progress):** `src/lib/stores.ts` defines Morrisons, Tesco, Sainsbury's and Asda; `scripts/yappman-basket.ts` pulls candidate products and prices from a third-party price API; `scripts/match-products.ts` is a local review tool to confirm each ingredient-to-product match; confirmed matches are written into the ingredients file and per-store price files. State for that lives in `content/matches/` (gitignored: vendor data and licence).
- **Hosting and delivery:** push to `main` auto-deploys to Vercel (`table-plan.co.uk`). Security headers and a nonce CSP are set in middleware. Secrets live in Vercel env vars and must never be committed (secret rotation is still on Jack's list).

## 3. Quality gates (what a reviewer can rely on)
`npx tsc --noEmit` and `npx vitest run` (about 3,400 tests). Beyond unit tests of the planner, cycle, billing, security and extension script, the content is now tested:
- **Method sense:** every new meal's method must use each listed ingredient, set an oven or grill, have timings that fit the cook time, cook raw meat through, and end by serving.
- **Macro sense:** each ingredient's calories must match its own protein, carbs and fat; every new meal's ingredients must have verified nutrition; plate weight, calorie density and fat/protein shares must look like real food; calories are compared with the original recipe where the source states them.
- **Original-method outlines:** for each sourced meal the technique order, oven temperatures and key timings of the original are recorded (facts only) and our own-words method is tested against them.
- **Scenario runs:** each meal goes through the real shopping builder at six household and portion sizes (just me, a pair, a family, smaller and bigger portions).

## 4. Where I would look first (honest weak spots)
1. **Price freshness:** the nightly/weekly price refresh is blocked by Morrisons for scripted clients. The app shows "estimated prices, checked <date>" with a warning after 4 days; the planned Monday feed (third-party API into Supabase, "prices as of" date, held-for-review checks) is designed but not built.
2. **Catalogue is not in the database at runtime:** adding a recipe means a code change and a deploy (by design for the beta), and `seed.sql` is only needed if the DB should mirror the catalogue. Worth deciding whether the catalogue should move to the database before launch.
3. **Third-party price API and licences:** price data comes from a vendor under a licence that allows display and about a week's caching but not resale; retailer terms for scraping and for the basket automation are for Jack and a solicitor.
4. **RLS and the service-role signup route:** worth a fresh security review (policies, rate limiting, enumeration, the OTP flow).
5. **Basket automation fragility:** it depends on Morrisons' page markup; it breaks when the page changes. Other stores need their own adapters and product page links.
6. **Single-region, single-vendor stack:** Vercel (lhr1) plus Supabase (eu-west-1); no background job runner yet (reminders are computed in the client; true push is not built).
7. **Compliance:** health data (goals, weight, allergies) means consent flow, privacy policy, ICO registration, data deletion and export, all present or in progress; not yet reviewed by a solicitor.

## 5. How to run it
`npm ci` then `npm run dev:demo` (mock backend, free beta, http://localhost:3001; sign in with any email and code 123456). Content: `npm run content:import`, `npm run content:verify -- --table`. Checks: `npx tsc --noEmit`, `npx vitest run`.

## 6. Target data model (proposal for review, 7 Nov 2026)
Not built. This is what Claude recommends and what a backend reviewer should challenge.

### Principles
1. **Split data by how fast it changes.** Slow editorial data (recipes, ingredients, nutrition) stays as reviewed files in Git and is published into the app by the import step. Fast operational data (prices, availability, per-store product matches) lives in the database and is updated by a weekly job, never by a code release.
2. **The app never calls the price vendor live.** A scheduled job (Yappman or any other source) writes a dated snapshot. If a run fails or is rejected by the checks, the app keeps serving the previous snapshot and shows its date; the existing "prices checked <date>" warning after 4 days stays.
3. **Reference data is global; user data is per user.** Nutrition for a meal is the same for everyone and is computed from the ingredients. Per-user rows hold targets, plans, portion sizes, ticks and consent. A user changing weight or goal recalculates their targets; nothing is "stored as they update it".
4. **A saved plan is a snapshot.** It stores recipe ids, portion multipliers and the calories, protein and cost at planning time, so history does not change when a recipe or a price changes later. The shopping list is priced fresh at checkout.

### Tables (sketch)
- `stores` (id, name, live, basket_adapter).
- `ingredients` (slug, name, unit, cupboard, per100 kcal/protein/carbs/fat, allergens, cofid code, nutrition verified, gramsPerUnit). Reference nutrition comes from Morrisons labels or CoFID; one value per ingredient, applied to every store.
- `store_products` (store_id, ingredient_slug, product_ref, name, pack_size, unit, product_url, matched_by, matched_at, confirmed). One ingredient maps to one product per store; a store with no match simply cannot offer meals that need that ingredient.
- `store_prices` (store_id, product_ref, price_pence, was_price_pence, promo_text, loyalty_price_pence, in_stock, as_of, source, run_id) with history kept; a view or table `latest_prices` for the app.
- `price_runs` (run_id, source, started_at, finished_at, rows, rejected_rows, status, notes) so every snapshot is auditable and a bad run can be rolled back.
- `recipes` (slug, content_hash, status, course, serves, kcal, protein, carbs, fat per portion, allergens, method, image fields). Mirrors the files; written by the import step.
- `recipe_costs` (store_id, recipe_slug, cost_per_portion_pence, budget_tier, as_of, complete). Recomputed by the weekly job from `latest_prices`. Today these are baked into `src/data` at import time, which goes stale and ignores the user's store.
- Per-user (already exist in some form): profile and targets, store choice, weekly plans (with the snapshot fields above), ticks, consent, subscription.

### Data flow with the weekly job
1. Scheduled job (Monday early) calls the price source for every matched product at every live store (batch, bounded cost).
2. Validation: reject or hold rows with a price change over 50%, a size change, a delisted product, or a missing match; write the accepted rows to `store_prices` with the run id.
3. Recompute `recipe_costs` per store and tier cut-offs; mark a recipe as incomplete for a store when any priced ingredient is unavailable there.
4. The app reads `latest_prices` and `recipe_costs` for the user's store on load (cached), runs the planner locally, and saves the plan snapshot.

### Where the planner sits
Keep it client-side and pure (it already is). It takes the catalogue plus the user's store snapshot as inputs. Budget caps and the "least waste" choice use that store's prices. Different snapshots can pick a different week for the same seed; that is fine because a plan is saved once made.

### What this deliberately does not do
- Per-store nutrition for ordinary ingredients (one reference value is used; processed and branded items are the exception and may need per-store values if a meal is the product, e.g. ready meals).
- Recipes in the database at runtime (kept bundled until there is a reason to change them without a deploy).

### Open questions for the reviewer
- Is a weekly batch enough, or do promotions (mid-week price drops) matter?
- Row-level security for the new tables (read-only to users; write only by the job's service role).
- Vendor failure plan beyond "serve the last snapshot": a second source, or manual refresh from a browser session?
- Licence limits: display and about a week of caching, no resale, no images or descriptions from the vendor; retailer terms still need a solicitor.
- Where the weekly job runs (Vercel cron, Supabase scheduled function or GitHub Actions) and how its secrets are held.

### Suggested build order
1. `store_prices`, `price_runs`, `latest_prices`, the import and validation job for Morrisons (replaces the blocked page checks).
2. `recipe_costs` per store and moving cost and tier off the baked-in values.
3. Tesco, Sainsbury's and Asda matches into `store_products`, then their prices.
4. Product page links and basket adapters per store.
