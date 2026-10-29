import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

import { ServiceWorkerRegistration } from "@/components/pwa/service-worker-registration";
import { getSiteUrl } from "@/lib/env/public";

import "./globals.css";

const siteUrl = getSiteUrl();
const siteName = "StarsTask";
const description =
  "Browse university assignments by course, semester, deadline, and tag. Sign in with Google to contribute your own.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "StarsTask — Find and share university assignments",
    template: `%s | ${siteName}`,
  },
  description,
  applicationName: siteName,
  keywords: ["assignments", "university", "courses", "students", "deadlines"],
  openGraph: {
    type: "website",
    siteName,
    title: "StarsTask — Find and share university assignments",
    description,
    url: "/",
  },
  twitter: {
    card: "summary",
    title: "StarsTask — Find and share university assignments",
    description,
  },
  robots: {
    index: true,
    follow: true,
  },
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      {
        url: "/icons/apple-touch-icon.png",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  },
  appleWebApp: {
    capable: true,
    title: siteName,
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#fafaf8",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-dvh antialiased">
        <a
          href="#main-content"
          className="bg-accent text-accent-foreground sr-only rounded-md px-4 py-2 text-sm font-medium focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50"
        >
          Skip to content
        </a>
        {children}
        <ServiceWorkerRegistration />
      </body>
    </html>
  );
}
