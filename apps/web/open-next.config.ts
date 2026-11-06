import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// Cloudflare Pages target for the Next.js app (double hosting fallback
// while Vercel is the primary production host).
export default defineCloudflareConfig();
