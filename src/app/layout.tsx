import type { Metadata, Viewport } from 'next';
import { connection } from 'next/server';
import './globals.css';
import './glass.css';
import ErrorReporter from '@/components/ErrorReporter';
import { PwaInit } from '@/components/InstallSheet';
import SiteHeader from '@/components/SiteHeader';
import TabBar from '@/components/TabBar';
import { Suspense } from 'react';

export const metadata: Metadata = {
  title: { default: 'Table Plan: your goals, your meals, your budget', template: '%s · Table Plan' },
  description: 'Table Plan turns your nutritional goals and favourite meals into a realistic weekly meal plan and shopping list. Eat towards your goals, buy only what you need, and shop at your usual supermarket, without the cost of a meal-kit subscription.',
  manifest: '/manifest.webmanifest',
  icons: { icon: [{ url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' }, { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' }], apple: [{ url: '/icons/apple-touch-icon.png', sizes: '180x180' }] },
  appleWebApp: { capable: true, title: 'Table Plan', statusBarStyle: 'default' },
};
export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover', themeColor: '#f2f2f6' };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Pages are rendered per request so each can carry its own script nonce (see src/middleware.ts).
  await connection();
  return (
    <html lang="en-GB" suppressHydrationWarning>
      <body><PwaInit /><ErrorReporter /><SiteHeader />{children}<Suspense fallback={null}><TabBar /></Suspense></body>
    </html>
  );
}
