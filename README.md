# Table Plan

UK meal-planning PWA (Next.js). See `design/phase-1-plan.md` for the roadmap.

- `npm run dev` — app at http://localhost:3000 (sign-in code is `123456` while the backend is mocked)
- `npm test` / `npm run typecheck`
- `npm run seed` — regenerate `supabase/seed.sql` from `src/data/*.json`
- `/poc` — the original single-file proof of concept (`public/poc/index.html`)

## Status
- **M0**: Next.js scaffold, Supabase schema + seed (`supabase/`), PoC data lifted into `src/data`.
- **M1**: email-OTP sign-in, 11-step onboarding (goal, stats with unit toggles and skip, meals, household
  allergies, target, dislikes, taste swipe ≥5/type), persistence with resume. Persistence goes through
  `src/lib/db` (`Backend`), currently **mocked on localStorage**; swap in Supabase in `getBackend()`.
- Allergen tags in `src/lib/allergens.ts` are provisional until M2 verification.

## Content pipeline
Recipes and ingredients live in `content/` (`ingredients.json`, `recipes/*.json` — one recipe or an array per file).
`npm run content:import` validates everything (unknown ingredients, macro sanity, duplicates, live recipes must be
priced), then regenerates `src/data/*.json` (live recipes only) and the idempotent `supabase/seed.sql`.
Ingredient CoFID data and extra retailer mappings (scraped) will be added later; `per100`/`product` are nullable.

## Pricing pipeline (M3)
`npm run prices:refresh` checks each mapped Morrisons product page (JSON-LD `offers.price`, 2s apart, identifiable UA,
robots-compliant) and writes `content/prices.json`. 404s, product-less pages, SKU mismatches and out-of-stock are flagged
(`delisted` / `out_of_stock`) and keep the last price; moves over 50% are held for review (`changed_big`); outages are `error`.
`.github/workflows/prices.yml` runs it nightly and Monday 05:00 UTC, re-imports and commits. The app shows prices as
"≈ £x · estimated Morrisons prices, checked <date>" with a warning after 4 days (`PriceNote`).

## Planner (M4)
`src/lib/planner`: `planWeek(input)` builds a Mon–Fri plan. Every day is checked against the calorie band and protein
floor ("days never fail"): cooked meals are resized (80–140%), snacks auto-fill (1–3), and small top-ups are added if
needed; resized/topped-up days are flagged. Several candidate weeks are built and the cheapest shopping list (least
pack waste) wins. Macros-only meals reserve calories. Targets above ~2,500 kcal exceed what the current 31-recipe bank
can reach; those days are flagged honestly rather than faked. Protein is capped at 35% of calories (provisional).
