import type { Metadata } from 'next';
import Link from 'next/link';
import LegalPage from '@/components/LegalPage';
import { CONTACT_EMAIL } from '@/lib/legal/config';

export const metadata: Metadata = { title: 'Privacy policy' };

export default function Privacy() {
  return (
    <LegalPage title="Privacy policy">
      <p>This explains what Table Plan collects, why, who sees it, and what you can do about it. We&apos;ve tried to keep it plain. If anything is unclear, ask us at <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.</p>

      <h2>Who we are</h2>
      <p>Table Plan is a meal-planning web app for adults in the UK. We decide how and why your personal information is used (we are the &ldquo;controller&rdquo; under UK data protection law). You can reach us at <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.</p>

      <h2>What we collect, and why</h2>
      <ul>
        <li><b>Your email address</b>, to create your account and send the code you sign in with. There are no passwords. (Contract.)</li>
        <li><b>Your goal and how active you are</b>, to set your daily calorie and protein target. (Contract.)</li>
        <li><b>Your height, weight, age and sex</b>, all optional, to make that target personal. Without them we use a typical target for your goal. This is health information, so we ask your explicit consent first. (Consent.)</li>
        <li><b>Your allergies</b>, to leave out meals that contain them. This is health information, so we ask your explicit consent first. (Consent.)</li>
        <li><b>Your dislikes, the meals you keep or skip, which meals you want planned, how many you cook for, and your weekly spend setting</b>, to build plans you will actually cook. (Contract.)</li>
        <li><b>Your plans, shopping lists and what you tick off as eaten</b>, so the service works from one visit to the next. (Contract.)</li>
        <li><b>Your subscription</b>: plan, status, trial and renewal dates, and your Stripe customer reference. Your card details go straight to Stripe; we never see or store them. (Contract.)</li>
        <li><b>Feedback you send us</b>, linked to your account so we can follow up. (Legitimate interests: improving the service.)</li>
        <li><b>Waitlist signups</b>: your email and when you agreed to hear from us. (Consent.)</li>
        <li><b>Technical data</b> such as your IP address and browser type, which our hosting provider logs when you use the service, and which we use to keep it secure and stop abuse. To limit abuse we also keep a scrambled (hashed) version of your address for up to a day, so we can slow down anyone sending too many requests. (Legitimate interests.)</li>
      </ul>

      <h2>What we don&apos;t do</h2>
      <ul>
        <li>We don&apos;t sell your information, and we don&apos;t use it for advertising.</li>
        <li>We don&apos;t share it with supermarkets. Tapping a Morrisons link, or using our browser extension to fill your Morrisons trolley, sends them nothing from us: the extension works in your own browser and your own Morrisons session, and doesn&apos;t send your list or anything else to us.</li>
        <li>The prices we show come from public product pages, fetched without any information about you.</li>
        <li>Analytics are off unless you opt in, and we never put your height, weight, age, sex, allergies or free text in analytics.</li>
      </ul>

      <h2>Health information and your consent</h2>
      <p>Allergies and body measurements count as health information, which the law treats with extra care. We only use them to build and size your plan, and only if you agree. You can say no to the optional measurements and still use Table Plan with a typical target. You can change or remove any of it in <Link href="/settings">Settings</Link>, and you can withdraw your consent at any time there: we then delete your measurements, allergies and the plans built from them.</p>

      <h2>Who we share it with</h2>
      <p>We use a few companies to run the service. They act on our instructions and may use your information only to provide their service to us.</p>
      <ul>
        <li><b>Supabase</b>: our database and sign-in. Hosted in Ireland (EU).</li>
        <li><b>Vercel</b>: runs the website and its servers. Our servers run in London.</li>
        <li><b>Stripe</b>: takes payment and manages subscriptions.</li>
        <li><b>An email delivery provider</b>: sends your sign-in code.</li>
      </ul>
      <p>We may also share information if the law requires it, or to protect people from harm or fraud.</p>

      <h2>Sending information abroad</h2>
      <p>Vercel and Stripe are US companies and may process some information in the United States. When they do, it is protected by approved safeguards (the UK–US data bridge, or the UK&apos;s standard contract terms).</p>

      <h2>How long we keep it</h2>
      <p>We keep your information while you have an account. When you delete your account (<Link href="/account">Account</Link>), we cancel your subscription and delete your profile, plans, answers, feedback and login straight away. Copies in our providers&apos; routine backups are overwritten as those backups roll over. Stripe keeps payment records for as long as the law requires them to (usually six years for tax and accounting). Waitlist emails are kept until you ask us to remove them.</p>

      <h2>Your rights</h2>
      <p>You can ask us to give you a copy of your information, correct it, delete it, restrict or object to how we use it, or move it to another service. You can also withdraw consent at any time.</p>
      <ul>
        <li><b>Get a copy:</b> Account → Download my data (a JSON file of everything we hold).</li>
        <li><b>Correct or change it:</b> <Link href="/settings">Settings</Link>.</li>
        <li><b>Delete it:</b> Account → Delete my account.</li>
        <li><b>Anything else:</b> email <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>. We&apos;ll reply within one month.</li>
      </ul>
      <p>If you&apos;re unhappy with how we&apos;ve handled your information you can complain to the Information Commissioner&apos;s Office (<a href="https://ico.org.uk/make-a-complaint/" rel="noopener noreferrer" target="_blank">ico.org.uk</a>, 0303 123 1113). We&apos;d like the chance to put it right first.</p>

      <h2>Cookies and storage on your device</h2>
      <p>We don&apos;t use advertising or tracking cookies. We keep a sign-in token and a few preferences (for example, that you dismissed the &ldquo;add to home screen&rdquo; prompt) in your browser&apos;s storage so the app works; these are essential and don&apos;t need consent.</p>

      <h2>Children</h2>
      <p>Table Plan is for adults (18 and over). If you think a child has signed up, tell us and we&apos;ll delete the account.</p>

      <h2>How we keep it safe</h2>
      <p>Information is encrypted in transit; each person can only read their own profile (enforced in the database, not just the app); payments are handled by Stripe; and access to our systems is limited. No service is perfectly secure. If something goes wrong that puts your information at risk we&apos;ll tell you and the ICO as the law requires.</p>

      <h2>Changes</h2>
      <p>If we change this policy in a way that matters, we&apos;ll tell you in the app or by email before it takes effect, and ask for your consent again if what we ask consent for has changed.</p>
    </LegalPage>
  );
}
