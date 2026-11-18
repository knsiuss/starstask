import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { flattenSearchParams } from "@/lib/utils/search-params";

export const metadata: Metadata = {
  title: "Action center",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/**
 * The action center now lives at `/actions`. Old links and bookmarks keep
 * working with their filters intact.
 */
export default async function LegacyActionsRedirect({
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

  redirect(`/actions${suffix ? `?${suffix}` : ""}`);
}
