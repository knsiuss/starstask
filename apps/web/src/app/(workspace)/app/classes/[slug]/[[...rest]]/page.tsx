import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { flattenSearchParams } from "@/lib/utils/search-params";

export const metadata: Metadata = {
  title: "Class",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ slug: string; rest?: string[] }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/**
 * Class workspaces now live directly at `/classes/[slug]/*`. Old links and
 * bookmarks under `/app/classes/[slug]/*` forward with their path and query.
 */
export default async function LegacyClassRedirect({
  params,
  searchParams,
}: PageProps) {
  const { slug, rest } = await params;
  const flat = flattenSearchParams(await searchParams);
  const query = new URLSearchParams();

  for (const [key, value] of Object.entries(flat)) {
    if (value) {
      query.set(key, value);
    }
  }

  const subPath = rest && rest.length > 0 ? `/${rest.join("/")}` : "";
  const suffix = query.toString();

  redirect(`/classes/${slug}${subPath}${suffix ? `?${suffix}` : ""}`);
}
