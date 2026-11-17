import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs/config";

// The Content-Security-Policy is built per request in `src/proxy.ts` because it
// carries a nonce that Next.js copies onto its own script tags.
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    // `geolocation=(self)` is required: a blanket `geolocation=()` disables the
    // Geolocation API for every page, so the "Use my location" button fails
    // with PERMISSION_DENIED even when the browser has granted access.
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(self), payment=()",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  transpilePackages: ["@starstask/contracts", "@starstask/shared"],
  experimental: {
    // Tree-shake icon imports so a page only ships the icons it renders.
    optimizePackageImports: ["lucide-react"],
  },
  // A running dev server locks `.next`, and the sandboxed environment blocks
  // bulk deletes, so a verification build can be pointed at a scratch dir via
  // NEXT_DIST_DIR without touching the dev server. Unset in every other case.
  ...(process.env.NEXT_DIST_DIR ? { distDir: process.env.NEXT_DIST_DIR } : {}),
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      { protocol: "https", hostname: "**.googleusercontent.com" },
      { protocol: "https", hostname: "*.supabase.co" },
    ],
  },
  async redirects() {
    // The "My assignments" page is gone; edit now lives on the assignment
    // itself. Old notification links and bookmarks keep working.
    return [
      {
        source: "/my-assignments",
        destination: "/assignments",
        permanent: false,
      },
      {
        source: "/my-assignments/:id/edit",
        destination: "/assignments/:id/edit",
        permanent: false,
      },
      // The workspace home moved from /dashboard to /app.
      {
        source: "/dashboard",
        destination: "/app",
        permanent: true,
      },
      {
        source: "/dashboard/:path*",
        destination: "/app/:path*",
        permanent: true,
      },
    ];
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      {
        // The worker must never be served from a stale cache, otherwise a
        // deploy keeps the previous notification handler alive.
        source: "/sw.js",
        headers: [
          {
            key: "Content-Type",
            value: "application/javascript; charset=utf-8",
          },
          {
            key: "Cache-Control",
            value: "no-cache, no-store, must-revalidate",
          },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
      {
        source: "/icons/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
    ];
  },
};

// Sentry's wrapper is applied only when a DSN is configured; without one the
// config is byte-identical to the un-wrapped config and no source-map upload
// network calls happen. Org/project are needed only for sourcemap upload.
const sentryConfigured = Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN);

const exportedConfig = sentryConfigured
  ? withSentryConfig(nextConfig, {
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      authToken: process.env.SENTRY_AUTH_TOKEN,
      silent: !process.env.CI,
      widenClientFileUpload: true,
    })
  : nextConfig;

export default exportedConfig;
