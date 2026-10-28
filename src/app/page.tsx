'use client';
import Link from 'next/link';
import FeatureCarousel from '@/components/FeatureCarousel';
import MorrisonsLogo from '@/components/RetailerLogo';
import Screen from '@/components/Screen';
import { useSignedIn } from '@/lib/useSignedIn';

export default function Welcome() {
  const signedIn = useSignedIn();
  return (
    <Screen footer={signedIn ? <Link className="btn" href="/plan">Go to my plan</Link> : <>
      <Link className="btn" href="/signin?new=1">Create my plan</Link>
      <Link className="linkbtn accent" href="/signin">I have an account</Link>
      {process.env.NEXT_PUBLIC_INVITE_ONLY === '1' && <Link className="linkbtn" href="/waitlist">No invite yet? Join the waitlist</Link>}
    </>}>
      <div className="welcome">
        <div className="brandblock">
          <span className="logo lg" aria-hidden>T</span>
          <span className="bname">Table Plan</span><span className="beta" aria-hidden>BETA</span>
        </div>
        <h1>Your Goals.<br />Your Meals.<br />Your Budget.</h1>
        <p className="sub" style={{ maxWidth: '38ch' }}>
          A weekly meal plan and shopping list built around your nutritional goals, so you buy only what you need, without the cost of a meal-kit subscription.
        </p>
        <FeatureCarousel />
        <div className="pricedby">
          <span className="muted">Priced at</span>
          <MorrisonsLogo height={24} />
          <span className="muted">More supermarkets soon</span>
        </div>
        <p className="muted" style={{ marginTop: 8 }}><Link href="/privacy">Privacy</Link> · <Link href="/terms">Terms</Link></p>
      </div>
    </Screen>
  );
}
