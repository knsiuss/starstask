import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { flattenSearchParams } from "@/lib/utils/search-params";

export const metadata: Metadata = {
  title: "Applications",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ rest?: string[] }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/**
 * Class applications now live directly at `/applications/*`. Old links and
 * bookmarks under `/applications/*` forward with their path and query.
 */
export default async function LegacyApplicationsRedirect({
  params,
  searchParams,
}: PageProps) {
  const { rest } = await params;
  const flat = flattenSearchParams(await searchParams);
  const query = new URLSearchParams();

  for (const [key, value] of Object.entries(flat)) {
    if (value) {
      query.set(key, value);
    }
  }

  const subPath = rest && rest.length > 0 ? `/${rest.join("/")}` : "";
  const suffix = query.toString();

  redirect(`/applications${subPath}${suffix ? `?${suffix}` : ""}`);
}
