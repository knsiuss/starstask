import "server-only";

import type { User } from "@supabase/supabase-js";
import type { DeveloperUsersQuery } from "@starstask/contracts";

import { DataAccessError, type PaginatedResult } from "@/lib/db/assignments";
import { ATTACHMENT_BUCKET } from "@/lib/storage/attachments";
import {
  createSupabaseAdminClient,
  isServiceRoleConfigured,
} from "@/lib/supabase/admin";

/**
 * Read models for the internal developer dashboard.
 *
 * Every query uses the service role because it deliberately spans all accounts
 * and classes. These functions are server-only and must never be imported from
 * a Client Component. Counts are computed in SQL (or by the Auth admin API)
 * rather than by paging through rows in the browser.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_AUTH_USER_PAGES = 50;
const AUTH_USERS_PER_PAGE = 1000;
const RECENT_AUTH_EVENT_LIMIT = 12;
const RECENT_REGISTRATION_LIMIT = 8;
const RECENT_AUDIT_LIMIT = 15;
const RECENT_ACTIVITY_LIMIT = 20;
const RECENT_ERROR_LIMIT = 5;

export type DeveloperMetrics = {
  totalUsers: number;
  registrations7: number;
  registrations30: number;
  signIns7: number;
  signIns30: number;
  activeUsers7: number;
  activeUsers30: number;
  totalAssignments: number;
};

export type DeveloperHealth = {
  database: { ok: boolean; latencyMs: number | null };
  storage: { ok: boolean; latencyMs: number | null };
  errorsLast24h: number;
  authFailuresLast24h: number;
  recentErrors: {
    id: number;
    routePath: string | null;
    method: string | null;
    errorName: string | null;
    createdAt: string;
  }[];
};

export type DeveloperAuthEvent = {
  id: number;
  userId: string | null;
  eventType: "sign_in_succeeded" | "sign_in_failed";
  provider: string | null;
  reason: string | null;
  createdAt: string;
};

export type DeveloperRegistration = {
  id: string;
  createdAt: string;
};

export type DeveloperActivityItem = {
  id: string;
  eventType: string;
  source: "audit" | "assignment";
  actorId: string | null;
  resourceType: string;
  resourceId: string | null;
  createdAt: string;
};

export type DeveloperUser = {
  id: string;
  displayName: string | null;
  createdAt: string;
  lastSignInAt: string | null;
  role: "Platform admin" | "Class admin" | "Member";
  classAdminCount: number;
};

export type DeveloperUserDirectory = PaginatedResult<DeveloperUser> & {
  /** True when the Auth scan hit its page cap and search covers a prefix only. */
  truncated: boolean;
};

export function requireServiceRole() {
  if (!isServiceRoleConfigured()) {
    throw new DataAccessError(
      "Monitoring data source is not configured",
      "not_configured",
    );
  }
}

function sinceIso(days: number): string {
  return new Date(Date.now() - days * DAY_MS).toISOString();
}

export async function getDeveloperMetrics(): Promise<DeveloperMetrics> {
  requireServiceRole();

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.rpc("developer_dashboard_metrics", {
    p_since_7: sinceIso(7),
    p_since_30: sinceIso(30),
  });

  if (error) {
    throw new DataAccessError("Could not load monitoring metrics", error.code);
  }

  const row = data?.[0];

  if (!row) {
    throw new DataAccessError("Monitoring metrics were empty", "empty_result");
  }

  return {
    totalUsers: Number(row.total_users),
    registrations7: Number(row.registrations_7),
    registrations30: Number(row.registrations_30),
    signIns7: Number(row.sign_ins_7),
    signIns30: Number(row.sign_ins_30),
    activeUsers7: Number(row.active_users_7),
    activeUsers30: Number(row.active_users_30),
    totalAssignments: Number(row.total_assignments),
  };
}

export async function listRecentAuthEvents(): Promise<DeveloperAuthEvent[]> {
  requireServiceRole();

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("auth_activity_events")
    .select("id, user_id, event_type, provider, reason, created_at")
    .order("created_at", { ascending: false })
    .limit(RECENT_AUTH_EVENT_LIMIT);

  if (error) {
    throw new DataAccessError("Could not load sign-in activity", error.code);
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    userId: row.user_id,
    eventType: row.event_type,
    provider: row.provider,
    reason: row.reason,
    createdAt: row.created_at,
  }));
}

export async function listRecentRegistrations(): Promise<
  DeveloperRegistration[]
> {
  requireServiceRole();

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("profiles")
    .select("id, created_at")
    .order("created_at", { ascending: false })
    .limit(RECENT_REGISTRATION_LIMIT);

  if (error) {
    throw new DataAccessError("Could not load registrations", error.code);
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    createdAt: row.created_at,
  }));
}

export async function listRecentApplicationActivity(): Promise<
  DeveloperActivityItem[]
> {
  requireServiceRole();

  const admin = createSupabaseAdminClient();

  const [auditResult, assignmentResult] = await Promise.all([
    admin
      .from("audit_logs")
      .select(
        "id, actor_id, action, entity_type, entity_id, class_id, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(RECENT_AUDIT_LIMIT),
    admin
      .from("app_activity_events")
      .select(
        "id, actor_id, event_type, resource_type, resource_id, class_id, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(RECENT_AUDIT_LIMIT),
  ]);

  if (auditResult.error) {
    throw new DataAccessError(
      "Could not load application activity",
      auditResult.error.code,
    );
  }

  if (assignmentResult.error) {
    throw new DataAccessError(
      "Could not load assignment activity",
      assignmentResult.error.code,
    );
  }

  const auditItems: DeveloperActivityItem[] = (auditResult.data ?? []).map(
    (row) => ({
      id: `audit-${row.id}`,
      eventType: row.action,
      source: "audit",
      actorId: row.actor_id,
      resourceType: row.entity_type,
      resourceId: row.entity_id,
      createdAt: row.created_at,
    }),
  );

  const assignmentItems: DeveloperActivityItem[] = (
    assignmentResult.data ?? []
  ).map((row) => ({
    id: `assignment-${row.id}`,
    eventType: row.event_type,
    source: "assignment",
    actorId: row.actor_id,
    resourceType: row.resource_type,
    resourceId: row.resource_id,
    createdAt: row.created_at,
  }));

  return [...auditItems, ...assignmentItems]
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    .slice(0, RECENT_ACTIVITY_LIMIT);
}

async function checkDatabase() {
  const admin = createSupabaseAdminClient();
  const startedAt = Date.now();

  try {
    const { error } = await admin
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .limit(1);

    return { ok: !error, latencyMs: Date.now() - startedAt };
  } catch {
    return { ok: false, latencyMs: Date.now() - startedAt };
  }
}

export async function checkStorage() {
  const admin = createSupabaseAdminClient();
  const startedAt = Date.now();

  try {
    const { error } = await admin.storage.getBucket(ATTACHMENT_BUCKET);

    return { ok: !error, latencyMs: Date.now() - startedAt };
  } catch {
    return { ok: false, latencyMs: Date.now() - startedAt };
  }
}

export async function getDeveloperHealth(): Promise<DeveloperHealth> {
  requireServiceRole();

  const admin = createSupabaseAdminClient();
  const since24h = sinceIso(1);

  const [database, storage, errors, authFailures, recentErrors] =
    await Promise.all([
      checkDatabase(),
      checkStorage(),
      admin
        .from("app_error_events")
        .select("id", { count: "exact", head: true })
        .gte("created_at", since24h),
      admin
        .from("auth_activity_events")
        .select("id", { count: "exact", head: true })
        .eq("event_type", "sign_in_failed")
        .gte("created_at", since24h),
      admin
        .from("app_error_events")
        .select("id, route_path, method, error_name, created_at")
        .order("created_at", { ascending: false })
        .limit(RECENT_ERROR_LIMIT),
    ]);

  if (errors.error || authFailures.error || recentErrors.error) {
    throw new DataAccessError(
      "Could not load system health",
      errors.error?.code ??
        authFailures.error?.code ??
        recentErrors.error?.code,
    );
  }

  return {
    database,
    storage,
    errorsLast24h: errors.count ?? 0,
    authFailuresLast24h: authFailures.count ?? 0,
    recentErrors: (recentErrors.data ?? []).map((row) => ({
      id: row.id,
      routePath: row.route_path,
      method: row.method,
      errorName: row.error_name,
      createdAt: row.created_at,
    })),
  };
}

async function loadAuthUsers(): Promise<{ users: User[]; truncated: boolean }> {
  const admin = createSupabaseAdminClient();
  const users: User[] = [];
  let page = 1;
  let scannedPages = 0;

  while (scannedPages < MAX_AUTH_USER_PAGES) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage: AUTH_USERS_PER_PAGE,
    });

    if (error) {
      throw new DataAccessError("Could not load accounts", error.code);
    }

    users.push(...data.users);
    scannedPages += 1;

    if (!data.nextPage) {
      return { users, truncated: false };
    }

    page = data.nextPage;
  }

  return { users, truncated: true };
}

function compareNullableDate(
  a: string | null | undefined,
  b: string | null | undefined,
): number {
  return (a ? Date.parse(a) : 0) - (b ? Date.parse(b) : 0);
}

export async function listDeveloperUsers(
  query: DeveloperUsersQuery,
): Promise<DeveloperUserDirectory> {
  requireServiceRole();

  const admin = createSupabaseAdminClient();
  const { users, truncated } = await loadAuthUsers();

  const search = query.search?.toLowerCase();
  const filtered = search
    ? users.filter((user) => {
        // Emails are deliberately not part of the directory: they are personal
        // data, so they are neither displayed nor searchable.
        const name = getUserMetadataName(user)?.toLowerCase() ?? "";

        return name.includes(search);
      })
    : users;

  const sorted = [...filtered].sort((a, b) => {
    const result =
      query.sort === "last_sign_in_at"
        ? compareNullableDate(a.last_sign_in_at, b.last_sign_in_at)
        : compareNullableDate(a.created_at, b.created_at);

    return query.direction === "asc" ? result : -result;
  });

  const total = sorted.length;
  const offset = (query.page - 1) * query.pageSize;
  const pageItems = sorted.slice(offset, offset + query.pageSize);
  const ids = pageItems.map((user) => user.id);
  const pagination = {
    total,
    page: query.page,
    pageSize: query.pageSize,
    totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
  };

  if (ids.length === 0) {
    return { items: [], ...pagination, truncated };
  }

  const [profilesResult, platformAdminsResult, classAdminsResult] =
    await Promise.all([
      admin.from("profiles").select("id, display_name").in("id", ids),
      admin.from("platform_admins").select("user_id").in("user_id", ids),
      admin.from("class_admins").select("user_id").in("user_id", ids),
    ]);

  if (
    profilesResult.error ||
    platformAdminsResult.error ||
    classAdminsResult.error
  ) {
    throw new DataAccessError(
      "Could not load account roles",
      profilesResult.error?.code ??
        platformAdminsResult.error?.code ??
        classAdminsResult.error?.code,
    );
  }

  const profileNames = new Map(
    (profilesResult.data ?? []).map((row) => [row.id, row.display_name]),
  );
  const platformAdmins = new Set(
    (platformAdminsResult.data ?? []).map((row) => row.user_id),
  );
  const classAdminCounts = new Map<string, number>();

  for (const row of classAdminsResult.data ?? []) {
    classAdminCounts.set(
      row.user_id,
      (classAdminCounts.get(row.user_id) ?? 0) + 1,
    );
  }

  const items: DeveloperUser[] = pageItems.map((user) => {
    const classAdminCount = classAdminCounts.get(user.id) ?? 0;

    return {
      id: user.id,
      displayName:
        profileNames.get(user.id) ?? getUserMetadataName(user) ?? null,
      createdAt: user.created_at,
      lastSignInAt: user.last_sign_in_at ?? null,
      role: platformAdmins.has(user.id)
        ? "Platform admin"
        : classAdminCount > 0
          ? "Class admin"
          : "Member",
      classAdminCount,
    };
  });

  return {
    items,
    ...pagination,
    truncated,
  };
}

function getUserMetadataName(user: User): string | null {
  const fullName = user.user_metadata?.full_name;
  const name = user.user_metadata?.name;

  if (typeof fullName === "string" && fullName.trim().length > 0) {
    return fullName.trim();
  }

  if (typeof name === "string" && name.trim().length > 0) {
    return name.trim();
  }

  return null;
}
