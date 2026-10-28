'use client';
import Link from 'next/link';
import FeatureCarousel from '@/components/FeatureCarousel';
import MorrisonsLogo from '@/components/RetailerLogo';
import Screen from '@/components/Screen';
import { useSignedIn } from '@/lib/useSignedIn';

export default function Welcome() {
  const signedIn = useSignedIn();
  return (
    <Screen footer={<>
      <div className="pricedby"><span>Priced at</span><MorrisonsLogo height={20} /><span>· more supermarkets soon</span></div>
      {signedIn ? <Link className="btn" href="/plan">Go to My Plan</Link> : <>
        <Link className="btn" href="/signin?new=1">Create My Plan</Link>
        <Link className="linkbtn accent" href="/signin">I Have an Account</Link>
        {process.env.NEXT_PUBLIC_INVITE_ONLY === '1' && <Link className="linkbtn" href="/waitlist">No Invite Yet? Join the Waitlist</Link>}
      </>}
    </>}>
      <div className="welcome">
        <div className="brandblock">
          <span className="logo lg" aria-hidden>T</span>
          <span className="bname">Table Plan</span><span className="beta" aria-hidden>BETA</span>
        </div>
        <div className="hero">
          <h1>Your Goals.<br />Your Meals.<br /><span className="grad">Your Budget.</span></h1>
          <p className="sub">A weekly meal plan and shopping list built around your goals, so you buy only what you need, without a meal-kit subscription.</p>
        </div>
        <FeatureCarousel />
        <p className="muted legal"><Link href="/privacy">Privacy</Link> · <Link href="/terms">Terms</Link></p>
      </div>
    </Screen>
  );
}
