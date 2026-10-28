'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import Screen from '@/components/Screen';
import { extensionInstalled } from '@/lib/basket';

/** Install help for the Morrisons trolley extension, with a live "is it detected?" check. */
export default function ExtensionPage() {
  const [found, setFound] = useState<boolean | null>(null);
  const check = () => { setFound(null); setTimeout(() => setFound(extensionInstalled()), 400); };
  useEffect(check, []);
  const version = typeof document !== 'undefined' ? document.documentElement.dataset.tableplanExt : undefined;

  return (
    <Screen onBack={() => history.back()}>
      <h2>Fill Your Morrisons Trolley</h2>
      <p className="sub">A small browser add-on (beta) that adds your shopping list to your Morrisons trolley for you. Desktop Chrome, Edge or Brave. It isn&apos;t available on phones.</p>
      <div className={found ? 'note' : 'estimate-flag'} role="status">
        {found === null ? 'Checking…' : found ? `Detected ✓ (version ${version}). You'll see "Checkout at Morrisons" under your Shopping List list.` : 'Not detected on this page yet.'}
        {' '}<button className="linkbtn" onClick={check}>Check Again</button>
      </div>
      <ol className="plain" style={{ lineHeight: 1.6 }}>
        <li><a href="/extension/table-plan-morrisons-extension.zip" download>Download the Add-on (Zip)</a> and unzip it. You get a folder.</li>
        <li>In Chrome open <b>chrome://extensions</b> (Edge: edge://extensions) and switch on <b>Developer mode</b>.</li>
        <li>Click <b>Load unpacked</b> and choose the unzipped folder (the one containing <b>manifest.json</b>).</li>
        <li>Come back to this site and <b>reload the page</b>, then press <b>Check again</b>.</li>
        <li>Open your week → <b>Shopping List</b> (you need an active free trial or subscription) → <b>Checkout at Morrisons</b>.</li>
      </ol>
      <p className="muted">It works in your own browser and your own Morrisons session, signed in or not, and never sees your password. You still choose the slot and pay on Morrisons. <Link href="/privacy">Privacy</Link></p>
    </Screen>
  );
}
