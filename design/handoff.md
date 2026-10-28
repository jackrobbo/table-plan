# Handoff to a local session (28 Oct 2026)

Read this first, then `design/todo.md` (Jack / Claude to-dos) and `design/ux-audit.md`.

## What this is
Table Plan: UK meal-planning PWA. Next.js 15.5 App Router, Supabase (project `dyaztrnlrmhcyrbctsbs`, eu-west-1), Stripe (test mode, unused during free beta), Vercel project `table-plan-app` (`prj_IzzsvenOpPzIRk5TeiS4xjOX4XmC`, team `team_Y5egWNPILI7F20uMIyWHNftS`). Morrisons-only, GBP. Live at https://table-plan.co.uk (also table-plan-app.vercel.app). GitHub `jackrobbo/table-plan`; `main` is the production branch and auto-deploys.

## Run it locally
    npm ci
    NEXT_PUBLIC_SUPABASE_URL= NEXT_PUBLIC_SUPABASE_ANON_KEY= NEXT_PUBLIC_FREE_BETA=1 npx next dev -p 3001
Empty Supabase vars give the mock backend (localStorage), so no keys are needed. Sign in with any email and code `123456`. Checks: `npx tsc --noEmit`, `npx vitest run` (205 tests).

## State
- Free beta on (`NEXT_PUBLIC_FREE_BETA=1` in Vercel); remove it to bring billing back.
- Liquid glass theme: `src/app/glass.css` (imported in `src/app/layout.tsx`); delete the import to revert.
- Android app 1.2 (Capacitor, `android-app/`, build with `npm run android:build`, needs JDK 17+ and the Android SDK). It loads the live site and has a native Morrisons screen that runs `extension/morrisons.js` and reports results back (`src/lib/basket.ts`, `src/components/BasketButton.tsx`). Download page `/app`.
- Chrome extension: `extension/`, zip at `public/extension/`.
- Prices: `content/prices.json`, refreshed 25 Oct. A cloud scheduled task (`trig_01UvGSSpDU4wTeAVQR2AFWrU`, Sundays 04:17 UTC) refreshes and pushes to `main`; Morrisons blocks GitHub's servers, so it must run from there or a home connection.
- Plan screen flow (28 Oct): no tabs until checkout; checkout is an overlay list shared with Plan next week and the Upcoming card (`src/components/ListStep.tsx`); after copy / trolley fill the tabs become Plan | Recipes | Ingredients and the week is in its eating window (ticks, no swaps, Today's Progress). The Menu tab is the favourites page. New week/profile fields (`wantCupboard`, `checkout`, `reminders.asked`) live in the existing jsonb columns, so no migration. Details and follow-ups in `design/todo.md`.
- Screen review page with per-screen comments: https://claude.ai/artifact/QzQfFvf4tTxxME9pQ2AHb4 (comments live in its `feedback` collection).

## Known small issues
- Plan screen: the bottom "Account" link overlaps the last card.
- Consent screen: the second tick box sits under the sticky button until you scroll.
- "Open app in the header" on Morrisons pages inside the Android app: unclear what Jack meant; ask for a screenshot.
- Step-through ("Add these item by item") may open Morrisons in the phone browser, not the in-app screen.

## Not yet done (Jack's side): see `design/todo.md`
Zoho mail records, Resend sender, Supabase Site URL / sign-up toggle, secret rotation, Turnstile key, Vercel firewall rules, outreach emails, Supabase Pro, legal details.

## Conventions
Commit messages end with the usual Co-Authored-By trailer. Push to `main` deploys to production. Do not commit `.env*`. Playwright is available for screenshots (`require('playwright')`); hide the Next dev badge with `nextjs-portal{display:none!important}`.
