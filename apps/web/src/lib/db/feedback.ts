import "server-only";

import type {
  FeedbackCategory,
  FeedbackStatus,
  FeedbackSubmission,
} from "@starstask/contracts";

import { DataAccessError } from "@/lib/db/assignments";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { FeedbackCategoryRow, FeedbackStatusRow } from "@/types/database";

export type FeedbackEntry = {
  id: string;
  category: FeedbackCategory;
  message: string;
  pagePath: string | null;
  status: FeedbackStatus;
  createdAt: string;
  updatedAt: string;
};

type FeedbackRow = {
  id: string;
  category: FeedbackCategoryRow;
  message: string;
  page_path: string | null;
  status: FeedbackStatusRow;
  created_at: string;
  updated_at: string;
};

const FEEDBACK_COLUMNS =
  "id, category, message, page_path, status, created_at, updated_at";

const DEFAULT_QUEUE_LIMIT = 100;

function toEntry(row: FeedbackRow): FeedbackEntry {
  return {
    id: row.id,
    category: row.category,
    message: row.message,
    pagePath: row.page_path,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function createFeedback(
  userId: string,
  input: FeedbackSubmission,
): Promise<FeedbackEntry> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("feedback_entries")
    .insert({
      user_id: userId,
      category: input.category,
      message: input.message,
      page_path: input.pagePath ?? null,
    })
    .select(FEEDBACK_COLUMNS)
    .single();

  if (error || !data) {
    throw new DataAccessError(
      "Could not save feedback",
      error?.code ?? "insert_failed",
    );
  }

  return toEntry(data);
}

export async function listMyFeedback(
  userId: string,
  limit = 5,
): Promise<FeedbackEntry[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("feedback_entries")
    .select(FEEDBACK_COLUMNS)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new DataAccessError("Could not load feedback", error.code);
  }

  return (data ?? []).map(toEntry);
}

export async function listFeedbackForReview(
  limit = DEFAULT_QUEUE_LIMIT,
): Promise<FeedbackEntry[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("feedback_entries")
    .select(FEEDBACK_COLUMNS)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new DataAccessError("Could not load the feedback queue", error.code);
  }

  return (data ?? []).map(toEntry);
}

export async function updateFeedbackStatus(
  id: string,
  status: FeedbackStatus,
): Promise<boolean> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("feedback_entries")
    .update({ status })
    .eq("id", id)
    .select("id")
    .maybeSingle();

  if (error) {
    throw new DataAccessError("Could not update feedback", error.code);
  }

  return Boolean(data);
}
