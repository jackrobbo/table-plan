# Tomorrow

State at the end of 24 Oct 2026: production is `1352219` (branch `claude/eager-fermat-bnmhki`). Everything below is either a dashboard step only the owner can do, a decision, or the next piece of work. Tick off as you go. Detail for the security items is in `design/security.md`.

## 1. Test the Morrisons basket signed in (the one you said matters most)
- [ ] Unzip `table-plan-morrisons-extension.zip` (also: `npm run extension:zip` in this repo), Chrome → `chrome://extensions` → Developer mode → Load unpacked.
- [ ] Sign in to Morrisons in another tab. In Table Plan open a week's **Ingredients** and press **Fill my Morrisons trolley** → **Add them**.
- [ ] Check: items land in your real trolley; total ≈ our estimate; a repeat run adds nothing; anything unavailable is listed; **Stop** works.
- [ ] Then signed out → run it → log in: does Morrisons merge the guest trolley into your account?
- [ ] Send me what happened (screenshot of the panel is perfect) and I fix what broke. Checklist and the page hooks it relies on: `extension/README.md`.

## 2. Sign-up is open (decision, 25 Oct)
Anyone can create an account; no invite code. `NEXT_PUBLIC_INVITE_ONLY` is `0` in Production (set it to `1` and redeploy to go back to invite-only). Because sign-up is open:
- [ ] Leave Supabase's "Allow new users to sign up" **on or off, it no longer matters**: accounts are made by our server (`/api/auth/signup`), so turning it off is still a good idea (it stops bots calling Supabase directly, which skips our rate limit).
- [ ] CAPTCHA (Turnstile) moves up my queue: it is now the main defence against junk accounts. Needs a free Cloudflare Turnstile key from you.
- [ ] Waitlist page and invite codes are no longer needed for access; leave them, or tell me to hide the waitlist link.

## 3. Make the price crawl run
- [ ] GitHub → Settings → Branches → set the default branch to `claude/eager-fermat-bnmhki`.
- [ ] Vercel → Settings → Git → Production Branch → `claude/eager-fermat-bnmhki` (so a price commit deploys itself).
- [ ] GitHub → Actions → "Refresh Morrisons prices" → **Run workflow** once. Tell me the result; I'll check Morrisons isn't blocking GitHub's servers. Then it runs nightly (02:30 UTC) and Mondays (05:00 UTC), and only commits if typecheck and tests pass.

## 4. Protect the public routes
- [ ] Vercel → Project → Firewall → add two rate-limit rules (exact values in `design/security.md`, step 3).
- [ ] Supabase → Authentication: shorten the email code expiry (10 minutes is plenty).

## 5. Keys and clean-up
- [ ] Rotate the three secrets pasted in chat: Supabase service-role key, Stripe test secret key, Gmail app password. Update the Vercel env vars (`SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`) after.
- [ ] Remove your test accounts: `supabase/oneoff/remove-user.sql` (preview first, then remove; change the email on each part). Do it for `jack@betmate.app`, and delete the three unconfirmed sign-ups (`jo@example.com`, `jackrobertsondesign@gmail.com`, `jacklfc@hotmail.com`). Optionally delete the empty Stripe test customer `cus_VV9SkBMXSs8WSE`.
- [ ] Supabase SQL editor: `drop extension if exists http;`
- [ ] GitHub: delete the branch `tmp/catalogue-sync`.
- [ ] Before testing again as a new user, clear site data for table-plan-app.vercel.app.

## 6. Before real users (not tomorrow, but decide the dates)
- [ ] Supabase Pro (backups, no idle pause, session timeouts, email limits).
- [ ] Proper email sender (Resend / Postmark / SES) with SPF and DKIM, replacing the Gmail test SMTP.
- [ ] ICO registration and fee; business name and address into `/privacy` and `/terms`; confirm or change the contact email (`NEXT_PUBLIC_CONTACT_EMAIL`, currently `jack@betmate.app`); solicitor reads both pages.
- [ ] Switch Stripe from test to live (new keys, new price ids, new webhook) only at go-live.

## 7. Decisions I need from you
- [ ] Meal photos: your own photography, or one consistent illustration style? (The image plumbing is built; I'll write a shot list or style brief for whichever you pick.)
- [ ] Morrisons affiliate: sign up (Awin / FlexOffers) so list links earn commission? Needs your account.
- [ ] Is the extension worth a Chrome Web Store listing ($5 once, review takes days) or do testers load it by hand for now?

## 8. My queue (say "go" and I'll pick up in this order)
1. Fix whatever the signed-in basket test turns up.
2. Run the price crawl from GitHub and fix anything the first real run shows.
3. CAPTCHA (Cloudflare Turnstile) on sign-up: needed now that sign-up is open (needs a free Turnstile key from you).
4. ~~Dietitian-style review list~~ done: `design/content-review.md` (34 rows: stand-in matches, label-only products, hand-asserted allergens). Needs a human with a pack in hand, or a dietitian.
5. Meal photos: shot list or style brief, plus a batch-build once images exist.
6. Optional: Sentry (alerts) in place of the log-only error reporting.
7. Read the recipe catalogue from the database rather than the compiled bundle, so content fixes don't need a deploy.
