import "server-only";

import { ApiError } from "@/lib/api/errors";
import { AVATAR_BUCKET } from "@/lib/storage/avatars";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  createSupabaseAdminClient,
  isServiceRoleConfigured,
} from "@/lib/supabase/admin";
import type { SessionUser } from "@/lib/auth/session";
import type {
  DeactivateAccountInput,
  DeleteAccountInput,
} from "@/features/account/account-schemas";
import {
  quietly,
  readLifecycleStatus,
  requireSessionId,
  toAccountApiError,
} from "@/features/account/account-lifecycle-shared";
import type { RpcResult } from "@/features/account/account-lifecycle-shared";

export type AccountDeactivateResult = {
  status: "deactivated";
  deactivatedAt: string;
};
export type AccountReactivateResult = { status: "active"; deactivatedAt: null };
export type AccountDeleteResult = {
  status: "deleted";
  deletedAt: string;
  authBanned: boolean;
  avatarsRemoved: number;
  cleanup: Record<string, number | null>;
  signoutPath: string;
};

// Runs one lifecycle RPC; `rpc` is narrowed locally because the hand-maintained
// Database type does not know these functions yet (T1's migration is unapplied).
async function lifecycleRpc(
  fn: string,
  args: Record<string, unknown>,
  fallbackMessage: string,
): Promise<RpcResult> {
  try {
    const supabase = await createSupabaseServerClient();
    const rpc = supabase.rpc.bind(supabase) as unknown as (
      f: string,
      a: Record<string, unknown>,
    ) => Promise<RpcResult>;
    const result = await rpc(fn, args);

    if (result.error) {
      throw toAccountApiError(result.error, fallbackMessage);
    }

    return result;
  } catch (error) {
    throw toAccountApiError(error, fallbackMessage);
  }
}

export async function deactivateMyAccount(
  session: SessionUser,
  input: DeactivateAccountInput,
): Promise<AccountDeactivateResult> {
  requireSessionId(session);

  const { data } = await lifecycleRpc(
    "deactivate_my_account",
    { p_reason: input.reason ?? null },
    "Could not deactivate your account. Try again.",
  );

  const payload = readLifecycleStatus(
    data,
    "deactivated",
    "Could not deactivate your account. Try again.",
  );

  return { status: "deactivated", deactivatedAt: payload.deactivatedAt ?? "" };
}

export async function reactivateMyAccount(
  session: SessionUser,
): Promise<AccountReactivateResult> {
  requireSessionId(session);

  const { data } = await lifecycleRpc(
    "reactivate_my_account",
    {},
    "Could not reactivate your account. Try again.",
  );

  readLifecycleStatus(
    data,
    "active",
    "Could not reactivate your account. Try again.",
  );

  return { status: "active", deactivatedAt: null };
}

// Tombstone: RPC deletes PII, then ban the auth user, remove avatars, and
// best-effort delete personal-data rows. Cleanup failures never fail the call.
export async function tombstoneMyAccount(
  session: SessionUser,
  input: DeleteAccountInput,
): Promise<AccountDeleteResult> {
  const userId = requireSessionId(session);

  if (!isServiceRoleConfigured()) {
    throw new ApiError(
      503,
      "service_not_configured",
      "Account deletion is not configured on this deployment.",
    );
  }

  const sessionEmail = session.user.email?.toLowerCase();

  if (!sessionEmail || input.email.toLowerCase() !== sessionEmail) {
    throw new ApiError(
      422,
      "email_mismatch",
      "Type the email address on your account to confirm deletion.",
    );
  }

  const { data } = await lifecycleRpc(
    "tombstone_my_account",
    { p_reason: input.reason ?? null },
    "Could not delete your account. Try again.",
  );

  const payload = readLifecycleStatus(
    data,
    "deleted",
    "Could not delete your account. Try again.",
  );

  const authBanned = await banAuthUser(userId);
  const avatarsRemoved = await removeAvatarObjects(userId);
  const cleanup = await deletePersonalDataRows(userId);

  return {
    status: "deleted",
    deletedAt: payload.deletedAt ?? "",
    authBanned,
    avatarsRemoved,
    cleanup,
    signoutPath: "/api/auth/signout",
  };
}

async function banAuthUser(userId: string): Promise<boolean> {
  return quietly("auth ban failed", false, async () => {
    const admin = createSupabaseAdminClient();
    const { error } = await admin.auth.admin.updateUserById(userId, {
      ban_duration: "876000h",
    });

    if (error) {
      console.error("[account] auth ban failed", {
        code: error.code ?? "unknown",
      });
      return false;
    }

    return true;
  });
}

async function removeAvatarObjects(userId: string): Promise<number> {
  return quietly("avatar cleanup failed", 0, async () => {
    const bucket = createSupabaseAdminClient().storage.from(AVATAR_BUCKET);
    const listed = await bucket.list(userId);

    if (listed.error) {
      console.error("[account] avatar listing failed", {
        code: listed.error.name ?? "unknown",
      });
      return 0;
    }

    const paths = (listed.data ?? [])
      .map((entry) => entry.name)
      .filter((name) => name.length > 0)
      .map((name) => `${userId}/${name}`);

    if (paths.length === 0) {
      return 0;
    }

    const removed = await bucket.remove(paths);

    if (removed.error) {
      console.error("[account] avatar removal failed", {
        code: removed.error.name ?? "unknown",
      });
      return 0;
    }

    return paths.length;
  });
}

// export_jobs has id; google_calendar_connections is keyed by user_id only.
const PERSONAL_DATA_TABLES = [
  { table: "push_subscriptions", idColumn: "id" },
  { table: "native_push_tokens", idColumn: "id" },
  { table: "google_calendar_connections", idColumn: "user_id" },
  { table: "google_calendar_event_mappings", idColumn: "id" },
  { table: "export_jobs", idColumn: "id" },
] as const;

// Best-effort: a missing table or RLS error logs its code and yields null.
// Sessions are considered disabled by the auth ban, not enumerated here.
async function deletePersonalDataRows(
  userId: string,
): Promise<Record<string, number | null>> {
  const admin = createSupabaseAdminClient();
  const cleanup: Record<string, number | null> = {};

  for (const { table, idColumn } of PERSONAL_DATA_TABLES) {
    cleanup[table] = await quietly(
      `${table} cleanup failed`,
      null as number | null,
      async () => {
        const { data, error } = await admin
          .from(table)
          .delete()
          .eq("user_id", userId)
          .select(idColumn);

        if (error) {
          console.error(`[account] ${table} delete failed`, {
            code: error.code ?? "unknown",
          });
          return null;
        }

        return data?.length ?? 0;
      },
    );
  }

  return cleanup;
}
