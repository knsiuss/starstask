import "server-only";

import { DataAccessError } from "@/lib/db/assignments";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type ActiveUniversityRow = {
  id: string;
  slug: string;
  name: string;
  shortName: string | null;
  type: string | null;
  city: string | null;
  country: string | null;
  website: string | null;
  timezone: string | null;
};

/**
 * Universities the caller may learn about. RLS exposes status = 'active'
 * rows only; registered/pending/suspended/inactive rows are unreachable by
 * design and are never fetched with elevated privileges.
 */
export async function listActiveUniversities(): Promise<ActiveUniversityRow[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("universities")
    .select(
      "id, slug, name, short_name, type, city, country, website, timezone",
    )
    .eq("status", "active")
    .order("name", { ascending: true });

  if (error) {
    throw new DataAccessError("Could not load universities", error.code);
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    slug: row.slug,
    name: row.name,
    shortName: row.short_name,
    type: row.type,
    city: row.city,
    country: row.country,
    website: row.website,
    timezone: row.timezone,
  }));
}
