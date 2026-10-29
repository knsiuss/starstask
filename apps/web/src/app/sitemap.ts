import type { MetadataRoute } from "next";

import { listPublishedForSitemap } from "@/lib/db/assignments";
import { getSiteUrl, isSupabaseConfigured } from "@/lib/env/public";

// Published assignments change constantly; regenerate hourly instead of at build.
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = getSiteUrl().replace(/\/$/, "");
  const staticEntries: MetadataRoute.Sitemap = [
    { url: `${siteUrl}/`, changeFrequency: "daily", priority: 1 },
    { url: `${siteUrl}/assignments`, changeFrequency: "hourly", priority: 0.9 },
  ];

  if (!isSupabaseConfigured()) {
    return staticEntries;
  }

  try {
    const published = await listPublishedForSitemap();

    return [
      ...staticEntries,
      ...published.map((assignment) => ({
        url: `${siteUrl}/assignments/${assignment.id}`,
        lastModified: new Date(assignment.updated_at),
        changeFrequency: "weekly" as const,
        priority: 0.7,
      })),
    ];
  } catch {
    // A sitemap outage must not take the page down.
    return staticEntries;
  }
}
