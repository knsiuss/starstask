import "server-only";

import type {
  LeaveFieldSource,
  LeaveRequestCreateInput,
  LeaveRequestUpdateInput,
} from "@starstask/contracts";

import { ApiError } from "@/lib/api/errors";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { toLeaveApiError } from "@/features/leave/errors";

/**
 * Workflow mutations.
 *
 * Each call is a single RPC. Authorization, status validation, history, and
 * notifications all happen inside the database function, so a route cannot
 * bypass them by omitting a check.
 */

export async function createLeaveRequest(
  input: LeaveRequestCreateInput,
): Promise<{ id: string; reference: string }> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("create_leave_request", {
    p_class_id: input.classId,
    p_leave_start_date: input.leaveStartDate,
    p_leave_end_date: input.leaveEndDate,
    p_reason_category: input.reasonCategory,
    p_explanation: input.explanation,
    p_document_issue_date: input.documentIssueDate,
  });

  if (error) {
    throw toLeaveApiError(error, "Could not create the absence request.");
  }

  const created = data?.[0];

  if (!created) {
    throw new ApiError(
      500,
      "internal_error",
      "Could not create the absence request.",
    );
  }

  return { id: created.id, reference: created.reference };
}

export async function updateLeaveRequest(
  requestId: string,
  input: LeaveRequestUpdateInput,
): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("update_leave_request", {
    p_request_id: requestId,
    p_leave_start_date: input.leaveStartDate,
    p_leave_end_date: input.leaveEndDate,
    p_reason_category: input.reasonCategory,
    p_explanation: input.explanation,
    p_document_issue_date: input.documentIssueDate,
  });

  if (error) {
    throw toLeaveApiError(error, "Could not save the absence request.");
  }
}

export async function submitLeaveRequest(requestId: string): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("submit_leave_request", {
    p_request_id: requestId,
  });

  if (error) {
    throw toLeaveApiError(error, "Could not submit the absence request.");
  }
}

/**
 * Cancels a request that has not been forwarded yet.
 *
 * A student may cancel their own draft or submitted request; a class admin may
 * cancel a submitted one. Once forwarded, the request is the lecturer's to
 * decide and StarsTask no longer changes it.
 */
export async function cancelLeaveRequest(
  requestId: string,
  note: string | null,
): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("cancel_leave_request", {
    p_request_id: requestId,
    p_note: note,
  });

  if (error) {
    throw toLeaveApiError(error, "Could not cancel the absence request.");
  }
}

/**
 * Records which values the student confirmed after extraction.
 *
 * Separate from `updateLeaveRequest` because confirmation is about provenance,
 * not about the values: the student may confirm without changing anything.
 */
export async function confirmLeaveOcr(
  requestId: string,
  fieldSources: Record<string, LeaveFieldSource>,
): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("confirm_leave_request_ocr", {
    p_request_id: requestId,
    p_field_sources: fieldSources,
  });

  if (error) {
    throw toLeaveApiError(error, "Could not confirm the extracted values.");
  }
}
