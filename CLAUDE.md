# Table Plan

UK meal-planning PWA (Next.js 15 App Router, Supabase, Stripe test mode, Vercel). Morrisons-only, GBP. Live at https://table-plan.co.uk. `main` auto-deploys to production.

Start here: `design/handoff.md` (state, how to run, known issues), then `design/todo.md` (Jack / Claude to-dos) and `design/ux-audit.md`.

- Preview locally: `npm ci` then `npm run dev:demo` (mock backend, free beta, http://localhost:3001; sign in with any email and code `123456`).
- Checks before pushing: `npx tsc --noEmit` and `npx vitest run`.
- Look and feel: base tokens in `src/app/globals.css`; liquid glass skin in `src/app/glass.css` (remove its import in `src/app/layout.tsx` to revert).
- Android app in `android-app/` (Capacitor), Chrome extension in `extension/`; both share `extension/morrisons.js`.
- Screen-by-screen feedback from Jack is in the artifact https://claude.ai/artifact/QzQfFvf4tTxxME9pQ2AHb4 (`feedback` collection); read it before changing UI.
- Do not commit `.env*` or secrets. Commit messages end with the Co-Authored-By trailer.
