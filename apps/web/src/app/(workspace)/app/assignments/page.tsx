import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { flattenSearchParams } from "@/lib/utils/search-params";

export const metadata: Metadata = {
  title: "Assignments",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/**
 * The member workspace moved to `/assignments`. Old links (stat cards, bookmarks)
 * keep working: filters ride along to the new address.
 */
export default async function DashboardAssignmentsRedirect({
  searchParams,
}: PageProps) {
  const flat = flattenSearchParams(await searchParams);
  const query = new URLSearchParams();

  for (const [key, value] of Object.entries(flat)) {
    if (value) {
      query.set(key, value);
    }
  }

  const suffix = query.toString();

  redirect(`/assignments${suffix ? `?${suffix}` : ""}`);
}
