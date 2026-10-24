# Privacy policy: what it must cover (from the actual data flows)
- **Data collected:** email; goal; optional height, weight, age, sex (special-category health data → explicit consent);
  allergies (health data); dislikes; meal preferences; plans/ticks; subscription status. Payments are handled by Stripe;
  we store no card details.
- **Lawful basis:** explicit consent for health data (optional stats and allergies), contract for the service.
- **Optional stats:** the app works without height/weight/age/sex (with less accurate targets). Say so.
- **Retention + erasure:** "Delete my data" exists in Account; the real backend must also delete the auth user and cancel
  the Stripe subscription.
- **Processors:** Supabase (database/auth), Stripe (payments), Vercel (hosting), email provider for OTP. Analytics only with consent.
- **Price checks:** product pages are fetched from a retailer; no user data is sent.
- **Contact + DPO/ICO details, international transfers, children (18+ only).**
