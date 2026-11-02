import type { MetadataRoute } from "next";

import { getSiteUrl } from "@/lib/env/public";

export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl = getSiteUrl().replace(/\/$/, "");

  return [
    { url: `${siteUrl}/`, changeFrequency: "daily", priority: 1 },
    {
      url: `${siteUrl}/privacy`,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${siteUrl}/terms`,
      changeFrequency: "yearly",
      priority: 0.3,
    },
  ];
}
