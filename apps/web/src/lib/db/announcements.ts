import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { DataAccessError } from "@/lib/db/assignments";
import { recordServiceRoleAudit } from "@/lib/db/audit";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

type ServiceClient = SupabaseClient<Database>;

export type AnnouncementRow = {
  id: string;
  offeringId: string | null;
  authorId: string;
  authorName: string | null;
  title: string;
  body: string;
  pinned: boolean;
  publishedAt: string | null;
  archivedAt: string | null;
  createdAt: string;
  /** Present only when the caller supplied their read markers. */
  readAt: string | null;
};

/**
 * Class announcements visible to the caller under RLS. Members see published
 * rows; the query deliberately mirrors that so drafts never leak into member
 * views. Managers use the service-role list which includes drafts.
 */
export async function listPublishedAnnouncements(
  classId: string,
  viewerUserId: string,
): Promise<AnnouncementRow[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("announcements")
    .select(
      "id, offering_id, author, title, body, pinned, published_at, archived_at, created_at",
    )
    .eq("class_id", classId)
    .not("published_at", "is", null)
    .is("archived_at", null)
    .order("pinned", { ascending: false })
    .order("published_at", { ascending: false });

  if (error) {
    throw new DataAccessError("Could not load announcements", error.code);
  }

  const rows = data ?? [];

  if (rows.length === 0) {
    return [];
  }

  const { data: readRows, error: readError } = await supabase
    .from("announcement_reads")
    .select("announcement_id, read_at")
    .eq("user_id", viewerUserId)
    .in(
      "announcement_id",
      rows.map((row) => row.id),
    );

  if (readError) {
    throw new DataAccessError("Could not load read markers", readError.code);
  }

  const readByAnnouncement = new Map(
    (readRows ?? []).map((row) => [row.announcement_id, row.read_at]),
  );

  return rows.map((row) => ({
    id: row.id,
    offeringId: row.offering_id,
    authorId: row.author,
    authorName: null,
    title: row.title,
    body: row.body,
    pinned: row.pinned,
    publishedAt: row.published_at,
    archivedAt: row.archived_at,
    createdAt: row.created_at,
    readAt: readByAnnouncement.get(row.id) ?? null,
  }));
}

/**
 * Full list for managers (includes drafts and archived rows). Server-side
 * only; the caller must already hold manage_announcements.
 */
export async function listAllAnnouncements(
  client: ServiceClient,
  classId: string,
): Promise<AnnouncementRow[]> {
  const { data, error } = await client
    .from("announcements")
    .select(
      "id, offering_id, author, title, body, pinned, published_at, archived_at, created_at",
    )
    .eq("class_id", classId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new DataAccessError("Could not load announcements", error.code);
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    offeringId: row.offering_id,
    authorId: row.author,
    authorName: null,
    title: row.title,
    body: row.body,
    pinned: row.pinned,
    publishedAt: row.published_at,
    archivedAt: row.archived_at,
    createdAt: row.created_at,
    readAt: null,
  }));
}

export type CreateAnnouncementInput = {
  title: string;
  body: string;
  offeringId?: string | null | undefined;
  pinned: boolean;
  publish: boolean;
};

export async function createAnnouncement(
  client: ServiceClient,
  actorId: string,
  classId: string,
  universityId: string,
  input: CreateAnnouncementInput,
): Promise<{ announcementId: string }> {
  if (input.offeringId) {
    const { data: offering, error: offeringError } = await client
      .from("course_offerings")
      .select("id")
      .eq("id", input.offeringId)
      .eq("class_id", classId)
      .eq("university_id", universityId)
      .maybeSingle();

    if (offeringError) {
      throw new DataAccessError(
        "Could not verify the offering",
        offeringError.code,
      );
    }

    if (!offering) {
      throw new InvalidOfferingError();
    }
  }

  const { data, error } = await client
    .from("announcements")
    .insert({
      university_id: universityId,
      class_id: classId,
      offering_id: input.offeringId ?? null,
      author: actorId,
      title: input.title,
      body: input.body,
      pinned: input.pinned,
      published_at: input.publish ? new Date().toISOString() : null,
    })
    .select("id")
    .single();

  if (error) {
    throw new DataAccessError("Could not create the announcement", error.code);
  }

  const announcementId = data.id as string;

  await recordServiceRoleAudit(client, {
    actorId,
    action: "announcement_created",
    entityType: "announcement",
    entityId: announcementId,
    classId,
    universityId,
    metadata: {
      publish: input.publish,
      pinned: input.pinned,
      offering_id: input.offeringId ?? null,
    },
  });

  return { announcementId };
}

export type UpdateAnnouncementInput = {
  title?: string;
  body?: string;
  pinned?: boolean;
  publish?: boolean;
  archive?: boolean;
};

/**
 * Applies a partial edit. Scoped to the class — an announcement of another
 * class is indistinguishable from a missing one.
 */
export async function updateAnnouncement(
  client: ServiceClient,
  actorId: string,
  classId: string,
  universityId: string,
  announcementId: string,
  input: UpdateAnnouncementInput,
): Promise<"updated" | "not_found"> {
  const { data: existing, error: loadError } = await client
    .from("announcements")
    .select("id, published_at, archived_at")
    .eq("id", announcementId)
    .eq("class_id", classId)
    .eq("university_id", universityId)
    .maybeSingle();

  if (loadError) {
    throw new DataAccessError(
      "Could not load the announcement",
      loadError.code,
    );
  }

  if (!existing) {
    return "not_found";
  }

  const patch: Database["public"]["Tables"]["announcements"]["Update"] = {};

  if (input.title !== undefined) patch.title = input.title;
  if (input.body !== undefined) patch.body = input.body;
  if (input.pinned !== undefined) patch.pinned = input.pinned;
  if (input.publish === true && !existing.published_at) {
    patch.published_at = new Date().toISOString();
    patch.archived_at = null;
  }
  if (input.archive === true) {
    patch.archived_at = new Date().toISOString();
  }

  if (Object.keys(patch).length === 0) {
    return "updated";
  }

  const { error: updateError } = await client
    .from("announcements")
    .update(patch)
    .eq("id", existing.id)
    .eq("class_id", classId)
    .eq("university_id", universityId);

  if (updateError) {
    throw new DataAccessError(
      "Could not update the announcement",
      updateError.code,
    );
  }

  await recordServiceRoleAudit(client, {
    actorId,
    action: "announcement_updated",
    entityType: "announcement",
    entityId: existing.id,
    classId,
    universityId,
    metadata: { fields: Object.keys(patch) },
  });

  return "updated";
}

/**
 * Idempotent read marker, written through the service path after the route
 * verified the announcement is visible to the caller under RLS.
 */
export async function recordAnnouncementRead(
  client: ServiceClient,
  userId: string,
  announcementId: string,
  universityId: string,
): Promise<void> {
  const { error } = await client.from("announcement_reads").upsert(
    {
      university_id: universityId,
      announcement_id: announcementId,
      user_id: userId,
    },
    { onConflict: "announcement_id,user_id", ignoreDuplicates: true },
  );

  if (error) {
    throw new DataAccessError("Could not record the read marker", error.code);
  }
}

export class InvalidOfferingError extends Error {
  constructor() {
    super("The offering does not belong to this class.");
    this.name = "InvalidOfferingError";
  }
}
