# UX audit: the original flow (design/README.md, 38 screens) vs what is built

25 Oct 2026. ✅ built and tested · 🟡 partly · ❌ not built. "Rule" numbers are the Core rules in design/README.md.

## Summary
The spine is complete and working end to end: sign-in, onboarding, personal target, taste swipe, first week, paywall, shopping list priced at Morrisons, weekly cycle (to-plan / skip / missed), swap, settings, deletion. What's missing is mostly the **"living with the plan"** layer (weekly progress, feedback and learning) and some **polish on the plan screens** the original design leaned on.

## Screen by screen
| # | Screen | Status | Gap |
|---|---|---|---|
| 01 | Welcome | ✅ | Brand copy, signed-in state, privacy/terms links. "Check out in one tap" card replaced by "Priced at Morrisons". |
| 02–03 | Email, code | ✅ | 8-digit code (Supabase setting); resend timer; works offline-safe. |
| 04–09 | Goal, height, weight, age, sex, activity | ✅ | Plus an explicit health-data consent step (new). |
| 10 | Meals to plan | ✅ | |
| 11 | Allergies | ✅ | Vegetarian/vegan "coming soon · Notify me" is a stub: the button does nothing. |
| 12 | Your target | ✅ | |
| 13–14 | Dislikes, taste swipe | ✅ | Cards show tier (£/££/£££) and photo slot; real photos not yet. |
| 15 | Generating | 🟡 | "Building your week…" exists when planning next week; the first week after onboarding shows a plain skeleton, not the guardrail steps. |
| 16 | Week summary | 🟡 | Missing: "Estimated total ≈ £" on the plan tab, P/C/F tags and price and cook time per meal row, a "New for you" tag. |
| 17 | Swap sheet | 🟡 | Ranked options with kcal/protein/week-cost deltas ✅. Missing: Similar macros / Quicker / Cheaper filters, one deliberate "New for you" option. |
| 18 | Subscribe | ✅ | Stripe checkout (test mode). Apple/Google Pay depends on Stripe. |
| 19 | Reminders & install | 🟡 | Install sheet ✅; reminder opt-in is on the plan page, not at the end of onboarding; reminders show in-app only (no push yet). |
| 20 | Weekly plan | 🟡 | Missing: "Daily average" bars vs target, "today" badge, C/F tags on rows. |
| 21 | Portions auto-adjusted | ✅ | |
| 22 | Recipe sheet | 🟡 | Allergens, C/F, cost, cupboard amounts ✅. Missing: Ingredients / How to cook switch (it's one long scroll), tap-to-strike ingredients, "Never suggest this again". |
| 23 | Ticking off | 🟡 | Tick and "Done ✓" collapse ✅. Missing: "New this week. How was it? Liked it / Not for me". |
| 24 | Friday summary | ❌ | "Week done": meals eaten, days on target, averages, £ per meal vs meal prep, new-meal rating. |
| 25 | Weekend | ❌ | Weekend guide (target tags + favourites) and "Add weekends to your plans". |
| 26 | Upcoming, week to plan | 🟡 | Chips and states ✅. The Pick for me / Pick my own choice sits inside the planning journey rather than on the card. |
| 27 | Skipped / missed | ✅ | |
| 28 | Recipes | ✅ | |
| 29 | Profile | 🟡 | Settings covers goal, stats, meals, allergies, dislikes, spend, consent. Missing: supermarket choice (Morrisons only), reminders toggle in settings, a "Welcome back, <name>" greeting (we don't ask a name). |
| 30 | Edit profile, plan impact | ✅ | New vs was target; planned weeks untouched unless rebuilt. |
| 31 | Set up | 🟡 | Spend ✅. Missing: choose cooking days (+Sat/+Sun). |
| 32–33 | Pick my own, building | ✅ | |
| 34 | Review | 🟡 | Missing: cook times, "New" tag, day-off state. |
| 35 | Ingredients | 🟡 | Priced, ticked, "used for" ✅, per-item Morrisons links ✅. Missing: grouping by category (it's sorted by cost). |
| 36 | Shop | 🟡 | Save to Notes ✅; "Add to basket" is the desktop browser add-on only; no per-store comparison (Morrisons only). |
| 37 | Upcoming week opened | ✅ | |
| 38 | Leave planning? | 🟡 | Picks save as you go (so nothing is lost) but there's no "Save and finish later / Discard" prompt. |

## Rules not yet met
- **9 Taste learning:** only the onboarding swipe teaches us. No "Never suggest again", no ratings, ticks don't feed back.
- **10 Weekends:** not handled.
- **5 Floor:** the design says 1,200 kcal; we use 1,300 (and say so in the terms). Needs a dietitian to confirm either way.

## Suggested build order (what makes it feel complete soonest)
1. **Week done + progress** (24, 20): "Daily average" bars, today badge, Friday summary. This is the payoff moment and the best retention hook.
2. **Recipe sheet** (22): Ingredients / How to cook switch, tap-to-strike, Never suggest again. Used every day while cooking.
3. **Feedback loop** (23, rule 9): Liked it / Not for me after a new meal, "New for you" tag on one meal a week, ratings feed the planner.
4. **Plan rows** (16, 20, 34): P/C/F, price, "Estimated total ≈ £", cook time (needs cook time added to recipes).
5. **Ingredients by category** (35): needs a category on each ingredient (a content change).
6. **Weekends + cooking days** (25, 31).
7. **Swap filters** (17), **Leave planning prompt** (38), **reminders in settings** (29).
