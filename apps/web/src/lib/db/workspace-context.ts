import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export type WorkspaceContext = {
  platformAdmin: boolean;
  classAdminAnywhere: boolean;
  unreadNotifications: number;
  betaTester: boolean;
  lecturerAnywhere: boolean;
  universityAdminUniversities: string[];
};

/**
 * Workspace layout context in 1 RPC roundtrip (20261158000000).
 * Returns null on failure so callers fall back to legacy multi-query.
 */
export async function getWorkspaceContext(): Promise<WorkspaceContext | null> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc(
      "get_workspace_context" as never,
      {} as never,
    );

    if (error || !data) {
      return null;
    }

    const context = data as unknown as {
      platform_admin?: unknown;
      class_admin_anywhere?: unknown;
      unread_notifications?: unknown;
      beta_tester?: unknown;
      lecturer_anywhere?: unknown;
      university_admin_universities?: unknown;
    };

    const adminUniversities = Array.isArray(
      context.university_admin_universities,
    )
      ? context.university_admin_universities.filter(
          (id): id is string => typeof id === "string",
        )
      : [];

    return {
      platformAdmin: context.platform_admin === true,
      classAdminAnywhere: context.class_admin_anywhere === true,
      unreadNotifications:
        typeof context.unread_notifications === "number"
          ? context.unread_notifications
          : 0,
      betaTester: context.beta_tester === true,
      lecturerAnywhere: context.lecturer_anywhere === true,
      universityAdminUniversities: adminUniversities,
    };
  } catch {
    return null;
  }
}
