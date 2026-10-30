import "server-only";

import { isInvitationActive } from "@/lib/classes/invitation-status";
import { DataAccessError, type PaginatedResult } from "@/lib/db/assignments";
import { loadProfiles } from "@/lib/db/classes";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type {
  AssignmentReviewDecisionRow,
  AssignmentStatusRow,
  Json,
} from "@/types/database";

export type MyClassSubmission = {
  id: string;
  title: string;
  status: AssignmentStatusRow;
  deadline: string | null;
  revision: number;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
  class_id: string;
  class_slug: string;
  class_name: string;
};

/** The caller's own submissions in one class, newest first. */
export async function listMyClassSubmissions(
  userId: string,
  classId: string,
  limit = 20,
): Promise<MyClassSubmission[]> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("assignments")
    .select(
      "id, title, status, deadline, revision, rejection_reason, created_at, updated_at, class_id, classes!assignments_class_id_fkey ( slug, name )",
    )
    .eq("user_id", userId)
    .eq("class_id", classId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new DataAccessError("Could not load your submissions", error.code);
  }

  return (data ?? []).flatMap((row) => {
    if (!row.class_id || !row.classes) {
      return [];
    }

    return [
      {
        id: row.id,
        title: row.title,
        status: row.status,
        deadline: row.deadline,
        revision: row.revision,
        rejection_reason: row.rejection_reason,
        created_at: row.created_at,
        updated_at: row.updated_at,
        class_id: row.class_id,
        class_slug: row.classes.slug,
        class_name: row.classes.name,
      },
    ];
  });
}

export type SubmissionSubmitter = {
  id: string;
  display_name: string;
  avatar_url: string | null;
};

export type SubmissionAttachment = {
  id: string;
  storage_path: string;
  original_filename: string;
  mime_type: string;
  file_size: number;
  created_at: string;
};

export type SubmissionListItem = {
  id: string;
  title: string;
  description: string;
  status: AssignmentStatusRow;
  deadline: string | null;
  revision: number;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
  submitter: SubmissionSubmitter;
  attachment_count: number;
};

export type SubmissionDetail = SubmissionListItem & {
  class_id: string | null;
  published_at: string | null;
  reviewed_at: string | null;
  assignment_type: string | null;
  tags: string[];
  reference_urls: string[];
  attachments: SubmissionAttachment[];
};

export type AssignmentReviewEntry = {
  id: string;
  decision: AssignmentReviewDecisionRow;
  reason: string | null;
  created_at: string;
};

export type ClassDashboardCounts = {
  members: number;
  pendingReview: number;
  activeInvitations: number;
  published: number;
  unpublished: number;
};

export type PlatformDashboardCounts = {
  totalUsers: number;
  onboardedUsers: number;
  platformAdmins: number;
  pendingApplications: number;
  approvedApplications: number;
  rejectedApplications: number;
  activeClasses: number;
  archivedClasses: number;
  publishedAssignments: number;
  unpublishedAssignments: number;
  pendingReviews: number;
  pendingVerifications: number;
};

const SUBMISSION_COLUMNS =
  "id, title, description, status, deadline, revision, rejection_reason, created_at, updated_at, user_id, class_id, published_at, reviewed_at, assignment_type, tags, reference_urls";

/**
 * Review queue and class submission list.
 *
 * Visibility comes from `assignments_class_reviewer_read`: a class admin reads
 * every submission in their own class, and nothing outside it.
 */
export async function listClassSubmissions(options: {
  classId: string;
  status: AssignmentStatusRow;
  page: number;
  pageSize: number;
}): Promise<PaginatedResult<SubmissionListItem>> {
  const supabase = await createSupabaseServerClient();
  const offset = (options.page - 1) * options.pageSize;

  const { data, error, count } = await supabase
    .from("assignments")
    .select(SUBMISSION_COLUMNS, { count: "exact" })
    .eq("class_id", options.classId)
    .eq("status", options.status)
    .order("created_at", { ascending: true })
    .range(offset, offset + options.pageSize - 1);

  if (error) {
    throw new DataAccessError("Could not load submissions", error.code);
  }

  const rows = data ?? [];
  const [profiles, attachmentCounts] = await Promise.all([
    loadProfiles(rows.map((row) => row.user_id)),
    countAttachments(rows.map((row) => row.id)),
  ]);

  const items = rows.map((row) => ({
    id: row.id,
    title: row.title,
    description: row.description,
    status: row.status,
    deadline: row.deadline,
    revision: row.revision,
    rejection_reason: row.rejection_reason,
    created_at: row.created_at,
    updated_at: row.updated_at,
    submitter: toSubmitter(row.user_id, profiles),
    attachment_count: attachmentCounts.get(row.id) ?? 0,
  }));

  const total = count ?? 0;

  return {
    items,
    total,
    page: options.page,
    pageSize: options.pageSize,
    totalPages: Math.max(1, Math.ceil(total / options.pageSize)),
  };
}

export async function getSubmissionDetail(
  assignmentId: string,
): Promise<SubmissionDetail | null> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("assignments")
    .select(SUBMISSION_COLUMNS)
    .eq("id", assignmentId)
    .maybeSingle();

  if (error) {
    throw new DataAccessError("Could not load the submission", error.code);
  }

  if (!data) {
    return null;
  }

  const [profiles, attachments] = await Promise.all([
    loadProfiles([data.user_id]),
    loadSubmissionAttachments(assignmentId),
  ]);

  return {
    id: data.id,
    title: data.title,
    description: data.description,
    status: data.status,
    deadline: data.deadline,
    revision: data.revision,
    rejection_reason: data.rejection_reason,
    created_at: data.created_at,
    updated_at: data.updated_at,
    class_id: data.class_id,
    published_at: data.published_at,
    reviewed_at: data.reviewed_at,
    assignment_type: data.assignment_type,
    tags: data.tags,
    reference_urls: parseReferenceUrls(data.reference_urls),
    submitter: toSubmitter(data.user_id, profiles),
    attachment_count: attachments.length,
    attachments,
  };
}

export async function listSubmissionAttachments(
  assignmentId: string,
): Promise<SubmissionAttachment[]> {
  return loadSubmissionAttachments(assignmentId);
}

export async function listAssignmentReviews(
  assignmentId: string,
): Promise<AssignmentReviewEntry[]> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("assignment_reviews")
    .select("id, decision, reason, created_at")
    .eq("assignment_id", assignmentId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    throw new DataAccessError("Could not load review history", error.code);
  }

  return data ?? [];
}

export async function getClassDashboardCounts(
  classId: string,
): Promise<ClassDashboardCounts> {
  const supabase = await createSupabaseServerClient();
  const now = new Date();

  const [members, pendingReview, invitationRows, published, unpublished] =
    await Promise.all([
      countRows(
        supabase
          .from("class_members")
          .select("class_id", { count: "exact", head: true })
          .eq("class_id", classId),
      ),
      countRows(
        supabase
          .from("assignments")
          .select("id", { count: "exact", head: true })
          .eq("class_id", classId)
          .eq("status", "pending_review"),
      ),
      // PostgREST cannot compare two columns, so remaining uses are evaluated
      // here with the same helper the invitation manager uses.
      supabase
        .from("class_invitations")
        .select("expires_at, max_uses, used_count, revoked_at")
        .eq("class_id", classId),
      countRows(
        supabase
          .from("assignments")
          .select("id", { count: "exact", head: true })
          .eq("class_id", classId)
          .eq("status", "published"),
      ),
      countRows(
        supabase
          .from("assignments")
          .select("id", { count: "exact", head: true })
          .eq("class_id", classId)
          .eq("status", "unpublished"),
      ),
    ]);

  if (invitationRows.error) {
    throw new DataAccessError(
      "Could not count invitations",
      invitationRows.error.code,
    );
  }

  const activeInvitations = (invitationRows.data ?? []).filter((invitation) =>
    isInvitationActive(invitation, now),
  ).length;

  return { members, pendingReview, activeInvitations, published, unpublished };
}

export type PlatformModerationItem = {
  id: string;
  title: string;
  status: AssignmentStatusRow;
  updated_at: string;
  class_slug: string;
  class_name: string;
  submitter: SubmissionSubmitter;
  attachment_count: number;
};

/**
 * Platform-wide moderation queue for class assignments.
 *
 * Platform admins can read every class assignment through the reviewer policy;
 * unpublished and archived rows stay hidden from the public.
 */
export async function listPlatformModerationQueue(
  limit = 10,
): Promise<PlatformModerationItem[]> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("assignments")
    .select(
      "id, title, status, updated_at, user_id, classes!assignments_class_id_fkey ( slug, name )",
    )
    .not("class_id", "is", null)
    .in("status", ["published", "unpublished", "archived"])
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new DataAccessError(
      "Could not load the moderation queue",
      error.code,
    );
  }

  const rows = data ?? [];
  const [profiles, attachmentCounts] = await Promise.all([
    loadProfiles(rows.map((row) => row.user_id)),
    countAttachments(rows.map((row) => row.id)),
  ]);

  return rows.flatMap((row) => {
    if (!row.classes) {
      return [];
    }

    return [
      {
        id: row.id,
        title: row.title,
        status: row.status,
        updated_at: row.updated_at,
        class_slug: row.classes.slug,
        class_name: row.classes.name,
        submitter: toSubmitter(row.user_id, profiles),
        attachment_count: attachmentCounts.get(row.id) ?? 0,
      },
    ];
  });
}

/**
 * Authoritative platform counters, computed in one database round trip.
 *
 * Definitions matter for the console labels:
 *   totalUsers            profiles rows provisioned for an auth account
 *   publishedAssignments  every public assignment, class or standalone
 *   pendingReviews        class submissions awaiting a class admin decision
 *   pendingVerifications  submitted class representative requests
 */
export async function getPlatformDashboardCounts(): Promise<PlatformDashboardCounts> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("get_platform_admin_overview");

  if (error) {
    throw new DataAccessError("Could not load platform counts", error.code);
  }

  const row = data?.[0];

  if (!row) {
    throw new DataAccessError("Could not load platform counts", "PGRST116");
  }

  return {
    totalUsers: Number(row.total_users),
    onboardedUsers: Number(row.onboarded_users),
    platformAdmins: Number(row.platform_admins),
    pendingApplications: Number(row.pending_applications),
    approvedApplications: Number(row.approved_applications),
    rejectedApplications: Number(row.rejected_applications),
    activeClasses: Number(row.active_classes),
    archivedClasses: Number(row.archived_classes),
    publishedAssignments: Number(row.published_assignments),
    unpublishedAssignments: Number(row.unpublished_assignments),
    pendingReviews: Number(row.pending_reviews),
    pendingVerifications: Number(row.pending_verifications),
  };
}

async function loadSubmissionAttachments(
  assignmentId: string,
): Promise<SubmissionAttachment[]> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("assignment_attachments")
    .select(
      "id, storage_path, original_filename, mime_type, file_size, created_at",
    )
    .eq("assignment_id", assignmentId)
    .order("created_at", { ascending: true });

  if (error) {
    throw new DataAccessError("Could not load attachments", error.code);
  }

  return data ?? [];
}

async function countAttachments(
  assignmentIds: string[],
): Promise<Map<string, number>> {
  if (assignmentIds.length === 0) {
    return new Map();
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("assignment_attachments")
    .select("assignment_id")
    .in("assignment_id", assignmentIds);

  if (error) {
    throw new DataAccessError("Could not count attachments", error.code);
  }

  const counts = new Map<string, number>();

  for (const row of data ?? []) {
    counts.set(row.assignment_id, (counts.get(row.assignment_id) ?? 0) + 1);
  }

  return counts;
}

function parseReferenceUrls(value: Json): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((entry): entry is string => typeof entry === "string");
}

function toSubmitter(
  userId: string,
  profiles: Awaited<ReturnType<typeof loadProfiles>>,
): SubmissionSubmitter {
  const profile = profiles.get(userId);

  return {
    id: userId,
    display_name: profile?.display_name ?? "StarsTask member",
    avatar_url: profile?.avatar_url ?? null,
  };
}

type CountQuery = PromiseLike<{
  count: number | null;
  error: { code?: string } | null;
}>;

async function countRows(query: CountQuery): Promise<number> {
  const { count, error } = await query;

  if (error) {
    throw new DataAccessError("Could not load counts", error.code);
  }

  return count ?? 0;
}
