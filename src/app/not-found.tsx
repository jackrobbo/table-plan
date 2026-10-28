import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="screen">
      <main>
        <h2 style={{ marginTop: 60 }}>Page Not Found</h2>
        <p className="sub">That page doesn&apos;t exist.</p>
        <Link className="btn" href="/">Go to Table Plan</Link>
      </main>
    </div>
  );
}
