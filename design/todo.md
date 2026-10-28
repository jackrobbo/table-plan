# To-do (28 Oct 2026)

Replaces `design/tomorrow.md` (kept for the detailed security steps). **[JACK]** = only you can do it (dashboards, accounts, decisions). **[CLAUDE]** = I do it.

Where we are: free beta live at https://table-plan.co.uk (open sign-up, no paywall). Android app 1.2 at `/app` fills a Morrisons trolley and reports back what went in and what is still to add. Prices refreshed 25 Oct.

## Jack: launch blockers
- [ ] **[JACK] Zoho Mail on table-plan.co.uk**: verify domain (TXT), MX (`mx.zoho.eu` 10, `mx2.zoho.eu` 20, `mx3.zoho.eu` 50), SPF `v=spf1 include:zoho.eu ~all`, DKIM (`zoho._domainkey`), DMARC (`_dmarc`, start `p=none`). Tell Claude when done; Claude checks the records and mail-tester score.
- [ ] **[JACK] Resend (or similar) sender for sign-in codes**: free account, add domain, add its DNS records at Porkbun, give Supabase the SMTP details (Claude walks through). Supabase's built-in sender allows only a few emails an hour.
- [ ] **[JACK] Supabase**: Authentication → URL Configuration (Site URL `https://table-plan.co.uk`, redirect `https://table-plan.co.uk/**`); turn off "Allow new users to sign up"; shorten email code expiry to 10 minutes.
- [ ] **[JACK] Rotate secrets** pasted in chat: Supabase service-role key, Stripe test key, Gmail app password. Type new values straight into Vercel (`SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`), redeploy.
- [ ] **[JACK] Cloudflare Turnstile key** (free) so Claude can add the sign-up CAPTCHA.
- [ ] **[JACK] Vercel firewall**: two rate-limit rules (values in `design/security.md`, step 3).
- [ ] **[JACK] Clean-up**: remove test accounts (`supabase/oneoff/remove-user.sql`), `drop extension if exists http;`, delete GitHub branch `tmp/catalogue-sync`.

## Jack: before real users / money
- [ ] **[JACK] Supabase Pro** (backups, no idle pause).
- [ ] **[JACK] ICO registration**, business name and address for `/privacy` and `/terms`, solicitor read.
- [ ] **[JACK] Outreach**: Samsung Food (Whisk) business team and Morrisons partnerships / Awin affiliate. (Claude drafts; Jack sends.)
- [ ] **[JACK] Decide**: meal photos (own photography vs one illustration style).
- [ ] **[JACK] Stripe live mode** only at go-live; the free-beta flag (`NEXT_PUBLIC_FREE_BETA`) comes off then.

## Jack: testing
- [ ] **[JACK] Use the Android app for a real week's shop**; send screenshots of anything that breaks (and of the "open app in the header" thing).
- [ ] **[JACK] Screen-by-screen UI/UX feedback** (Claude sends screenshots in order; reply per screen).

## Claude
- [ ] **[CLAUDE] Check Sunday 1 Nov price-refresh run** (04:17 UTC) pushed to `main`.
- [ ] **[CLAUDE] After Zoho is live**: check DNS records, set `NEXT_PUBLIC_CONTACT_EMAIL`, update legal pages and the extension's site match for `table-plan.co.uk`.
- [ ] **[CLAUDE] UI/UX review pass**: screenshot every key screen at phone size, collect Jack's feedback, batch the changes.
- [x] **[CLAUDE] Sticky bottom navigation** (Jack, welcome-screen comment): glass tab bar (Plan, Upcoming, Recipes, Account) on /plan, /account, /settings; setup flows keep their pinned button. Built in the preview, not committed or pushed. Replaces the header links and the overlapping Account link. Still to check on a real phone and in light mode.
- [x] **[CLAUDE] Icon library** (Jack): Lucide (`lucide-react`) in the tab bar, goal and activity cards, meal-time headings and meal slots. Not yet: Account/Settings rows, welcome screen, allergen chips, swap/tick buttons. Uncommitted.
- [ ] **[CLAUDE] Motion and touch pass** (Jack: "animation, both touch points, navigation etc"). Done (uncommitted): shared timings and curves, one press feel, tick pop, gliding tab pill, views slide the way you moved, badge pop, reduced motion honoured. Still to do: drag-to-close sheets, push/back slide for flows (onboarding, plan/next), haptics in the Android app, a check on a real phone for blur plus animation.
- [x] **[CLAUDE] Welcome page redesign** (Jack: logo, about, carousel of 4 features, "priced by" at the bottom): built and checked in dark and light at phone size (uncommitted). Features: Hits your targets, Meals you'll actually eat, Priced before you shop, Fills your trolley. Copy and feature choice are Jack's call.
- [ ] **[CLAUDE] Cherrypick ideas** (notes in `design/inspiration-cherrypick.md`): greeting with a reason, "why this meal" line, real "Building your week" screen, tile grids with icons, sticky "Fill my trolley" bar with badge, "what you'll need" row layout. Jack to pick which to do first.
- [x] **[CLAUDE] "Building your week" screen** (first week only): tilted Monday / Tuesday cards and five guardrail steps tick off before the plan appears (about 4s). Checked in the preview, uncommitted.
- [x] **[CLAUDE] Cooking time on every recipe** (Jack): all 131 recipes have `time: { prep, cook }` minutes (my estimates, in `content/recipes`), required for live meals by `content:import`, shown as "≈ 25 min" on meal rows, the recipe sheet and the swap sheet. **[JACK] sanity-check the numbers** (start with the traybakes, curries and jacket potatoes). Not yet: a Quicker swap filter, and the Supabase `recipes` table has no time column (the app reads the compiled data). Uncommitted.
- [x] **[CLAUDE] Stand-in photos** (Jack: "you pick the photos, use food/plate examples for the recipes and throughout; real images later"): 23 free Unsplash photos (credits in `design/photo-credits.md`). All 131 meals show a stand-in chosen by name (recipe cards, recipe sheet, taste swipe, weekend guide) and the welcome carousel uses four. A meal's own photo replaces its stand-in automatically. Uncommitted.
- [ ] **[JACK] Real meal photos** later: see `content/README.md` (Meal photos) and `design/photo-credits.md` for how to swap and when to delete the stand-ins.
- [x] **[CLAUDE] Plan rows slimmed down + photos** (Jack: "how complex this is getting"): each row is now photo, slot label, name, then two quiet lines ("32g protein · 493 kcal" and "≈ 8 min ≈ £1.39"); carbs and fat moved to the recipe sheet only; Swap is an icon; a portion resize shows as a small "97% portion" chip. Uncommitted.
- [x] **[CLAUDE] Tinder-style taste picking** (Jack): drag or tap cards (keep / skip), KEEP and SKIP stamps, next card peeking behind; after 5 likes a prompt asks to keep picking or move on to the next meal type (Finish after the last). Cards show time and price per portion. Uncommitted.
- [x] **[CLAUDE] Title case throughout** (Jack): headings, onboarding questions, button and link labels, option cards, section titles, chips and the carousel titles now use title case (small words like "to", "and", "for" stay lower). Body copy stays sentence case. Uncommitted.
- [x] **[CLAUDE] One clear checkout** (Jack: "it's either copy to notes or checkout"): the Ingredients tab now shows "Checkout at Morrisons" and "Copy List to Notes" together. With the Android app or Chrome add-on, Checkout fills the trolley; otherwise it opens a sheet offering the app, the add-on, or item by item. The Plan tab has a pinned "Shop This Week · ≈ £xx" button that jumps to Ingredients. Uncommitted.
- [ ] **[CLAUDE] Remaining UX gaps** (`design/ux-audit.md`): first-week "Generating" screen, supermarket choice, Pick for me / Pick my own on the Upcoming card, name greeting.
- [ ] **[CLAUDE] Android polish**: item-by-item step-through inside the in-app Morrisons screen, better filling screen.
- [ ] **[CLAUDE] Multi-store groundwork**: product catalogue keyed by (store, ingredient), store adapter interface; Ocado first (same platform as Morrisons). See the multi-store note below.
- [ ] **[CLAUDE] Sign-up CAPTCHA** once the Turnstile key is in.
- [ ] **[CLAUDE] Draft outreach emails** to Samsung Food and Morrisons.
- [ ] **[CLAUDE] Later**: meal-photo brief, Sentry alerts, recipe catalogue from the database, iPhone app (needs a Mac and a $99/yr Apple account).

## Multi-store note
Morrisons and Ocado run the same shop software, so the trolley script should carry over with small changes. Tesco, Sainsbury's and Asda block automated requests from our servers (HTTP 403 on 28 Oct), so price crawling there is hard; the in-browser trolley filling still works because it runs in the person's own browser. Lidl and Aldi have no online grocery shop to fill. Design: `ingredient_products(store, ingredient_id, sku, slug, pack_size, unit, price_pence, status, checked_at)`; the planner stays store-neutral and the shopping list is built per store, which also gives a "this week costs £X at Morrisons, £Y at Ocado" comparison.
