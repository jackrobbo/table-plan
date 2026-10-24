# Handoff: Table Plan — core UX flow (v0.1, low-fi)

## Overview
Table Plan is a mobile-first installable web app (PWA) that turns a health goal into a done-for-you Mon–Fri meal plan plus a priced supermarket ingredient list. Positioning: cheaper than meal-prep services (£5–8/meal); audience counts macros and is budget-conscious. Product principle — three "easys": easy to **create** a plan, easy to **purchase** the food, easy to **cook** it.

This bundle documents the full flow: onboarding → first week → living with "this week" → planning each following week.

## About the design files
`Table Plan Flow.dc.html` is a **design reference built in HTML**: a canvas of 38 static phone frames (280×590) laid out in rows with labelled arrows and a one-line note under each screen. It is not production code. Recreate the screens in the target stack (no codebase exists yet — a React + Vite + TypeScript PWA is a sensible default) using that project's own components and patterns. Open the file in a browser to view; `support.js` is only needed to render it. A Light/Dark tweak exists on the canvas.

## Fidelity
**Low-fidelity.** Use it for structure, hierarchy, flow, copy and states — not final visuals. Intended visual direction: Apple HIG flavour — system type ramp, inset-grouped cards, segmented controls, tabular figures for all numbers, full light and dark mode. Image areas are striped placeholders (recipe photos, supermarket logos, app logo).

Colour roles used in the wireframes (replace with a real design system):
- `--ok` green (`oklch(0.62 0.13 150)` light) — in band, protein (the hero macro), primary-action focus ring
- `--warn` amber (`oklch(0.68 0.14 70)`) — needs attention (week to plan, badge)
- Blue tint (`oklch(0.72 0.15 250)`) — "New for you" tag
- Neutrals: ink `#141414`, secondary `#6b6b70`, card `#fff`, background `#f2f2f6`; dark: bg `#000`, card `#1c1c1e`

## Core rules (business logic decided in design review)
1. **Weekly cycle.** Plans are Mon–Fri. Picking for next week opens **Monday** and closes **midnight Sunday**; cooking starts the next day. Only one upcoming week is "to plan" at a time.
2. **Missed deadline = missed week.** Nothing is auto-picked. "Pick for me" is a user action that builds from their likes. A missed or skipped week shows as Skipped/Missed.
3. **First week always starts the next Monday**, whatever day the user signs up. There is always a current plan after onboarding (no empty state).
4. **Days never fail.** The planner keeps every day inside the calorie band and above the protein floor by resizing portions and adding a top-up; adjusted items are highlighted (no error states for macros).
5. **Weight loss is steady.** ~500 kcal/day deficit, ~1 lb (0.5 kg)/week, never below 1,200 kcal. *(Needs dietitian sign-off.)*
6. **Meals to plan.** Breakfast, lunch, dinner are planned by default; each can be set to "Macros only" (shows a kcal + protein target, no recipe). Snacks are auto-filled by the backend to close macro gaps — users don't pick them.
7. **Servings.** Per meal time the user can add extra servings (e.g. dinner +2). The user's portion stays on their macros; extras only scale ingredients and price. Recipe sheets list ingredients for the whole dish, with a note giving the user's portion.
8. **Allergies are household-wide** (UK 14 major allergens, hard-excluded). **Dislikes** are user-level and only lower ranking. Vegetarian/vegan = "coming soon · Notify me".
9. **Taste learning.** Onboarding swipe: ≥5 likes per meal type (breakfast, lunch, dinner), no upper limit. Ongoing learning is implicit: keep/swap/tick signals. One "New for you" meal per week; swaps also offer one new recipe. After ticking a new meal, ask "Liked it / Not for me". Recipe sheet has "Never suggest this again".
10. **Weekends** are free by default (show macro target + favourite recipes); users can add Sat/Sun per week or in Profile.
11. **Profile edits that affect the plan** preview the new target and apply from the next week still to plan; already-shopped weeks are untouched.
12. **Pricing honesty.** Prices are estimates (average across supermarkets until one is chosen), always labelled "≈" and dated; never presented as live.
13. **After a week starts**, there's no shopping/ingredients view — only Plan and Recipes.
14. **Subscription.** Paywall inside onboarding, after the first week is shown and before checkout. £9.99/year (pre-selected, "1 week free") or £0.99/month. Web checkout (e.g. Stripe); manage/cancel in Profile.
15. **Reminders.** Monday "Next week's meals are open to pick", Sunday 4pm "Last chance, pick by midnight". Permission asked at the end of onboarding with Add to Home Screen (required for iOS web push).

## Screens
Rows A–F, numbered in flow order. Arrows on the canvas give the trigger for each transition; dashed arrows are alternate paths/states.

### A · Arrive, sign in, set the goal
- **01 Welcome** — wordmark/logo, headline "Cook real food based on your needs and goals.", subline about real supermarket prices; "Check out in one tap" card with supermarket logos; CTA "Create my plan", "I have an account".
- **02 Sign in: email** — one email field, "Send code". Copy: we only use your email for Table Plan.
- **03 Sign in: code** — 6-digit OTP boxes, auto-submit on 6th digit, resend timer.
- **04 Goal** — Lose / Maintain / Gain (radio cards). Lose = "Steady loss, about 1 lb a week". Step 1 of 8.

### B · About you (one question per screen, all required)
- **05 Height** (cm | ft/in), **06 Weight** (kg | st/lb | lb), **07 Age**, **08 Sex** ("Are you male or female?"), **09 Activity** (4 plain-language options) — progress bar, Back, Continue, numeric keypad where relevant.
- **10 Meals to plan** — per meal: segmented "Plan it | Macros only"; planned meals get an "Extra servings for others" stepper.
- **11 Allergies** — "Any allergies in your household?" 14 allergen chips, "No one has allergies", veggie/vegan coming-soon row.
- **12 Your target** — ~kcal, ≥protein, carbs, fat; "Steady, not extreme" note; not-medical-advice line; CTA to tastes.

### C · Tastes and first week
- **13 Dislikes** — ~70 chips grouped by food type + search; optional ("Skip, I eat anything").
- **14 Taste swipe** — tabs Breakfast/Lunch/Dinner with per-type counts (≥5 each); card with photo, tags, price; Skip/Keep; CTA disabled until all ≥5.
- **15 Generating** — "Building your week" with guardrail steps (sizing portions, checking protein, sharing ingredients, estimating cost across supermarkets).
- **16 Week summary** — "Here's your first week", starts Monday; per day: rows with photo, meal type, meal name (title), macro tags (P/C/F/kcal/time), price, Swap; "Serves 3" tag on dinners; "New for you" tag on one meal; footer "Estimated total ≈ £…"; CTA "Save and checkout".
- **17 Swap sheet** — "Swap Monday lunch": current meal, filters Similar macros / Quicker / Cheaper, 3 options with deltas ("+2g protein · +25 kcal") incl. one "New for you"; CTA "Use …".
- **18 Subscribe** — Yearly £9.99 (selected, "1 week free") / Monthly £0.99; benefits; "Subscribe and checkout"; Apple Pay / Google Pay.
- → then **35 Ingredients** and **36 Shop** (shared with row F) →
- **19 Reminders & install** — two reminders explained, Add to Home Screen; "Turn on reminders" / "Not now".

### D · This week
Header on all tabbed screens: "Welcome back, Sam" + avatar (→ Profile), top switch **This week | Upcoming (badge)**, sub-tabs **Plan | Recipes**.
- **20 Weekly plan** — "This week 26–30 Oct"; "Daily average" bars for protein/carbs/fat/kcal vs target markers; day cards (today badge, compact "P 126g · 1,500" pill, status dot) with meal rows: type, name, portion in plain amounts, macro tags, tick circle.
- **21 Portions auto-adjusted** — a day where the planner added chicken and a protein-shake top-up; changed rows highlighted green.
- **22 Recipe sheet** — bottom sheet: hero band tinted by meal slot, name, "Serves 3 · Monday dinner · per serving" macro tags, Ingredients | How to cook switch, tap-to-strike ingredients (whole dish), "Your portion for your macros" note, "Never suggest this again".
- **23 Ticking off** — completed day collapses to "Done ✓", next day "Up next"; after ticking a new meal: "New this week. How was it? Liked it / Not for me".
- **24 Friday summary** — "Week done": meals eaten 19/20, days on target 5/5, macro averages vs targets, ≈£ per meal vs meal prep and saving, new-meal rating; "Done".
- **25 Weekend (not planned)** — daily target tags as a guide, "Your favourites" recipe grid, "Add weekends to your plans".

### E · Upcoming, recipes, profile
- **26 Upcoming · week to plan** — week chips with state (e.g. "2–6 Nov · Due Sun midnight", "9–13 Nov · Opens Mon 2"); sub-tabs hidden until picked; card "Plan 2–6 Nov" with deadline copy, **Pick for me** / **Pick my own** / **Skip this week**.
- **27 Week skipped** — chip "Skipped" (also "Missed" when the deadline passes); "Undo skip"; next week becomes the one to pick.
- **28 Recipes (this week)** — grid of this week's recipes grouped by meal type, labelled with the days cooked; tap → recipe sheet.
- **29 Profile** — summary (goal, daily macros kcal/P/C/F with Edit), About you, Meals (days to plan, meals to plan, servings, allergies, dislikes, budget), Shopping (supermarket, subscription, reminders), privacy/disclaimer.
- **30 Edit profile · plan impact** — edited fields, "New daily target" (new vs was), notice "Saving will adjust your plan" (next week to plan uses new target; this week unchanged); "Save and update plan".

### F · Plan next week (full-screen journey, outside the tabs)
Header: Back · "Plan 2–6 Nov / pick by midnight Sun 1 Nov" · ✕; 5-step bar Set up · Pick · Review · List · Shop.
- **31 Set up** — "Same settings as usual?": meals to plan, servings per meal (breakfast/lunch/snack: just you; dinner: you + 2), daily target; cooking days Mon–Fri chips (+Sat/+Sun optional); budget Low / Medium / High (filters/ranks recipes). CTA **Pick for me** (→33) or **Pick my own (optional)** (→32).
- **32 Pick my own** — per-meal progress (Breakfast/Lunch/Dinner, picks = days cooking); swipe card.
- **33 Building** — same as 15.
- **34 Review** — estimated shop, days in band, per-day cards listing breakfast/lunch/dinner with cook times ("New" tag on new meal), day off shown dashed; swaps via 17; CTA "Save and checkout".
- **35 Ingredients** — every ingredient grouped by category, with what it's for and ≈ price; all ticked by default, untick what you have; "Save list · N items".
- **36 Shop** — "List saved": estimated price by supermarket (cheapest first, dated, close-match notes); **Add to [store] basket** / **Save to Notes**. *(Basket send may not ship — see open questions.)*
- **37 Upcoming week, opened** — planned week before it starts: tabs Plan | Ingredients | Recipes; Ingredients tab shows saved list with ≈ prices + Add to basket / Save to Notes.
- **38 Leave planning?** — on ✕ with unsaved picks: "Save and finish later" / "Discard picks" / "Keep planning". Saved progress shows on Upcoming as "In progress · 7 of 12 · Continue".

## State model (suggested)
- **User profile**: goal, stats (height, weight, age, sex, activity, units), derived targets (kcal band, protein floor, carbs, fat), meals-to-plan per meal time, servings per meal time, days to plan, household allergies, dislikes, budget tier, preferred supermarket, subscription, reminder prefs.
- **Taste profile**: likes per meal type, favourites, never-again list, implicit signals (kept, swapped, ticked, ratings) → attribute weights.
- **Week** (per Monday date): `status` ∈ `locked | to_plan | in_progress | planned | shopped | active | done | skipped | missed`; days off; per-week overrides; days → meals (recipe, portion, servings, macros, est. price, is_new); ingredient list (item, qty, used_for, est. price, ticked); checkout method (basket store | notes).
- **Ticks**: per date per meal, offline-first (localStorage/IndexedDB), synced.
- Transitions: Monday 00:00 → next week `to_plan`; Sunday 24:00 → unplanned `missed`; Monday → planned week becomes `active` ("This week").

## Open questions / placeholders
- Carb/fat targets, deficit and 1,200 kcal floor — need a defined method and dietitian review.
- All prices, totals and "£ saved" figures are placeholders.
- **Supermarket basket integration** may not be feasible; if not, Save to Notes + per-store estimates is the main path.
- Free-week trial mechanics for yearly (button/small print not yet updated).
- "In progress" state on Upcoming (from 38) is described but not drawn.

## Files
- `Table Plan Flow.dc.html` — the full flow canvas (rows A–F, screens 01–38, notes and arrows).
- `support.js` — runtime needed to open the HTML file locally.
