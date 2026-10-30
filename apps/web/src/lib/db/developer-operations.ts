import "server-only";

import type {
  DeveloperIncidentSeverity,
  DeveloperIncidentStatus,
  DeveloperLogRange,
  DeveloperLogsQuery,
  DeveloperSecurityQuery,
  IncidentStatusFilter,
} from "@starstask/contracts";
import type { Json } from "@/types/database";

import { DataAccessError, type PaginatedResult } from "@/lib/db/assignments";
import { checkStorage, requireServiceRole } from "@/lib/db/developer";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * Read models and write operations for the developer console sub-pages.
 *
 * Everything here is server-only and uses the service role because the data
 * deliberately spans all accounts. Mutations (incidents) receive the actor ID
 * from the server-verified session, never from the request body.
 */

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const RANGE_DAYS: Record<Exclude<DeveloperLogRange, "all">, number> = {
  "24h": 1,
  "7d": 7,
  "30d": 30,
};

const MAX_MIGRATION_ROWS = 200;
const MAX_LISTED_INCIDENTS = 50;
const NOTES_PER_INCIDENT = 20;

export type DeveloperError = {
  id: number;
  routePath: string | null;
  method: string | null;
  errorName: string | null;
  errorDigest: string | null;
  createdAt: string;
};

export type DeveloperSecurityItem = {
  id: string;
  source: "audit" | "auth";
  kind: string;
  detail: string | null;
  actorId: string | null;
  createdAt: string;
};

export type DeveloperConnectionUsage = {
  total: number | null;
  active: number | null;
  idle: number | null;
  maxConnections: number | null;
};

export type DeveloperTableSize = { table: string; bytes: number };

export type DeveloperDatabaseDetails = {
  connections: DeveloperConnectionUsage | null;
  tableSizes: DeveloperTableSize[];
};

export type DeveloperAppliedMigration = {
  version: string;
  name: string;
  appliedAt: string;
};

export type DeveloperMigrations = {
  available: boolean;
  migrations: DeveloperAppliedMigration[];
};

export type DeveloperIncident = {
  id: string;
  title: string;
  status: DeveloperIncidentStatus;
  severity: DeveloperIncidentSeverity;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
};

export type DeveloperIncidentNote = {
  id: number;
  incidentId: string;
  body: string;
  authorId: string | null;
  createdAt: string;
};

export type DeveloperIncidentWithNotes = DeveloperIncident & {
  notes: DeveloperIncidentNote[];
};

function rangeToSince(range: DeveloperLogRange): string | null {
  if (range === "all") {
    return null;
  }

  return new Date(
    Date.now() - RANGE_DAYS[range] * 24 * 60 * 60 * 1000,
  ).toISOString();
}

/**
 * Strips characters that would break the PostgREST `or` filter syntax. The
 * search term still matches as a substring afterwards.
 */
function toIlikePattern(term: string): string {
  return term.replace(/[,()%_*\\]/g, " ").trim();
}

export async function listDeveloperErrors(
  query: DeveloperLogsQuery,
): Promise<PaginatedResult<DeveloperError>> {
  requireServiceRole();

  const admin = createSupabaseAdminClient();
  const since = rangeToSince(query.range);
  const pattern = query.search ? toIlikePattern(query.search) : null;
  const searchable = pattern ? pattern.length > 0 : false;

  let countQuery = admin
    .from("app_error_events")
    .select("id", { count: "exact", head: true });

  let pageQuery = admin
    .from("app_error_events")
    .select("id, route_path, method, error_name, error_digest, created_at");

  if (since) {
    countQuery = countQuery.gte("created_at", since);
    pageQuery = pageQuery.gte("created_at", since);
  }

  if (searchable && pattern) {
    const filter = `route_path.ilike.%${pattern}%,error_name.ilike.%${pattern}%`;

    countQuery = countQuery.or(filter);
    pageQuery = pageQuery.or(filter);
  }

  const [countResult, pageResult] = await Promise.all([
    countQuery,
    pageQuery
      .order("created_at", { ascending: false })
      .range(
        (query.page - 1) * query.pageSize,
        query.page * query.pageSize - 1,
      ),
  ]);

  if (countResult.error) {
    throw new DataAccessError(
      "Could not load error log count",
      countResult.error.code,
    );
  }

  if (pageResult.error) {
    throw new DataAccessError(
      "Could not load error log entries",
      pageResult.error.code,
    );
  }

  return {
    items: (pageResult.data ?? []).map((row) => ({
      id: row.id,
      routePath: row.route_path,
      method: row.method,
      errorName: row.error_name,
      errorDigest: row.error_digest,
      createdAt: row.created_at,
    })),
    total: countResult.count ?? 0,
    page: query.page,
    pageSize: query.pageSize,
    totalPages: Math.max(
      1,
      Math.ceil((countResult.count ?? 0) / query.pageSize),
    ),
  };
}

export async function listDeveloperSecurityEvents(
  query: DeveloperSecurityQuery,
): Promise<PaginatedResult<DeveloperSecurityItem>> {
  requireServiceRole();

  const admin = createSupabaseAdminClient();
  const offset = (query.page - 1) * query.pageSize;
  const pattern = query.search ? toIlikePattern(query.search) : null;
  const searchable = pattern ? pattern.length > 0 : false;

  if (query.source === "audit") {
    let countQuery = admin
      .from("audit_logs")
      .select("id", { count: "exact", head: true });

    let pageQuery = admin
      .from("audit_logs")
      .select("id, actor_id, action, entity_type, entity_id, created_at");

    if (searchable && pattern) {
      countQuery = countQuery.ilike("action", `%${pattern}%`);
      pageQuery = pageQuery.ilike("action", `%${pattern}%`);
    }

    const [countResult, pageResult] = await Promise.all([
      countQuery,
      pageQuery
        .order("created_at", { ascending: false })
        .range(offset, offset + query.pageSize - 1),
    ]);

    if (countResult.error) {
      throw new DataAccessError(
        "Could not load audit trail count",
        countResult.error.code,
      );
    }

    if (pageResult.error) {
      throw new DataAccessError(
        "Could not load audit trail entries",
        pageResult.error.code,
      );
    }

    const total = countResult.count ?? 0;

    return {
      items: (pageResult.data ?? []).map((row) => ({
        id: `audit-${row.id}`,
        source: "audit" as const,
        kind: row.action,
        detail: row.entity_type,
        actorId: row.actor_id,
        createdAt: row.created_at,
      })),
      total,
      page: query.page,
      pageSize: query.pageSize,
      totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
    };
  }

  const eventType =
    query.source === "auth_failures" ? "sign_in_failed" : "sign_in_succeeded";

  let authCountQuery = admin
    .from("auth_activity_events")
    .select("id", { count: "exact", head: true })
    .eq("event_type", eventType);

  let authPageQuery = admin
    .from("auth_activity_events")
    .select("id, user_id, event_type, provider, reason, created_at")
    .eq("event_type", eventType);

  if (searchable && pattern) {
    const filter = `reason.ilike.%${pattern}%,provider.ilike.%${pattern}%`;

    authCountQuery = authCountQuery.or(filter);
    authPageQuery = authPageQuery.or(filter);
  }

  const [countResult, pageResult] = await Promise.all([
    authCountQuery,
    authPageQuery
      .order("created_at", { ascending: false })
      .range(offset, offset + query.pageSize - 1),
  ]);

  if (countResult.error) {
    throw new DataAccessError(
      "Could not load auth event count",
      countResult.error.code,
    );
  }

  if (pageResult.error) {
    throw new DataAccessError(
      "Could not load auth event entries",
      pageResult.error.code,
    );
  }

  const total = countResult.count ?? 0;

  return {
    items: (pageResult.data ?? []).map((row) => ({
      id: `auth-${row.id}`,
      source: "auth" as const,
      kind: row.event_type,
      detail: row.reason ?? row.provider,
      actorId: row.user_id,
      createdAt: row.created_at,
    })),
    total,
    page: query.page,
    pageSize: query.pageSize,
    totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
  };
}

type JsonObject = { [key: string]: Json | undefined };

function isJsonObject(value: Json | undefined): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readCount(value: Json | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export async function getDeveloperDatabaseDetails(): Promise<DeveloperDatabaseDetails> {
  requireServiceRole();

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.rpc("developer_database_health");

  if (error) {
    throw new DataAccessError(
      "Could not load database health details",
      error.code,
    );
  }

  const payload = isJsonObject(data) ? data : null;
  const connectionsPayload = isJsonObject(payload?.connections)
    ? payload.connections
    : null;
  const tableSizesPayload = Array.isArray(payload?.table_sizes)
    ? payload.table_sizes
    : [];

  const connections: DeveloperConnectionUsage | null = connectionsPayload
    ? {
        total: readCount(connectionsPayload.total),
        active: readCount(connectionsPayload.active),
        idle: readCount(connectionsPayload.idle),
        maxConnections: readCount(connectionsPayload.max_connections),
      }
    : null;

  const tableSizes: DeveloperTableSize[] = [];

  for (const row of tableSizesPayload) {
    if (!isJsonObject(row)) {
      continue;
    }

    const { table, bytes } = row;

    if (typeof table === "string" && typeof bytes === "number") {
      tableSizes.push({ table, bytes });
    }
  }

  return { connections, tableSizes };
}

export async function getDeveloperAppliedMigrations(): Promise<DeveloperMigrations> {
  requireServiceRole();

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.rpc("developer_applied_migrations");

  if (error) {
    throw new DataAccessError("Could not load migration status", error.code);
  }

  const payload = isJsonObject(data) ? data : null;
  const rows = Array.isArray(payload?.migrations) ? payload.migrations : [];
  const migrations: DeveloperAppliedMigration[] = [];

  for (const row of rows) {
    if (!isJsonObject(row)) {
      continue;
    }

    const { version, name, applied_at } = row;

    if (
      typeof version === "string" &&
      typeof name === "string" &&
      typeof applied_at === "string"
    ) {
      migrations.push({ version, name, appliedAt: applied_at });
    }

    if (migrations.length >= MAX_MIGRATION_ROWS) {
      break;
    }
  }

  return {
    available: payload?.available === true,
    migrations,
  };
}

function mapIncidentRow(row: Record<string, unknown>): DeveloperIncident {
  return {
    id: typeof row.id === "string" ? row.id : "",
    title: typeof row.title === "string" ? row.title : "",
    status: (typeof row.status === "string"
      ? row.status
      : "open") as DeveloperIncidentStatus,
    severity: (typeof row.severity === "string"
      ? row.severity
      : "medium") as DeveloperIncidentSeverity,
    createdBy: typeof row.created_by === "string" ? row.created_by : null,
    createdAt: typeof row.created_at === "string" ? row.created_at : "",
    updatedAt: typeof row.updated_at === "string" ? row.updated_at : "",
    resolvedAt: typeof row.resolved_at === "string" ? row.resolved_at : null,
  };
}

function assertUuid(value: string, label: string): string {
  if (!UUID_PATTERN.test(value)) {
    throw new DataAccessError(
      `${label} is not a valid identifier`,
      "invalid_id",
    );
  }

  return value;
}

export async function listDeveloperIncidents(
  statusFilter: IncidentStatusFilter,
): Promise<DeveloperIncidentWithNotes[]> {
  requireServiceRole();

  const admin = createSupabaseAdminClient();

  let incidentQuery = admin
    .from("developer_incidents")
    .select(
      "id, title, status, severity, created_by, created_at, updated_at, resolved_at",
    );

  if (statusFilter !== "all") {
    incidentQuery = incidentQuery.eq("status", statusFilter);
  }

  const incidentResult = await incidentQuery
    .order("created_at", { ascending: false })
    .limit(MAX_LISTED_INCIDENTS);

  if (incidentResult.error) {
    throw new DataAccessError(
      "Could not load incidents",
      incidentResult.error.code,
    );
  }

  const incidents = (incidentResult.data ?? []).map(mapIncidentRow);

  if (incidents.length === 0) {
    return [];
  }

  const noteResult = await admin
    .from("developer_incident_notes")
    .select("id, incident_id, body, author_id, created_at")
    .in(
      "incident_id",
      incidents.map((incident) => incident.id),
    )
    .order("created_at", { ascending: false });

  if (noteResult.error) {
    throw new DataAccessError(
      "Could not load incident notes",
      noteResult.error.code,
    );
  }

  const notesByIncident = new Map<string, DeveloperIncidentNote[]>();

  for (const row of noteResult.data ?? []) {
    const group = notesByIncident.get(row.incident_id) ?? [];

    if (group.length < NOTES_PER_INCIDENT) {
      group.push({
        id: row.id,
        incidentId: row.incident_id,
        body: row.body,
        authorId: row.author_id,
        createdAt: row.created_at,
      });
      notesByIncident.set(row.incident_id, group);
    }
  }

  return incidents.map((incident) => ({
    ...incident,
    notes: (notesByIncident.get(incident.id) ?? []).reverse(),
  }));
}

export async function createDeveloperIncident(
  actorId: string,
  input: { title: string; severity: DeveloperIncidentSeverity; note?: string },
): Promise<DeveloperIncident> {
  requireServiceRole();
  assertUuid(actorId, "Actor");

  const admin = createSupabaseAdminClient();
  const insertResult = await admin
    .from("developer_incidents")
    .insert({
      title: input.title,
      severity: input.severity,
      created_by: actorId,
      updated_by: actorId,
    })
    .select(
      "id, title, status, severity, created_by, created_at, updated_at, resolved_at",
    )
    .single();

  if (insertResult.error) {
    throw new DataAccessError(
      "Could not create the incident",
      insertResult.error.code,
    );
  }

  if (input.note) {
    const noteResult = await admin.from("developer_incident_notes").insert({
      incident_id: insertResult.data.id,
      body: input.note,
      author_id: actorId,
    });

    if (noteResult.error) {
      // The incident exists; a failed opening note must not discard it.
      console.warn("[developer] opening note not recorded", {
        code: noteResult.error.code,
      });
    }
  }

  return mapIncidentRow(insertResult.data);
}

export async function updateDeveloperIncidentStatus(
  actorId: string,
  incidentId: string,
  status: DeveloperIncidentStatus,
): Promise<DeveloperIncident> {
  requireServiceRole();
  assertUuid(actorId, "Actor");
  assertUuid(incidentId, "Incident");

  const admin = createSupabaseAdminClient();
  const updateResult = await admin
    .from("developer_incidents")
    .update({
      status,
      updated_by: actorId,
      updated_at: new Date().toISOString(),
      resolved_at: status === "resolved" ? new Date().toISOString() : null,
    })
    .eq("id", incidentId)
    .select(
      "id, title, status, severity, created_by, created_at, updated_at, resolved_at",
    )
    .single();

  if (updateResult.error) {
    const code = updateResult.error.code;

    throw new DataAccessError(
      code === "PGRST116"
        ? "That incident does not exist"
        : "Could not update the incident",
      code,
    );
  }

  return mapIncidentRow(updateResult.data);
}

export async function addDeveloperIncidentNote(
  actorId: string,
  incidentId: string,
  body: string,
): Promise<DeveloperIncidentNote> {
  requireServiceRole();
  assertUuid(actorId, "Actor");
  assertUuid(incidentId, "Incident");

  const admin = createSupabaseAdminClient();

  // Verify the incident first so an unknown ID fails as not found instead of
  // leaking a foreign-key error shape.
  const existing = await admin
    .from("developer_incidents")
    .select("id")
    .eq("id", incidentId)
    .maybeSingle();

  if (existing.error) {
    throw new DataAccessError(
      "Could not verify the incident",
      existing.error.code,
    );
  }

  if (!existing.data) {
    throw new DataAccessError("That incident does not exist", "not_found");
  }

  const noteResult = await admin
    .from("developer_incident_notes")
    .insert({ incident_id: incidentId, body, author_id: actorId })
    .select("id, incident_id, body, author_id, created_at")
    .single();

  if (noteResult.error) {
    throw new DataAccessError("Could not add the note", noteResult.error.code);
  }

  return {
    id: noteResult.data.id,
    incidentId: noteResult.data.incident_id,
    body: noteResult.data.body,
    authorId: noteResult.data.author_id,
    createdAt: noteResult.data.created_at,
  };
}

export { checkStorage as probeDeveloperStorage };
