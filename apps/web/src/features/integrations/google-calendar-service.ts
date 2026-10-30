import "server-only";

import { nextAttemptAt } from "@/lib/push/reminder-schedule";
import {
  deleteManagedEvent,
  findManagedEvent,
  GoogleApiError,
  insertManagedEvent,
  updateManagedEvent,
  buildGoogleEventBody,
  type CalendarEventSource,
} from "@/lib/integrations/google/calendar-api";
import {
  getGoogleCalendarConfig,
  isGoogleCalendarConfigured,
} from "@/lib/integrations/google/config";
import {
  GoogleOAuthError,
  refreshAccessToken,
  revokeGoogleToken,
  type GoogleTokenSet,
} from "@/lib/integrations/google/oauth";
import {
  decryptToken,
  encryptToken,
} from "@/lib/integrations/google/token-crypto";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { CalendarMappingStatusRow } from "@/types/database";

export type CalendarConnectionSummary = {
  configured: boolean;
  connected: boolean;
  status: "connected" | "revoked" | "error" | null;
  calendarId: string | null;
  connectedAt: string | null;
  lastRefreshedAt: string | null;
  lastErrorCategory: string | null;
};

export type CalendarSyncResult =
  | { status: "synced"; eventId: string }
  | { status: "removed" }
  | { status: "failed"; category: CalendarSyncFailure };

export type CalendarSyncFailure =
  | "not_connected"
  | "revoked"
  | "transient"
  | "invalid_request"
  | "session_not_found";

export class CalendarSyncError extends Error {
  constructor(
    readonly category: CalendarSyncFailure,
    message: string,
  ) {
    super(message);
    this.name = "CalendarSyncError";
  }
}

const MAX_SYNC_ATTEMPTS = 5;

/** Refresh a little early so a request never races the expiry. */
const REFRESH_MARGIN_MS = 60_000;

const SESSION_COLUMNS =
  "id, title, description, agenda, starts_at, ends_at, time_zone, location, meeting_url, status";

type SessionForSync = {
  id: string;
  title: string;
  description: string;
  agenda: string | null;
  starts_at: string;
  ends_at: string;
  time_zone: string;
  location: string | null;
  meeting_url: string | null;
  status: "scheduled" | "cancelled" | "completed";
};

type ConnectionRow = {
  user_id: string;
  calendar_id: string;
  scope: string;
  access_token_ciphertext: string;
  refresh_token_ciphertext: string | null;
  token_expires_at: string;
  status: "connected" | "revoked" | "error";
};

type MappingRow = {
  id: string;
  google_event_id: string | null;
  status: CalendarMappingStatusRow;
  attempt_count: number;
  calendar_id: string;
};

/**
 * Reads the connection state for the settings page.
 *
 * Only non-sensitive columns are selected, and the user-scoped client means RLS
 * returns the caller's own row (or nothing).
 */
export async function getCalendarConnectionSummary(
  userId: string,
): Promise<CalendarConnectionSummary> {
  const configured = isGoogleCalendarConfigured();
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("google_calendar_connections")
    .select(
      "calendar_id, status, connected_at, last_refreshed_at, last_error_category",
    )
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error("Could not load the calendar connection");
  }

  if (!data) {
    return {
      configured,
      connected: false,
      status: null,
      calendarId: null,
      connectedAt: null,
      lastRefreshedAt: null,
      lastErrorCategory: null,
    };
  }

  return {
    configured,
    connected: data.status === "connected",
    status: data.status,
    calendarId: data.calendar_id,
    connectedAt: data.connected_at,
    lastRefreshedAt: data.last_refreshed_at,
    lastErrorCategory: data.last_error_category,
  };
}

/** Encrypts and stores a freshly granted token set. */
export async function saveCalendarConnection(
  userId: string,
  tokens: GoogleTokenSet,
): Promise<void> {
  const config = getGoogleCalendarConfig();
  const supabase = createSupabaseAdminClient();

  // A reconnect without a new refresh token must not erase the stored one:
  // Google only returns it on the first consent or when `prompt=consent` forces
  // a new grant.
  const { data: existing } = await supabase
    .from("google_calendar_connections")
    .select("refresh_token_ciphertext")
    .eq("user_id", userId)
    .maybeSingle();

  const refreshCiphertext = tokens.refreshToken
    ? encryptToken(tokens.refreshToken, config.encryptionKey)
    : (existing?.refresh_token_ciphertext ?? null);

  const { error } = await supabase.from("google_calendar_connections").upsert(
    {
      user_id: userId,
      calendar_id: "primary",
      scope: tokens.scope,
      access_token_ciphertext: encryptToken(
        tokens.accessToken,
        config.encryptionKey,
      ),
      refresh_token_ciphertext: refreshCiphertext,
      token_expires_at: tokens.expiresAt,
      status: "connected",
      last_error_category: null,
      connected_at: new Date().toISOString(),
      last_refreshed_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );

  if (error) {
    throw new Error("Could not store the calendar connection");
  }
}

/**
 * Removes the connection and every mapping.
 *
 * The Google grant is revoked first when possible, but a failed revoke never
 * blocks the local disconnect: the user asked to stop sharing, and the tokens
 * are deleted either way.
 */
export async function disconnectCalendar(userId: string): Promise<void> {
  const supabase = createSupabaseAdminClient();
  const { data: connection } = await supabase
    .from("google_calendar_connections")
    .select("refresh_token_ciphertext, access_token_ciphertext")
    .eq("user_id", userId)
    .maybeSingle();

  if (connection) {
    const config = getGoogleCalendarConfig();
    const token = connection.refresh_token_ciphertext
      ? safeDecrypt(connection.refresh_token_ciphertext, config.encryptionKey)
      : null;

    if (token) {
      await revokeGoogleToken(token);
    }
  }

  const { error: mappingError } = await supabase
    .from("google_calendar_event_mappings")
    .delete()
    .eq("user_id", userId);

  if (mappingError) {
    throw new Error("Could not remove calendar mappings");
  }

  const { error } = await supabase
    .from("google_calendar_connections")
    .delete()
    .eq("user_id", userId);

  if (error) {
    throw new Error("Could not remove the calendar connection");
  }
}

/** Marks the connection as needing a reconnect after Google rejects it. */
async function markConnectionRevoked(
  userId: string,
  category: "revoked" | "error",
): Promise<void> {
  const supabase = createSupabaseAdminClient();

  await supabase
    .from("google_calendar_connections")
    .update({ status: category, last_error_category: category })
    .eq("user_id", userId);
}

/**
 * Returns a usable access token, refreshing it when it is close to expiring.
 *
 * @throws {CalendarSyncError} `not_connected` or `revoked` when the user must
 * (re)connect before anything can be synced.
 */
async function getValidAccessToken(
  userId: string,
): Promise<{ accessToken: string; calendarId: string }> {
  const supabase = createSupabaseAdminClient();
  const { data: connection } = await supabase
    .from("google_calendar_connections")
    .select(
      "user_id, calendar_id, scope, access_token_ciphertext, refresh_token_ciphertext, token_expires_at, status",
    )
    .eq("user_id", userId)
    .maybeSingle<ConnectionRow>();

  if (!connection) {
    throw new CalendarSyncError(
      "not_connected",
      "Connect Google Calendar first.",
    );
  }

  if (connection.status === "revoked") {
    throw new CalendarSyncError("revoked", "Reconnect Google Calendar.");
  }

  const config = getGoogleCalendarConfig();
  const expiresAt = Date.parse(connection.token_expires_at);

  if (
    Number.isFinite(expiresAt) &&
    expiresAt - Date.now() > REFRESH_MARGIN_MS
  ) {
    return {
      accessToken: decryptToken(
        connection.access_token_ciphertext,
        config.encryptionKey,
      ),
      calendarId: connection.calendar_id,
    };
  }

  if (!connection.refresh_token_ciphertext) {
    await markConnectionRevoked(userId, "revoked");

    throw new CalendarSyncError("revoked", "Reconnect Google Calendar.");
  }

  try {
    const refreshed = await refreshAccessToken(
      config,
      decryptToken(connection.refresh_token_ciphertext, config.encryptionKey),
    );

    const { error } = await supabase
      .from("google_calendar_connections")
      .update({
        access_token_ciphertext: encryptToken(
          refreshed.accessToken,
          config.encryptionKey,
        ),
        token_expires_at: refreshed.expiresAt,
        last_refreshed_at: new Date().toISOString(),
        status: "connected",
        last_error_category: null,
      })
      .eq("user_id", userId);

    if (error) {
      throw new CalendarSyncError(
        "transient",
        "Could not store the refreshed token.",
      );
    }

    return {
      accessToken: refreshed.accessToken,
      calendarId: connection.calendar_id,
    };
  } catch (error) {
    if (error instanceof CalendarSyncError) {
      throw error;
    }

    if (
      error instanceof GoogleOAuthError &&
      error.category === "invalid_grant"
    ) {
      await markConnectionRevoked(userId, "revoked");

      throw new CalendarSyncError("revoked", "Reconnect Google Calendar.");
    }

    throw new CalendarSyncError("transient", "Could not refresh the token.");
  }
}

function toEventSource(session: SessionForSync): CalendarEventSource {
  return {
    id: session.id,
    title: session.title,
    description: session.description,
    agenda: session.agenda,
    startsAt: session.starts_at,
    endsAt: session.ends_at,
    timeZone: session.time_zone,
    location: session.location,
    meetingUrl: session.meeting_url,
  };
}

function toFailure(error: unknown): CalendarSyncFailure {
  if (error instanceof CalendarSyncError) {
    return error.category;
  }

  if (error instanceof GoogleApiError) {
    if (error.category === "transient") {
      return "transient";
    }

    if (error.category === "unauthorized") {
      return "revoked";
    }

    return "invalid_request";
  }

  if (error instanceof GoogleOAuthError) {
    return error.category === "invalid_grant" ? "revoked" : "transient";
  }

  return "transient";
}

async function recordFailure(
  userId: string,
  sessionId: string,
  mapping: MappingRow | null,
  category: CalendarSyncFailure,
): Promise<void> {
  const supabase = createSupabaseAdminClient();
  const attemptCount = Math.min(
    (mapping?.attempt_count ?? 0) + 1,
    MAX_SYNC_ATTEMPTS,
  );
  const retryable = category === "transient";
  const nextAttemptAtIso = retryable
    ? nextAttemptAt(attemptCount, Date.now())
    : new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  if (mapping) {
    const { error } = await supabase
      .from("google_calendar_event_mappings")
      .update({
        status: "failed",
        attempt_count: attemptCount,
        next_attempt_at: nextAttemptAtIso,
        last_error_category: category,
      })
      .eq("id", mapping.id)
      .eq("user_id", userId);

    if (error) {
      console.error("[calendar] could not record sync failure", {
        code: error.code,
      });
    }

    return;
  }

  const { error } = await supabase
    .from("google_calendar_event_mappings")
    .upsert(
      {
        user_id: userId,
        session_id: sessionId,
        calendar_id: "primary",
        google_event_id: null,
        status: "failed",
        attempt_count: attemptCount,
        next_attempt_at: nextAttemptAtIso,
        last_error_category: category,
      },
      { onConflict: "user_id,session_id" },
    );

  if (error) {
    console.error("[calendar] could not record sync failure", {
      code: error.code,
    });
  }
}

/**
 * Creates, updates, or removes the Google event for one session.
 *
 * Idempotency has two layers: the unique mapping row, and a private extended
 * property on the event itself. A retry after a partial failure therefore finds
 * the event it already created instead of adding a duplicate. Callers must have
 * authorised the user for this session; the cron path is authorised by the
 * mapping row itself.
 */
export async function syncSessionForUser(
  userId: string,
  sessionId: string,
): Promise<CalendarSyncResult> {
  const supabase = createSupabaseAdminClient();
  const { data: session } = await supabase
    .from("discussion_sessions")
    .select(SESSION_COLUMNS)
    .eq("id", sessionId)
    .maybeSingle<SessionForSync>();

  if (!session) {
    throw new CalendarSyncError("session_not_found", "Session not found.");
  }

  const { data: mapping } = await supabase
    .from("google_calendar_event_mappings")
    .select("id, google_event_id, status, attempt_count, calendar_id")
    .eq("user_id", userId)
    .eq("session_id", sessionId)
    .maybeSingle<MappingRow>();

  try {
    const { accessToken, calendarId } = await getValidAccessToken(userId);

    // A cancelled or completed session must not leave a live event behind.
    if (session.status !== "scheduled") {
      if (mapping?.google_event_id) {
        await deleteManagedEvent(
          accessToken,
          calendarId,
          mapping.google_event_id,
        );
      }

      await supabase.from("google_calendar_event_mappings").upsert(
        {
          user_id: userId,
          session_id: sessionId,
          calendar_id: calendarId,
          google_event_id: mapping?.google_event_id ?? null,
          status: "deleted" as const,
          attempt_count: 0,
          last_error_category: null,
          last_synced_at: new Date().toISOString(),
        },
        { onConflict: "user_id,session_id" },
      );

      return { status: "removed" };
    }

    const body = buildGoogleEventBody(toEventSource(session));
    let eventId = mapping?.google_event_id ?? null;

    if (eventId) {
      try {
        await updateManagedEvent(accessToken, calendarId, eventId, body);
      } catch (error) {
        // The user deleted the event from their calendar: recreate it rather
        // than reporting a permanent failure.
        if (error instanceof GoogleApiError && error.category === "not_found") {
          eventId = null;
        } else {
          throw error;
        }
      }
    }

    if (!eventId) {
      const existing = await findManagedEvent(
        accessToken,
        calendarId,
        sessionId,
      );

      if (existing) {
        await updateManagedEvent(accessToken, calendarId, existing, body);
        eventId = existing;
      } else {
        eventId = await insertManagedEvent(accessToken, calendarId, body);
      }
    }

    const { error } = await supabase
      .from("google_calendar_event_mappings")
      .upsert(
        {
          user_id: userId,
          session_id: sessionId,
          calendar_id: calendarId,
          google_event_id: eventId,
          status: "synced" as const,
          attempt_count: 0,
          next_attempt_at: new Date().toISOString(),
          last_synced_at: new Date().toISOString(),
          last_error_category: null,
        },
        { onConflict: "user_id,session_id" },
      );

    if (error) {
      throw new CalendarSyncError(
        "transient",
        "Could not record the calendar mapping.",
      );
    }

    return { status: "synced", eventId };
  } catch (error) {
    const category = toFailure(error);

    await recordFailure(userId, sessionId, mapping ?? null, category);

    if (category === "revoked") {
      await markConnectionRevoked(userId, "revoked");
    }

    return { status: "failed", category };
  }
}

export type CalendarSyncBatchSummary = {
  candidates: number;
  synced: number;
  removed: number;
  failed: number;
};

/**
 * Retries every mapping that is due: newly created, stale after a session edit,
 * or failed with backoff elapsed.
 *
 * The sync itself is idempotent, so two overlapping cron runs converge on one
 * event instead of duplicating it.
 */
export async function processDueCalendarSyncs(
  limit = 20,
): Promise<CalendarSyncBatchSummary> {
  const summary: CalendarSyncBatchSummary = {
    candidates: 0,
    synced: 0,
    removed: 0,
    failed: 0,
  };

  if (!isGoogleCalendarConfigured()) {
    return summary;
  }

  const supabase = createSupabaseAdminClient();
  const nowIso = new Date().toISOString();
  const { data, error } = await supabase
    .from("google_calendar_event_mappings")
    .select("user_id, session_id")
    .in("status", ["pending", "out_of_sync", "failed"])
    .lte("next_attempt_at", nowIso)
    .order("next_attempt_at", { ascending: true })
    .limit(limit);

  if (error) {
    throw new Error("Could not load calendar sync queue");
  }

  summary.candidates = data?.length ?? 0;

  for (const row of data ?? []) {
    const result = await syncSessionForUser(row.user_id, row.session_id);

    if (result.status === "synced") {
      summary.synced += 1;
    } else if (result.status === "removed") {
      summary.removed += 1;
    } else {
      summary.failed += 1;
    }
  }

  return summary;
}

function safeDecrypt(payload: string, key: Buffer): string | null {
  try {
    return decryptToken(payload, key);
  } catch {
    return null;
  }
}
