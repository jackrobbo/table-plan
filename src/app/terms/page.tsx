import type { Metadata } from 'next';
import Link from 'next/link';
import LegalPage from '@/components/LegalPage';
import { PLANS, gbp } from '@/lib/billing/config';
import { freeBeta } from '@/lib/beta/config';
import { CONTACT_EMAIL } from '@/lib/legal/config';

export const metadata: Metadata = { title: 'Terms of use' };

export default function Terms() {
  const y = PLANS.yearly, m = PLANS.monthly;
  return (
    <LegalPage title="Terms of use">
      <p>These are the terms for using Table Plan. By creating an account you agree to them. Please read them with our <Link href="/privacy">privacy policy</Link>.</p>

      <h2>What Table Plan is</h2>
      <p>Table Plan turns your goals and the meals you like into a weekly plan and a shopping list priced at Morrisons. It is in private beta: features, meals and prices may change, and we may change or withdraw the service, with reasonable notice if you are a paying customer.</p>

      <h2>Not medical advice</h2>
      <p>Table Plan gives general nutrition guidance. It is not medical or dietetic advice. Talk to your GP or a registered dietitian before changing your diet if you have a medical condition, take medication, are pregnant or breastfeeding, or have ever had an eating disorder. Table Plan is not for anyone under 18. Your calorie and protein targets are estimates and we never plan below 1,300 kcal a day.</p>

      <h2>Allergies and ingredients</h2>
      <p>We exclude meals using the allergen information on the products we list, and we do our best to keep it right. It is guidance only. <b>Always read the label on the product you buy.</b> Labels change, and we don&apos;t cover &ldquo;may contain&rdquo; traces. If an allergy could cause you serious harm, check every product yourself and don&apos;t rely on Table Plan alone.</p>

      <h2>Prices and availability</h2>
      <p>Prices are dated estimates taken from public Morrisons product pages, not live prices. Products can be out of stock, substituted or cost more or less when you shop. We don&apos;t sell groceries and we aren&apos;t part of Morrisons; their names and logos belong to them.</p>

      <h2>The Morrisons browser extension</h2>
      <p>The optional extension presses the Add buttons on Morrisons&apos; website, in your own browser and session, for the items on your list. You are responsible for checking your trolley, delivery slot and order before you pay. We can&apos;t promise every item will be added or available.</p>

      <h2>Your account</h2>
      <p>You must be 18 or over and give us a real email address that you control. Keep your sign-in codes to yourself, and tell us if you think someone else has got into your account. One account is for one person.</p>

      <h2>Subscription and payment</h2>
      {freeBeta && <p><b>Free beta.</b> While Table Plan is in beta it is free to use and we take no payment. We&apos;ll tell you well before that changes, and you will only be charged if you choose a plan. The paid terms below apply once plans are offered.</p>}
      <ul>
        <li><b>Yearly:</b> {gbp(y.pence)} a year, with a {y.trialDays}-day free trial. You are not charged until the trial ends, then once a year until you cancel.</li>
        <li><b>Monthly:</b> {gbp(m.pence)} a month, until you cancel.</li>
        <li>Payments are taken by Stripe. Subscriptions renew automatically; the price and renewal date are shown before you subscribe.</li>
        <li><b>Cancelling:</b> you can cancel at any time in Account, in a few taps. You keep access until the end of the period you&apos;ve paid for, and we won&apos;t charge you again. To avoid being charged after a free trial, cancel before the trial ends.</li>
        <li>If we change the price we&apos;ll tell you in good time, and the new price only applies from your next renewal; you can cancel before then.</li>
        <li>You have the legal rights consumers have for digital services, including to cancel within 14 days of subscribing. Tell us at <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> and we&apos;ll sort a refund in line with those rights. Nothing in these terms limits them.</li>
      </ul>

      <h2>Using Table Plan properly</h2>
      <p>Don&apos;t misuse the service: no trying to break into it or other people&apos;s accounts, overloading it, or scraping or copying our recipes and data at scale.</p>

      <h2>Our responsibility</h2>
      <p>We&apos;ll provide Table Plan with reasonable care and skill. We don&apos;t exclude or limit liability for death or personal injury caused by our negligence, for fraud, or for anything else the law doesn&apos;t allow us to limit. Otherwise, we aren&apos;t liable for losses we couldn&apos;t reasonably have foreseen, or for loss of profit or business, and our total liability for anything arising from the service is limited to what you paid us in the 12 months before the problem. This doesn&apos;t affect your statutory consumer rights.</p>

      <h2>Ending your account</h2>
      <p>You can delete your account at any time in Account (see the privacy policy for what happens to your information). We may suspend or close an account that breaks these terms, and will tell you why.</p>

      <h2>Law and contact</h2>
      <p>These terms are governed by the law of England and Wales. If you live in Scotland or Northern Ireland you can also bring a claim in your local courts. Questions or complaints: <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.</p>
    </LegalPage>
  );
}
