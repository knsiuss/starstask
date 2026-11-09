package id.starstask.mobile.data

import io.github.jan.supabase.postgrest.postgrest
import io.github.jan.supabase.postgrest.query.Columns
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive

// Native mirror of web calendar + drive settings:
// - getCalendarConnectionSummary in google-calendar-service.ts
// - getDriveConnectionPublic in google-drive-connections.ts
// Only non-sensitive columns are selected; tokens never leave the server.

data class CalendarConnectionSummary(
    val connected: Boolean,
    val status: String?,
    val calendarId: String?,
    val connectedAt: String?,
    val lastRefreshedAt: String?,
    val lastErrorCategory: String?,
)

data class DriveConnectionPublic(
    val status: String,
    val driveEmail: String?,
    val connectedAt: String?,
) {
    val connected: Boolean get() = status == "connected"
}

/** Web: summary.configured is server-side config (not in DB). Native shows connection state only. */
suspend fun loadCalendarConnection(userId: String): CalendarConnectionSummary? {
    val rows = SupabaseProvider.client.postgrest
        .from("google_calendar_connections")
        .select(
            Columns.list(
                "calendar_id",
                "status",
                "connected_at",
                "last_refreshed_at",
                "last_error_category",
            ),
        ) {
            filter { eq("user_id", userId) }
            limit(1)
        }.decodeJsonArray()
    val obj = rows.firstOrNull()?.jsonObject ?: return null
    val status = obj["status"]?.jsonPrimitive?.contentOrNull()
    return CalendarConnectionSummary(
        connected = status == "connected",
        status = status,
        calendarId = obj["calendar_id"]?.jsonPrimitive?.contentOrNull(),
        connectedAt = obj["connected_at"]?.jsonPrimitive?.contentOrNull(),
        lastRefreshedAt = obj["last_refreshed_at"]?.jsonPrimitive?.contentOrNull(),
        lastErrorCategory = obj["last_error_category"]?.jsonPrimitive?.contentOrNull(),
    )
}

/** Web reads via admin client; native reads the caller's own row via RLS (user-scoped). */
suspend fun loadDriveConnection(userId: String): DriveConnectionPublic? {
    val rows = SupabaseProvider.client.postgrest
        .from("google_drive_connections")
        .select(
            Columns.list("status", "drive_email", "connected_at"),
        ) {
            filter { eq("user_id", userId) }
            limit(1)
        }.decodeJsonArray()
    val obj = rows.firstOrNull()?.jsonObject ?: return null
    val status = obj["status"]?.jsonPrimitive?.contentOrNull() ?: "error"
    return DriveConnectionPublic(
        status = status,
        driveEmail = obj["drive_email"]?.jsonPrimitive?.contentOrNull(),
        connectedAt = obj["connected_at"]?.jsonPrimitive?.contentOrNull(),
    )
}

/** Web disconnect calls a server route that revokes + deletes tokens. Native shell has no OAuth client; show status only. */
fun calendarErrorLabel(category: String?): String = when (category) {
    "invalid_grant" -> "Google revoked the permission. Reconnect to keep syncing."
    "transient" -> "Google did not respond. Try again in a moment."
    "invalid_request" -> "Google rejected the request. Reconnect to try again."
    else -> "The last sync failed. Reconnect to try again."
}
