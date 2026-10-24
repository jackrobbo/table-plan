# Security and privacy: what's in place, and what only you can switch on

Last reviewed 24 Oct 2026. Code references are to this repo.

## In place (code, deployed)

| Area | What | Where |
|---|---|---|
| Browser hardening | `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`, `COOP`, HSTS (Vercel) | `next.config.ts`, `src/lib/security/csp.ts` |
| Script policy | Per-request nonce CSP: only our scripts and nonce-marked ones run (no inline/eval); `connect-src` limited to this site and our Supabase project; no framing; no plugins | `src/middleware.ts` |
| Data access | Row-level security on every user table; the browser only ever holds the public key; the service-role key is server-only | `supabase/migrations`, `src/lib/server/context.ts` |
| API auth | Bearer token checked with Supabase on every authenticated route; Stripe webhook is HMAC-verified, replay-protected, idempotent | `src/lib/server`, `src/lib/billing` |
| Sign-up gate | New accounts only via `POST /api/auth/signup` (invite redeemed atomically while `NEXT_PUBLIC_INVITE_ONLY=1`); sign-in codes never create users | `src/lib/server/signup.ts` |
| Abuse limits | Best-effort per-IP limits on sign-up, waitlist, feedback, account routes | `src/lib/server/rateLimit.ts` |
| Account deletion | `DELETE /api/account`: cancels Stripe first (stops if it can't confirm), removes feedback/waitlist/invite link, deletes the login (cascade to profile + subscription). Safe to retry | `src/lib/server/account.ts` |
| Data export | `GET /api/account/export`: JSON of everything held | same |
| Consent | Explicit consent to health data and the terms, stored with a version and timestamp; withdrawal deletes measurements, allergies and plans | `src/lib/consent.ts`, `/consent`, Settings |
| Policies | Privacy policy and terms, generated from the real data flows and plan config | `/privacy`, `/terms` |
| Hosting region | Serverless functions in London (`lhr1`); database in Ireland | `vercel.json` |
| Errors | Browser errors go to our own log as one scrubbed line each: Vercel → Logs → search `[client-error]` | `src/lib/errorReport.ts` |
| Sessions | A flaky connection is never treated as "signed out"; failed saves show a banner | `src/lib/db/supabase.ts`, `src/lib/status.ts` |

## Only you can do these (dashboards)

Order matters for the first two.

1. **Supabase → Authentication → Sign In / Providers → turn OFF "Allow new users to sign up".** Until you do, anyone can still create an account by calling Supabase directly. After you do, only `/api/auth/signup` can. Check: sign in as an existing user works; "Create my plan" with a valid invite works.
2. **Vercel → Settings → Environment Variables → add `NEXT_PUBLIC_INVITE_ONLY=1`** (Production), then redeploy. Without it, anyone can create an account through `/api/auth/signup` with no code.
3. **Vercel → Project → Firewall → Add rule (rate limit).** Our connector can't create these. (a) paths starting `/api/auth/` or equal to `/api/waitlist`: 10 requests / 60 s per IP, then deny 5 min. (b) paths starting `/api/` except `/api/billing/webhook`: 60 / 60 s per IP. The in-app limiter only blunts one server instance; this is the hard limit.
4. **Supabase → Authentication:** shorten email OTP expiry (default 1 hour; 10 minutes is plenty), and replace the Gmail test SMTP with a real sender (Resend, Postmark, SES) with SPF/DKIM before real users.
5. **Supabase plan:** Pro before real users: daily backups, no pausing when idle, optional session time-box / inactivity timeout (Auth → Sessions), higher email limits.
6. **Rotate** the Supabase service-role key, the Stripe test secret key and the Gmail app password that were pasted into chats; update the Vercel env vars.
7. **Legal:** register with the ICO and pay the data-protection fee; fill in your business name and address in `/privacy` and `/terms` (they currently give only the contact email, `NEXT_PUBLIC_CONTACT_EMAIL`); have a solicitor read both; keep a short record of processing and a breach procedure; accept the DPAs with Supabase, Vercel and Stripe.
8. **Before opening to the public:** add CAPTCHA (Cloudflare Turnstile) on sign-up and the waitlist, and consider Supabase's CAPTCHA protection for sign-in codes.
9. **Housekeeping:** `drop extension if exists http;` in Supabase; delete the `tmp/catalogue-sync` branch on GitHub.

## Known limits

- Product pages and the paywall are not secret: the paywall is a client-side convenience, the recipes are in the JS bundle.
- Rate limiting in code is per server instance (see above).
- "May contain" traces are not covered by the allergen data (stated in the terms).
- `npm audit`: a build-time `postcss` advisory via Next, fixed in a later Next release.
- Backups: the free Supabase plan has none you can restore from.

## Checking it yourself

- Headers: `curl -sI https://table-plan-app.vercel.app/signin` (look for `content-security-policy`, `x-frame-options`).
- A blocked origin: open the site's console and run `fetch('https://example.com')`: it should fail with a CSP error.
- Errors: Vercel → Logs → search `[client-error]`.
