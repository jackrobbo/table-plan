'use client';
import Screen from '@/components/Screen';

/** Sideload help for the Android prototype (android-app/). */
export default function AppPage() {
  return (
    <Screen onBack={() => history.back()}>
      <h2>Table Plan for Android (Prototype)</h2>
      <p className="sub">The same Table Plan, as an app. Its Morrisons screen can add your whole list to your trolley for you, on your phone. Android only for now.</p>
      <ol className="plain" style={{ lineHeight: 1.6 }}>
        <li>On your Android phone, <a href="/app/table-plan.apk" download>download the app (apk)</a>.</li>
        <li>Open the downloaded file. Android will ask to allow installs from your browser: allow it, then choose <b>Install</b>. If Play Protect warns about an unknown app, choose <b>Install anyway</b>; it&apos;s a test build that isn&apos;t on the Play Store.</li>
        <li>Open <b>Table Plan</b>, sign in, then go to your week → <b>Shopping List</b> → <b>Checkout at Morrisons</b>.</li>
        <li>Morrisons opens inside the app. Tap <b>Add them</b> and it adds each item. Sign in to Morrisons first if you want your saved delivery details; then pick a slot and check out.</li>
      </ol>
      <p className="muted">The app only presses the same buttons you would on Morrisons&apos; website. It never sees your Morrisons password. Tell us what breaks.</p>
    </Screen>
  );
}
