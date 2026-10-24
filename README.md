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

## Weekly cycle (M5)
`src/lib/cycle`: weeks are keyed by Monday (Europe/London, DST-safe). Stored status is what the user did
(`open | in_progress | planned | shopped | skipped`); `effectiveStatus` derives `locked | to_plan | missed | active | done` from
the clock, so no background job is needed. Picking opens Monday 00:00 the week before and closes at midnight Sunday; only
one week is "to plan" at a time (skipping opens the next early); a missed week is never auto-picked; the first week always
starts the next Monday. UI: `/plan` (This week | Upcoming, ticks, recipe sheet, ingredients before the week starts) and
`/plan/next` (Set up → Pick → Review → List, saved as you go). Reminders (Mon 09:00 "open", Sun 16:00 "last chance") are
computed in `reminders.ts` and shown in-app when due; true push while the app is closed needs a server (VAPID + a
`push_subscriptions` table + scheduled job), not built yet. Deferred per the cut line: Friday summary, weekend add,
"New for you", swap sheet, richer profile-edit-with-impact.

## Payments (M6)
Pricing is config in `src/lib/billing/config.ts` (£9.99/yr with a 7-day trial, £0.99/mo). Paywall `/subscribe` sits after the
first week and before the shopping list; `/account` shows status, cancel/resume and data deletion. Gating: the first week
is visible free; ingredients, Save to Notes and planning further weeks need `hasAccess` (trialing/active, cancelled until the
paid period ends, 3-day grace when past due). **Billing is mocked** (`createMockBilling`, no card taken). The real path is
built and unit-tested but not run against Stripe: `src/lib/billing/server.ts` + `/api/billing/{checkout,portal,webhook}`
(signature-verified, idempotent webhooks, plan taken from the price id, user taken from server-set subscription metadata).
Env: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_YEARLY`, `STRIPE_PRICE_MONTHLY`. It needs
`src/lib/server/context.ts` wired to Supabase (session JWT check, service-role writes to `subscriptions`/`stripe_events`).
Until then the routes answer 401/501/503 rather than pretending.

## Private beta (M7)
Waitlist (`/waitlist`), invite gate (`NEXT_PUBLIC_INVITE_ONLY=1`; preview with the dev code `TABLE-DEMO`), single-use invite codes
(`npm run beta:invites -- 50`, written to gitignored `.private/`), in-app feedback, consent-gated cookieless analytics,
error and 404 pages. Local waitlist testing: set `WAITLIST_FILE=.private/waitlist.jsonl`. **See `design/beta-checklist.md` for the
blockers before real users.** One-paste database setup: `npm run supabase:bundle` → `supabase/setup.sql`.
