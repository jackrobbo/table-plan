# Table Plan — Phase 1 (MVP) kickoff plan

Consolidates the Phase 1 plan, the pricing decision, the retailer decision, and the
basket-integration call. Companion docs in this folder: `README.md` (the v0.1 UX flow,
38 screens) and `basket-integration-spike.md` (the research behind the basket decision).

## Where we are
- **PoC built & live** at `table-plan-app.vercel.app`: the create→plan→list loop
  (goal → swipe recipes → guardrail solver fills Mon–Fri → Morrisons-priced list).
  Static `index.html`, no backend. Validated 1,000/1,000 weight-loss days in band.
- **Full v0.1 low-fi UX flow** now exists (see `README.md`).
- Nothing on the real MVP (DB, auth, persistence, bigger bank, pricing pipeline,
  payments, weekly-cycle engine) has been started yet.

## Phase 1 goal
A stranger can sign up, set a goal, generate a **saved** Mon–Fri plan, get a trustworthy
Morrisons-priced list, and come back to it — reliably, with honest pricing.

### Definition of done
- Sign up → onboard → generate → save → return-and-resume works for a real account
- Generated weeks hold the quality bar (days in band, pack right-sized, ~£2.20/portion-ish)
- Pricing cached, refreshed nightly + on Monday open, visibly honest when stale
- Payment live or wired and ready to switch on
- Waitlist collecting in parallel

### MVP cut line (the full 38 screens is more than 6–10 weeks)
**Ship:** Welcome → email-OTP → onboarding (goal, stats, meals-to-plan, allergies,
dislikes, taste swipe ≥5/type) → generate first week (days-never-fail planner, snacks
auto-filled) → paywall → ingredients list → **Save-to-Notes checkout** → "This week"
(Plan + Recipes + ticks) → **plan next week** (Set up → Pick → Review → List) on the
Monday-open / Sunday-deadline cycle.
**Defer to fast-follow:** Friday summary, weekend add, richer profile-edit-with-impact,
"New for you" learning loop, real basket-send.

## Decisions locked
### Pricing
- **Launch price: £9.99/year (pre-selected, "1 week free") or £0.99/month.** Keep for
  launch/validation — priced just above free (Cherrypick is free); "less than one day of
  meal prep."
- Net ~£9.64/yr after Stripe. Infra per user is pennies/year (low-touch SaaS), so
  overheads don't sink it — **but the price leaves no room for paid acquisition.** This
  model lives on organic growth (Sunday-ritual loop, waitlist, referrals). Deliberate choice.
- **Build price as config, not hardcoded.** Plan a priced-up tier post-validation
  (~£20–30/yr or ~£2.99/mo — still far below meal-prep), grandfathering early adopters.
- £0.99/mo is a decoy (annual is obviously better); don't expect real revenue from it.

### Retailer
- **Launch Morrisons-only.** We already have the verified SKU set, ingredient→product
  mapping, the Ocado Smart Platform product endpoint, and the proven "populate list →
  Add all" path. Keeps SKU-mapping scope sane.
- **Multi-retailer = Phase 2** (the "cheapest week" differentiator). Each extra chain
  needs its own scrape adapter + full ingredient→SKU re-mapping — the real cost.
- Copy fix: the flow's "prices averaged across supermarkets" only becomes true in
  Phase 2; for the MVP show **"estimated Morrisons prices, dated."**

### Basket integration (see `basket-integration-spike.md`)
- No official/self-serve basket API for Morrisons. **MVP checkout = Save-to-Notes/export
  + "≈" dated estimates** — nothing gated on integration.
- **Affiliate links** = second revenue line; **secure the Morrisons affiliate deal
  post-launch** (FlexOffers/Awin, ~4.6–5.5% CPA on >£40, new-customer, monthly recheck).
  Weak attribution — garnish.
- **Fast-follow:** a browser extension that generalises the proven "populate list → Add
  all" in the user's own session.
- **Phase 3:** retailer partnership for true in-app basket + fulfilment (the Cherrypick route).

## Milestones (~6–10 wks for the cut-line MVP)
| # | Milestone | ~size | Notes |
|---|---|---|---|
| **S0** | Basket + pricing spike | wk 1 | DONE (this folder). Confirms Notes fallback + OSP pricing. |
| **M0** | Foundations: Next.js PWA, Supabase, schema, seed from the prototype's verified data, deploy | wk 1–2 | Reuse PoC solver/data as-is — don't rewrite. Schema derived from the prototype's data structures. |
| **M1** | Auth + full onboarding + persistence | wk 2–3 | Email-OTP; 8-step onboarding; allergies household-wide hard-exclude; dislikes; taste swipe ≥5/type. GDPR: stats optional. |
| **M2** | Recipe bank → DB, grow 31 → 100–150, CoFID macro verify | wk 3–5 | Per recipe: allergens, course, macros-only flag. Content lift — start wk 1, run parallel. |
| **M3** | Pricing pipeline: OSP scrape + cache + nightly health + **Monday refresh** + "≈ dated" UI | wk 4–6 | JSON-LD `offers.price`; detect silent delistings. |
| **M4** | Planner hardening: **days-never-fail** (resize + top-up, highlight adjusted), snacks auto-fill, waste-consolidation | wk 5–6 | — |
| **M5** | Weekly-cycle engine: week states (to_plan→…→done/missed), plan-next-week journey, Mon/Sun reminders | wk 6–8 | Core loop logic + state model from `README.md`. |
| **M6** | Monetisation: Stripe £9.99/yr (1-wk free) / £0.99/mo, paywall in onboarding | wk 7–8 | Price as config. |
| **M7** | Private beta: invite waitlist | wk 8–10 | — |

## Parallel tracks
- **Waitlist landing page** — ships in days, independent of the build; feeds M7 and
  Phase-0 validation. Lead with "the bottleneck to health is money" / "a month of Sundays
  costs less than one day of meal prep."
- **Dietitian sign-off** — the deficit / 1,200-kcal floor / carb-fat method need review
  before launch claims. Start outreach now; gates launch claims, not the build.

## Open questions
- Carb/fat targets + deficit method — dietitian review.
- All prices/totals/"£ saved" are placeholders until the pipeline is live.
- Browser-extension basket path — scope as a fast-follow spike once MVP ships.
- Keep the build clean-room: no code or data lineage from the single-household prototype
  beyond the already-anonymised recipe/SKU data.
