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
