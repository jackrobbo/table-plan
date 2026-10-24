import Link from 'next/link';

export default function Welcome() {
  return (
    <>
      <p className="eyebrow">Table Plan</p>
      <h1>Cook real food based on your needs and goals.</h1>
      <p className="muted" style={{ marginTop: 8 }}>
        Pick a goal, pick meals you actually like, and get a Mon–Fri plan that hits your numbers — with the shopping
        list priced at Morrisons, sized to real packs.
      </p>
      <p><Link className="btn" href="/signin?new=1">Create my plan</Link></p>
      <p><Link className="linkbtn" href="/signin">I have an account</Link></p>
      <p className="muted"><Link href="/poc">Try the proof of concept →</Link></p>
    </>
  );
}
