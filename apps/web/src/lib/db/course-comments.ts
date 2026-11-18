import "server-only";

import type {
  CourseCommentCreateInput,
  CourseCommentView,
} from "@starstask/contracts";

import { DataAccessError } from "@/lib/db/assignments";
import { createCourseMediaSignedUrls } from "@/lib/storage/course-media";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type ProfileLookup = Map<string, { name: string; avatarUrl: string | null }>;

async function loadAuthorProfiles(authorIds: string[]): Promise<ProfileLookup> {
  const map: ProfileLookup = new Map();
  const unique = [...new Set(authorIds.filter(Boolean))];

  if (unique.length === 0) {
    return map;
  }

  try {
    const admin = createSupabaseAdminClient();
    const { data } = await admin
      .from("profiles")
      .select("id, display_name, avatar_url")
      .in("id", unique);

    for (const row of data ?? []) {
      const displayName = row.display_name?.trim() || "Class member";
      map.set(row.id, {
        name: displayName,
        avatarUrl: row.avatar_url ?? null,
      });
    }
  } catch {
    return map;
  }

  return map;
}

function normalizeReactions(raw: unknown): Record<string, string[]> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return {};
  }

  const result: Record<string, string[]> = {};

  for (const [emoji, users] of Object.entries(raw as Record<string, unknown>)) {
    if (Array.isArray(users)) {
      const valid = users.filter((id): id is string => typeof id === "string");

      if (valid.length > 0) {
        result[emoji] = valid;
      }
    }
  }

  return result;
}

export async function listCourseComments(params: {
  classId: string;
  subjectId: string;
  viewerId: string;
  canManage: boolean;
}): Promise<CourseCommentView[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("course_comments")
    .select(
      "id, subject_id, meeting_number, parent_id, author_id, body, image_path, reactions, created_at",
    )
    .eq("class_id", params.classId)
    .eq("subject_id", params.subjectId)
    .order("created_at", { ascending: true })
    .limit(200);

  if (error) {
    throw new DataAccessError("Could not load comments", error.code);
  }

  const rows = data ?? [];
  const expectedPrefix = `${params.classId}/${params.subjectId}/comments/`;
  const [profiles, signedUrls] = await Promise.all([
    loadAuthorProfiles(rows.map((row) => row.author_id)),
    createCourseMediaSignedUrls(
      rows
        .map((row) => row.image_path)
        .filter(
          (path): path is string =>
            typeof path === "string" &&
            path.startsWith(expectedPrefix) &&
            !path.includes("..") &&
            !path.includes("\\"),
        ),
    ),
  ]);

  return rows.map((row) => {
    const profile = profiles.get(row.author_id);

    return {
      id: row.id,
      subject_id: row.subject_id,
      meeting_number: row.meeting_number ?? null,
      parent_id: row.parent_id ?? null,
      author_id: row.author_id,
      author_name: profile?.name ?? "Class member",
      author_avatar_url: profile?.avatarUrl ?? null,
      body: row.body,
      image_url: row.image_path
        ? (signedUrls.get(row.image_path) ?? null)
        : null,
      reactions: normalizeReactions(row.reactions),
      created_at: row.created_at,
      can_delete: params.canManage || row.author_id === params.viewerId,
    };
  });
}

export async function createCourseComment(params: {
  classId: string;
  subjectId: string;
  authorId: string;
  input: CourseCommentCreateInput;
  imagePath?: string | null;
  imageMime?: string | null;
}): Promise<string> {
  const supabase = await createSupabaseServerClient();

  if (params.input.parentId) {
    const { data: parent, error: parentError } = await supabase
      .from("course_comments")
      .select("id")
      .eq("id", params.input.parentId)
      .eq("class_id", params.classId)
      .eq("subject_id", params.subjectId)
      .maybeSingle();

    if (parentError) {
      throw new DataAccessError(
        "Could not verify parent comment",
        parentError.code,
      );
    }

    if (!parent) {
      throw new DataAccessError("Parent comment not found", "P0002");
    }
  }

  const { data, error } = await supabase
    .from("course_comments")
    .insert({
      class_id: params.classId,
      subject_id: params.subjectId,
      meeting_number: params.input.meetingNumber ?? null,
      parent_id: params.input.parentId ?? null,
      author_id: params.authorId,
      body: params.input.body,
      image_path: params.imagePath ?? null,
      image_mime: params.imageMime ?? null,
    })
    .select("id")
    .single();

  if (error || !data) {
    throw new DataAccessError("Could not post comment", error?.code);
  }

  return data.id;
}

export async function deleteCourseComment(params: {
  classId: string;
  subjectId: string;
  commentId: string;
}): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("course_comments")
    .delete()
    .eq("id", params.commentId)
    .eq("class_id", params.classId)
    .eq("subject_id", params.subjectId);

  if (error) {
    throw new DataAccessError("Could not delete comment", error.code);
  }
}

export async function toggleCourseCommentReaction(params: {
  classId: string;
  subjectId: string;
  commentId: string;
  userId: string;
  emoji: string;
}): Promise<Record<string, string[]>> {
  const admin = createSupabaseAdminClient();
  const maxAttempts = 3;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const { data: existing, error: readError } = await admin
      .from("course_comments")
      .select("id, reactions")
      .eq("id", params.commentId)
      .eq("class_id", params.classId)
      .eq("subject_id", params.subjectId)
      .maybeSingle();

    if (readError || !existing) {
      throw new DataAccessError(
        "Comment not found",
        readError?.code ?? "P0002",
      );
    }

    const reactions = normalizeReactions(existing.reactions);
    const current = new Set(reactions[params.emoji] ?? []);

    if (current.has(params.userId)) {
      current.delete(params.userId);
    } else {
      current.add(params.userId);
    }

    if (current.size === 0) {
      delete reactions[params.emoji];
    } else {
      reactions[params.emoji] = [...current];
    }

    let updateQuery = admin
      .from("course_comments")
      .update({ reactions })
      .eq("id", params.commentId)
      .eq("class_id", params.classId);

    updateQuery =
      existing.reactions === null
        ? updateQuery.is("reactions", null)
        : updateQuery.eq("reactions", existing.reactions);

    const { data: updated, error: updateError } =
      await updateQuery.select("id");

    if (updateError) {
      throw new DataAccessError("Could not update reaction", updateError.code);
    }

    if (updated && updated.length > 0) {
      return reactions;
    }
  }

  throw new DataAccessError("Could not update reaction", "40900");
}
