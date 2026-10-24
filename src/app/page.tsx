'use client';
import Link from 'next/link';
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
      <h1>Your goals.<br />Your meals.<br />Your budget.</h1>
      <p className="sub" style={{ maxWidth: '38ch' }}>
        Table Plan turns your nutritional goals and favourite meals into a realistic weekly meal plan and shopping list. Eat towards your goals, buy only what you need, and shop at your usual supermarket &mdash; without the cost of a meal-kit subscription.
      </p>
      <div className="card">
        <h3>Priced at Morrisons</h3>
        <p className="muted" style={{ margin: '4px 0 0' }}>Your list shows estimated Morrisons prices, dated, so you know what the week will cost before you shop.</p>
        <MorrisonsLogo />
        <p className="muted" style={{ margin: '8px 0 0' }}>More supermarkets soon.</p>
      </div>
    </Screen>
  );
}
