import { cache } from "react";

import { createClient } from "@supabase/supabase-js";

import { isUnpamPluginEnabled } from "@/features/plugins/unpam/config";
import { isSupabaseConfigured } from "@/lib/env/public";

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

/** Global kill-switch (env) checked first — if off, plugin is off everywhere. */
export function isPluginGloballyEnabled(): boolean {
  return isUnpamPluginEnabled();
}

/**
 * Registry gate: does user have active membership in UNPAM?
 * Falls back to legacy free-text check for backwards compat during transition.
 * Pass userId + profileUniversity text.
 */
export const isUnpamMember = cache(
  async (
    userId: string | null,
    profileUniversity: string | null | undefined,
  ): Promise<boolean> => {
    const { isUnpamUniversity } =
      await import("@/features/plugins/unpam/config");
    if (!userId || !isSupabaseConfigured()) {
      return isUnpamUniversity(profileUniversity);
    }
    const client = adminClient();
    if (!client) return isUnpamUniversity(profileUniversity);
    const { data } = await client
      .from("university_memberships")
      .select("university_id, universities!inner(slug)")
      .eq("user_id", userId)
      .eq("status", "active")
      .eq("universities.slug", "universitas-pamulang")
      .limit(1);
    if (data && data.length > 0) return true;
    // Fallback during transition: legacy text still honored until all users migrated
    return isUnpamUniversity(profileUniversity);
  },
);

export type PluginEventRow = {
  title: string;
  startsAt: string;
  endsAt: string | null;
  location: string | null;
  description: string | null;
  sourceUrl: string | null;
  programId: "ti" | "manajemen" | "semua";
  kind: "academic-calendar" | "e-learning" | "events";
};

/** Search persisted plugin events (text + date range). */
export async function searchPersistedUnpamEvents(
  query: string,
  from?: string,
  to?: string,
): Promise<PluginEventRow[]> {
  const all = await getPersistedUnpamEvents();
  const q = query.trim().toLowerCase();
  return all.filter((e) => {
    if (q && !`${e.title} ${e.description ?? ""}`.toLowerCase().includes(q))
      return false;
    if (from && e.startsAt < from) return false;
    if (to && e.startsAt > to) return false;
    return true;
  });
}

/** Read persisted plugin events for UNPAM (newest first). Empty = not synced yet. */
export async function getPersistedUnpamEvents(): Promise<PluginEventRow[]> {
  if (!isSupabaseConfigured()) return [];
  const client = adminClient();
  if (!client) return [];
  const { data: uni } = await client
    .from("universities")
    .select("id")
    .eq("slug", "universitas-pamulang")
    .maybeSingle();
  if (!uni) return [];
  const { data } = await client
    .from("plugin_events")
    .select(
      "title, starts_at, ends_at, location, description, source_url, program_id, kind",
    )
    .eq("university_id", uni.id)
    .eq("plugin_id", "unpam")
    .order("starts_at", { ascending: true })
    .limit(100);
  return (data ?? []).map((r) => ({
    title: r.title,
    startsAt: r.starts_at,
    endsAt: r.ends_at,
    location: r.location,
    description: r.description,
    sourceUrl: r.source_url,
    programId: r.program_id,
    kind: r.kind,
  }));
}

/** Persist fetched plugin events (upsert by content hash) + sync status. Service-role only (cron). */
export async function persistUnpamEvents(
  events: PluginEventRow[],
  error?: string,
): Promise<{ count: number }> {
  const client = adminClient();
  if (!client) return { count: 0 };
  const { data: uni } = await client
    .from("universities")
    .select("id")
    .eq("slug", "universitas-pamulang")
    .maybeSingle();
  if (!uni) return { count: 0 };
  const hash = (s: string) =>
    Buffer.from(s)
      .toString("base64")
      .replace(/[^A-Za-z0-9]/g, "")
      .slice(0, 32);
  const now = new Date().toISOString();
  if (events.length > 0) {
    const rows = events.map((e) => ({
      university_id: uni.id,
      plugin_id: "unpam",
      kind: e.kind,
      title: e.title,
      starts_at: e.startsAt,
      ends_at: e.endsAt,
      location: e.location,
      description: e.description,
      source_url: e.sourceUrl,
      program_id: e.programId,
      content_hash: hash(`${e.kind}|${e.title}|${e.startsAt}`),
      last_seen_at: now,
    }));
    const { error: upsertError } = await client
      .from("plugin_events")
      .upsert(rows, { onConflict: "university_id,plugin_id,content_hash" });
    if (upsertError) throw upsertError;
  }
  await client.from("plugin_sync_status").upsert(
    {
      university_id: uni.id,
      plugin_id: "unpam",
      last_attempt_at: now,
      last_success_at: error ? null : now,
      event_count: events.length,
      last_error: error ?? null,
    },
    { onConflict: "university_id,plugin_id" },
  );
  return { count: events.length };
}

/** Observability views (dual_write_drift, nim_drift, tenant_gap) via admin client. */
export async function getObservabilityViews() {
  const client = adminClient();
  if (!client) return { drift: null, nim: null, gap: [] as never[] };
  const [drift, nim, gap] = await Promise.all([
    client
      .from("dual_write_drift" as never)
      .select("*")
      .maybeSingle(),
    client
      .from("nim_drift" as never)
      .select("*")
      .maybeSingle(),
    client.from("observability_tenant_gap" as never).select("*"),
  ]);
  return {
    drift: (drift as { data: unknown }).data,
    nim: (nim as { data: unknown }).data,
    gap: ((gap as { data: unknown[] }).data ?? []) as never[],
  };
}

export async function getUnpamSyncStatus() {
  const client = adminClient();
  if (!client) return null;
  const { data: uni } = await client
    .from("universities")
    .select("id")
    .eq("slug", "universitas-pamulang")
    .maybeSingle();
  if (!uni) return null;
  const { data } = await client
    .from("plugin_sync_status")
    .select("last_attempt_at, last_success_at, event_count, last_error")
    .eq("university_id", uni.id)
    .eq("plugin_id", "unpam")
    .maybeSingle();
  return data;
}

/** Auto program from academic unit: Teknik Informatika -> ti, Manajemen -> manajemen. */
export async function getMyProgramId(
  userId: string | null,
): Promise<"ti" | "manajemen" | "semua"> {
  if (!userId) return "semua";
  const client = adminClient();
  if (!client) return "semua";
  const { data: memberships } = await client
    .from("university_memberships")
    .select("id")
    .eq("user_id", userId)
    .eq("status", "active")
    .limit(5);
  const ids = (memberships ?? []).map((m) => m.id);
  if (ids.length === 0) return "semua";
  const { data: identities } = await client
    .from("student_identities")
    .select("academic_unit_id")
    .in("university_membership_id", ids)
    .not("academic_unit_id", "is", null)
    .limit(1);
  const unitId = identities?.[0]?.academic_unit_id;
  if (!unitId) return "semua";
  const { data: unit } = await client
    .from("academic_units")
    .select("name")
    .eq("id", unitId)
    .maybeSingle();
  const name = (unit?.name ?? "").toLowerCase();
  if (name.includes("informatika")) return "ti";
  if (name.includes("manajemen")) return "manajemen";
  return "semua";
}
