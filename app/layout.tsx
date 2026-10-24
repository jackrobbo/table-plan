import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Table Plan",
  description:
    "Pick a goal, pick meals you like, get a Mon–Fri plan that hits your numbers — with a Morrisons-priced shopping list, sized to real packs.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Table Plan", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f7f2" },
    { media: "(prefers-color-scheme: dark)", color: "#111a14" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GB">
      <body>{children}</body>
    </html>
  );
}
