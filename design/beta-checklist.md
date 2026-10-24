# Private beta (M7) — go/no-go checklist

Built and tested in code: waitlist capture (`/waitlist`, `/api/waitlist`), invite gate (`NEXT_PUBLIC_INVITE_ONLY=1`),
single-use invite codes (`npm run beta:invites -- 50`), in-app feedback, consent-gated cookieless analytics events,
error/404 pages. **None of it is live until the blockers below are cleared.**

## Blockers (nothing ships to real users until these are done)
| # | Blocker | Owner | Notes |
|---|---|---|---|
| 1 | **Supabase project + real backend** | Jack + Claude | Create project; paste `supabase/setup.sql` (`npm run supabase:bundle`) into the SQL editor; enable Email OTP; then Claude replaces the mock `Backend` and `src/lib/server/context.ts`. Until then data lives only in each browser's localStorage. |
| 2 | **Invite enforcement at the server** | Claude | Today the gate is a UI check. The real gate must be server-side (redeem via `redeem_invite()` before the auth user is created, e.g. an auth hook or a signup route). Do not rely on the client check. |
| 3 | **Stripe live** | Jack + Claude | Products/prices, webhook endpoint, 4 env vars (see README). Test the full trial → charge → cancel cycle in Stripe test mode first. |
| 4 | **Dietitian sign-off** | Jack | Deficit method, 1,300 kcal floor, protein cap (35% of kcal), carb/fat split. Gates every launch claim. |
| 5 | **Safety screen** | Jack decides | Under-18s, pregnancy/breastfeeding, history of disordered eating, medical conditions. Currently only an 18+ age check in onboarding. |
| 6 | **Legal** | Jack + solicitor | Privacy policy (health data is special-category under UK GDPR; lawful basis = explicit consent), ToS, not-medical-advice, DMCC subscription terms. Drafts in `legal/`: they are starting points, not reviewed advice. |
| 7 | **Morrisons terms** | Jack | Check terms for the nightly price check and for using their logo. The affiliate deal is the clean route to both. |
| 8 | **Allergen data verified** | Jack | Tags are provisional (derived from product names). A beta with allergic users needs label-verified allergens (M2). |
| 9 | **Cookie/analytics consent banner** | Claude | Analytics defaults OFF. Add a consent prompt before turning any provider on. |
| 10 | **Error monitoring** | Claude | `error.tsx` is the hook; add Sentry (or similar) once there is a DSN. |

## Beta plan
1. Soft launch to ~25 invitees from the waitlist; widen to ~100 if the numbers below hold for two weeks.
2. Send invites in batches (`npm run beta:invites -- 25`, codes land in gitignored `.private/`). Never commit codes.
3. What to watch (events in `src/lib/analytics.ts`, all non-identifying): onboarding completion by step, weeks generated vs
   planned, list saved, paywall viewed → subscribed, trial → paid, week-2 return (planned a second week).
4. Questions to answer: do people finish onboarding? Do they plan week 2? Do the daily numbers feel right? Is the
   Morrisons estimate within ~10% of the real basket? (Ask a few beta users to compare.)
5. Kill/iterate signals: <50% finish onboarding, <30% plan a second week, or repeated "prices were wrong" feedback.

## Not in beta (deferred)
Friday summary, weekend add, "New for you", swap sheet, profile edit with plan-impact preview, push notifications while
the app is closed, extra supermarkets, basket send, browser extension.
