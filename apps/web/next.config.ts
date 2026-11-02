import type { NextConfig } from "next";

// The Content-Security-Policy is built per request in `src/proxy.ts` because it
// carries a nonce that Next.js copies onto its own script tags.
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=()",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  transpilePackages: ["@starstask/contracts", "@starstask/shared"],
  // A running dev server locks `.next`, and the sandboxed environment blocks
  // bulk deletes, so a verification build can be pointed at a scratch dir via
  // NEXT_DIST_DIR without touching the dev server. Unset in every other case.
  ...(process.env.NEXT_DIST_DIR ? { distDir: process.env.NEXT_DIST_DIR } : {}),
  images: {
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

export default nextConfig;
