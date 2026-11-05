import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { DataAccessError } from "@/lib/db/assignments";
import type { Database, Json } from "@/types/database";

export type AuditEntry = {
  actorId: string;
  action: string;
  entityType: string;
  entityId: string | null;
  classId: string | null;
  universityId: string | null;
  metadata?: Record<string, Json>;
};

/**
 * Appends an audit row through an already-authorized service-role client.
 *
 * Audit failure aborts the surrounding operation with a 500: an admin action
 * that cannot be audited must not report success. Callers run this AFTER the
 * mutation, so a failure here means the mutation committed but the audit did
 * not — the error message says so rather than claiming rollback.
 */
export async function recordServiceRoleAudit(
  client: SupabaseClient<Database>,
  entry: AuditEntry,
): Promise<void> {
  const { error } = await client.from("audit_logs").insert({
    actor_id: entry.actorId,
    action: entry.action,
    entity_type: entry.entityType,
    entity_id: entry.entityId,
    class_id: entry.classId,
    university_id: entry.universityId,
    metadata: entry.metadata ?? {},
  });

  if (error) {
    throw new DataAccessError(
      "The action was applied but its audit record could not be written",
      error.code,
    );
  }
}
