'use client';
import Link from 'next/link';
import MorrisonsLogo from '@/components/RetailerLogo';
import Screen from '@/components/Screen';

export default function Welcome() {
  return (
    <Screen footer={<>
      <Link className="btn" href="/signin?new=1">Create my plan</Link>
      <Link className="linkbtn accent" href="/signin">I have an account</Link>
    </>}>
      <div className="brand"><div className="logo">T</div>Table Plan</div>
      <h1>Cook real food based on your needs and goals.</h1>
      <p className="sub" style={{ maxWidth: '36ch' }}>
        No expensive meal prep or food boxes. Real meals at real supermarket prices, planned for the week and priced as a shopping list.
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
