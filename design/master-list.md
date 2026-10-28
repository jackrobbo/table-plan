# Table Plan: master list (28 Oct 2026)

Everything done, everything outstanding, and the decisions behind them. Written for a new session that has not seen the earlier conversation. Owner: Jack (jack@betmate.app). **[JACK]** = only Jack can do it. **[CLAUDE]** = the assistant does it.

## 1. What the product is
UK meal-planning PWA for people who want to hit calorie and protein targets on a budget. It builds a week of meals from what the person likes, sizes portions to their macros, produces a priced Morrisons shopping list, and (new) fills their Morrisons trolley. Aimed at mobile users who want easy checkout.
- Stack: Next.js 15.5 App Router, Supabase (project `dyaztrnlrmhcyrbctsbs`, eu-west-1), Stripe (test mode, unused during free beta), Vercel (`table-plan-app`, `prj_IzzsvenOpPzIRk5TeiS4xjOX4XmC`, team `team_Y5egWNPILI7F20uMIyWHNftS`, region lhr1).
- Live: https://table-plan.co.uk (www redirects to it); also table-plan-app.vercel.app. GitHub `jackrobbo/table-plan`; `main` is default and production and auto-deploys. Working branch `claude/eager-fermat-bnmhki` is kept identical to `main`.
- Business model: free beta now (everything unlocked, no paywall). Charging waits until real supermarket checkout works. Open sign-up for anyone; no invite code.

## 2. How to run and check
- `npm ci`, then `npm run dev:demo` → http://localhost:3001, mock localStorage backend (empty Supabase env), free beta, sign in with any email and code `123456`.
- Before pushing: `npx tsc --noEmit`, `npx vitest run` (205 tests, 26 files).
- Backend seam `getBackend()` (`src/lib/db`): mock when `NEXT_PUBLIC_SUPABASE_URL`/key empty, otherwise Supabase.
- Content: `content/*.json` → `npm run content:import` compiles `src/data/*.json` and `supabase/seed.sql`. `npm run prices:refresh` writes `content/prices.json`.
- Screenshots: Playwright is installed; hide the Next dev badge with `nextjs-portal{display:none!important}`.

## 3. Completed

### Product and planner
- 131 recipes, 116 ingredients, ~83 priced Morrisons products; macros, cost per portion and budget tier computed on import; allergens from pack labels; cupboard staples.
- Planner (`src/lib/planner/solve.ts`): calorie/protein band per day, portions resized, budget preference, "New for you" exploration dinner, days off, never-again list, swap a meal with day/week impact (`swap.ts`), top-ups.
- Onboarding: goal, height, weight, age, sex, activity, allergies, dislikes, taste swipe; health-data consent first (`/consent`).
- Week screens: This week / Upcoming tabs; Plan, Ingredients (aisle-grouped list, tick "have already"), Recipes; daily-average bars, tick-off, recipe sheet with tabs and strike-through, weekend guide, week-done summary.
- Settings: edit answers without wiping the plan; reminders; privacy (withdraw consent). Account: export data, delete account, feedback.
- Weekly cycle: picking opens Sunday 06:00 London a week ahead; reminders Sunday 09:00, last chance 16:00.
- Session resilience: no stuck skeleton on load failure, sign-out and offline handling, status banner, iOS home-screen note.

### Security, privacy, legal
- Nonce CSP in `src/middleware.ts` plus security headers (`next.config.ts`); verified on production.
- Server-side signup route `/api/auth/signup` (service role), Postgres rate limiter (`rate_limit_hit`, migration 0007), hashed IP keys; consent column (migration 0006); real account deletion and data export; error reporting route; OTP length 8.
- `/privacy`, `/terms`, `/consent`; contact email `jack@betmate.app` (`NEXT_PUBLIC_CONTACT_EMAIL`). Terms mention the free beta when the flag is on.

### Free beta and domain
- `NEXT_PUBLIC_FREE_BETA=1` (Vercel prod and preview): everyone has access, `/subscribe` redirects to `/plan`, Account says free during beta. Remove the variable and redeploy to bring billing back.
- Domain `table-plan.co.uk` bought at Porkbun, DNS (A `216.198.79.1`, CNAME `www` → Vercel) done and verified; HTTPS live.

### Morrisons trolley filling
- Morrisons (Ocado platform) gives guests a basket; we automate the page UI only (never APIs; robots.txt disallows `/api/`). Works signed out; Morrisons flags unavailable items once the person signs in with an address.
- Chrome extension (`extension/`, v0.1.1, zip at `public/extension/`): content script on groceries.morrisons.com presses Add/+ per product, reports added / already / partial / unavailable. Hand-off via URL fragment `#tableplan=<base64url JSON>`.
- Shop item by item mode (`src/components/ShopMode.tsx`) for phones without the extension.
- **Android app** (`android-app/`, Capacitor 7, `uk.co.tableplan.app`, version 1.2): loads the live site; native `MorrisonsPlugin` + `MorrisonsActivity` open Morrisons in an in-app WebView and inject the same `extension/morrisons.js` (shared; `window.TPNative` bridge stores the job). Full-screen "filling your trolley" screen, clear back header, edge-to-edge insets handled, summary split into "added" and "add these yourself". Results are returned to the site (`src/lib/basket.ts` `fillOutcome`, saved 3 days) and shown as a "Last fill" card with a leftover-only step-through. Build `npm run android:build` (JDK 17+, Android SDK; writes `public/app/table-plan.apk`); download page `/app`. Debug-signed. Jack tested on a real phone: worked, estimates matched the trolley.
- Estimated Morrisons price per list; prices dated; refreshed 25 Oct (83/83 ok, 37 newly priced, none moved).

### Visual
- **Liquid glass theme** (`src/app/glass.css`, one import in `layout.tsx`): translucent blurred surfaces over a colour field, floating glass header, capsule buttons, glass sheets, dark mode, reduced-transparency fallback. Bottom bar fade strengthened so footer links stay readable.
- Screen review page with 22 phone screenshots and a comment box per screen: https://claude.ai/artifact/QzQfFvf4tTxxME9pQ2AHb4 (comments stored in its `feedback` collection; read with the artifact data tool).

### Price refresh
- GitHub Actions workflow is manual only (Morrisons returns 403 to GitHub's servers).
- Cloud scheduled task `trig_01UvGSSpDU4wTeAVQR2AFWrU` ("Sunday Morrisons price refresh", Sundays 04:17 UTC): refreshes, runs import/typecheck/tests, pushes to `main`. First test run could not push (repo not attached); Jack has since attached `jackrobbo/table-plan`; the test fired after that probably found nothing to change, so **the first real push test is Sunday 1 Nov**.

### Docs in the repo
`CLAUDE.md`, `design/handoff.md`, `design/todo.md`, `design/tomorrow.md` (older, security detail), `design/security.md`, `design/ux-audit.md`, `design/content-review.md`, `extension/README.md`, `android-app/README.md`, `legal/README.md`.

## 4. Outstanding

### [JACK] launch blockers
1. **Zoho Mail** on table-plan.co.uk (EU data centre, Forever Free plan): verify domain (TXT), MX `mx.zoho.eu` 10 / `mx2.zoho.eu` 20 / `mx3.zoho.eu` 50, SPF `v=spf1 include:zoho.eu ~all` (only one SPF record), DKIM (`zoho._domainkey`), DMARC (`_dmarc`, start `p=none`). Then tell the assistant to check the records and a mail-tester score.
2. **Resend** (or similar) sender for sign-in codes; add its DNS records at Porkbun; SMTP details into Supabase. Supabase's built-in sender allows only a few emails an hour, which breaks open sign-up.
3. **Supabase** → Authentication: Site URL `https://table-plan.co.uk`, redirect `https://table-plan.co.uk/**` (Jack said done; confirm), turn **off** "Allow new users to sign up" (our server route still creates accounts), email code expiry 10 minutes. Custom domains add-on is not needed.
4. **Rotate secrets** that were pasted in chat: Supabase service-role key, Stripe test secret key, Gmail app password; type new values straight into Vercel (`SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`), redeploy.
5. **Cloudflare Turnstile** key (free) so the assistant can add a sign-up CAPTCHA.
6. **Vercel firewall** rate-limit rules (values in `design/security.md`, step 3).
7. **Clean-up:** remove test accounts (`supabase/oneoff/remove-user.sql`), `drop extension if exists http;`, delete GitHub branch `tmp/catalogue-sync`.

### [JACK] before real users or money
- Supabase Pro (backups, no idle pause); ICO registration; business name and address in `/privacy` and `/terms`; solicitor review; switch Stripe to live and remove the free-beta flag only at go-live.
- Send outreach emails (assistant drafts): Samsung Food (Whisk) business team, Morrisons partnerships / Awin affiliate. This is the route to real checkout and therefore to charging.
- Decide meal photos: own photography vs one illustration style (image plumbing exists).
- Use the Android app for a real week's shop; send screenshots of breakage. Clarify "open app in the header" on Morrisons pages (probably a Morrisons banner or link inside the in-app view).
- Comment on the screens in the review page.

### [CLAUDE]
- **UI/UX pass from Jack's comments** (review page above), batch the changes, check on the live site.
- Known small issues: second consent tick box sits under the sticky button until scrolling; "Add these item by item" may open Morrisons in the phone browser instead of the in-app screen; check the bottom bar fix on real devices.
- After Zoho is live: check DNS and mail-tester, set `NEXT_PUBLIC_CONTACT_EMAIL`, update legal pages and the extension's site match for `table-plan.co.uk` (the extension currently matches table-plan-app.vercel.app, its alias and localhost).
- Check the 1 Nov price refresh pushed to `main` (if not, fix the routine's repo access).
- Remaining UX gaps (`design/ux-audit.md`): first-week "Generating" screen with guardrail steps, supermarket choice and per-store comparison, Pick for me / Pick my own on the Upcoming card, name greeting.
- Sign-up CAPTCHA once the Turnstile key exists.
- Draft outreach emails to Samsung Food and Morrisons.
- **Multi-store groundwork**: product catalogue keyed by (store, ingredient): `ingredient_products(store, ingredient_id, sku, slug, pack_size, unit, price_pence, status, checked_at)`; store adapter interface (product URL, trolley script, price check); planner stays store-neutral and the shopping list is built per store, enabling "£X at Morrisons vs £Y at Ocado". Ocado first: same platform as Morrisons so the script should carry over; products and prices need their own mapping. On 28 Oct, Tesco, Sainsbury's, Asda and Aldi returned HTTP 403 to automated requests from our environment (so price crawling is hard; in-browser trolley filling would still work); Lidl and Aldi have no online grocery to fill; Ocado answered (HTTP 202, unconfirmed as real content); Waitrose unreachable from here. Asda is reported to be moving to Ocado technology around 2027 (unverified here).
- iPhone app later: needs a Mac and a $99/yr Apple developer account; same Capacitor project plus an iOS version of the Morrisons screen. Play Store later ($25 one-off, needs a proper signing key).
- Later: meal-photo brief once Jack chooses, optional Sentry, read the recipe catalogue from the database so content fixes need no deploy, optional hide waitlist link, cook times (no data yet), dietitian review of `design/content-review.md` (34 rows).

## 5. Decisions already made (do not re-litigate)
- Free beta with open sign-up; no private beta; Jack shares the link/code with people.
- Morrisons only for now; automate the page UI, never Morrisons' APIs.
- Android first (no developer fee, sideloadable); iPhone after the UI is settled.
- UI/UX work comes before app-store submission.
- Liquid glass look is wanted and applied; revert by removing one import.
- Picking opens Sunday 06:00; prices must be refreshed before then (hence the Sunday 04:17 UTC task).
- Jack handles domain, mailboxes and business setup himself; the assistant checks DNS and wires settings.

## 6. Where things live
Cloud session (this history): https://claude.ai/code/session_019p413kERXmk1N4hj4ajZd6. Vercel, Supabase and Stripe tools are available only in the cloud session; the local app session works on code and previews. Scheduled task and GitHub access are cloud-side. Environment variables live in Vercel (never commit `.env*`).
