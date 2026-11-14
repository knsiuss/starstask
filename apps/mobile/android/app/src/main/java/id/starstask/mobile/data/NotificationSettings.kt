package id.starstask.mobile.data

import com.google.firebase.messaging.FirebaseMessaging
import io.github.jan.supabase.postgrest.postgrest
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put
import kotlinx.coroutines.tasks.await
import kotlinx.serialization.json.jsonArray

/**
 * Native mirror of web notification settings + native push registration
 * (apps/web/src/lib/db/push.ts, components/push/notification-settings):
 * - Preferences live in `notification_preferences`; first save inserts,
 *   later saves update (RLS allows UPDATE on preference columns only,
 *   so an upsert would be rejected — same rule as web).
 * - Native tokens register via `register_native_push_token` (FCM token,
 *   platform "android"); a token owned by another account returns null.
 */

data class NotificationPrefs(
    val pushEnabled: Boolean = false,
    val reminder24h: Boolean = true,
    val reminder3h: Boolean = true,
    val sessionReminder24h: Boolean = true,
    val sessionReminder3h: Boolean = true,
    val timezone: String = DEVICE_ZONE.id,
)

private const val PREFS_COLUMNS =
    "push_enabled, reminder_24h, reminder_3h, session_reminder_24h, session_reminder_3h, timezone"

suspend fun loadNotificationPrefs(userId: String): NotificationPrefs {
    val rows = SupabaseProvider.client.postgrest.from("notification_preferences").select {
        filter { eq("user_id", userId) }
        limit(1)
    }.decodeJsonArray()
    val row = rows.firstOrNull()?.jsonObject ?: return NotificationPrefs()
    fun bool(key: String, default: Boolean) =
        row[key]?.jsonPrimitive?.content?.toBooleanStrictOrNull() ?: default
    return NotificationPrefs(
        pushEnabled = bool("push_enabled", false),
        reminder24h = bool("reminder_24h", true),
        reminder3h = bool("reminder_3h", true),
        sessionReminder24h = bool("session_reminder_24h", true),
        sessionReminder3h = bool("session_reminder_3h", true),
        timezone = row["timezone"]?.jsonPrimitive?.contentOrNull() ?: DEVICE_ZONE.id,
    )
}

suspend fun saveNotificationPrefs(userId: String, prefs: NotificationPrefs) {
    val values = buildJsonObject {
        put("push_enabled", JsonPrimitive(prefs.pushEnabled))
        put("reminder_24h", JsonPrimitive(prefs.reminder24h))
        put("reminder_3h", JsonPrimitive(prefs.reminder3h))
        put("session_reminder_24h", JsonPrimitive(prefs.sessionReminder24h))
        put("session_reminder_3h", JsonPrimitive(prefs.sessionReminder3h))
        put("timezone", JsonPrimitive(prefs.timezone))
    }
    val db = SupabaseProvider.client.postgrest
    val updated = db.from("notification_preferences").update(values) {
        filter { eq("user_id", userId) }
        select()
    }.decodeJsonArray()
    if (updated.isNotEmpty()) return
    db.from("notification_preferences").insert(
        buildJsonObject {
            put("user_id", JsonPrimitive(userId))
            put("push_enabled", JsonPrimitive(prefs.pushEnabled))
            put("reminder_24h", JsonPrimitive(prefs.reminder24h))
            put("reminder_3h", JsonPrimitive(prefs.reminder3h))
            put("session_reminder_24h", JsonPrimitive(prefs.sessionReminder24h))
            put("session_reminder_3h", JsonPrimitive(prefs.sessionReminder3h))
            put("timezone", JsonPrimitive(prefs.timezone))
        },
    )
}

suspend fun registerNativePushToken(token: String, deviceLabel: String?): String? {
    val data = SupabaseProvider.client.postgrest.rpc(
        "register_native_push_token",
        buildJsonObject {
            put("p_token", JsonPrimitive(token))
            put("p_platform", JsonPrimitive("android"))
            put("p_device_label", deviceLabel?.let { JsonPrimitive(it) } ?: JsonNull)
        },
    )
    return try {
        kotlinx.serialization.json.Json.parseToJsonElement(data.toString()).jsonPrimitive.contentOrNull()
            ?.takeIf { it.isNotBlank() }
    } catch (_: Exception) {
        null
    }
}

suspend fun deleteNativePushToken(token: String) {
    SupabaseProvider.client.postgrest.rpc(
        "delete_native_push_token",
        buildJsonObject { put("p_token", JsonPrimitive(token)) },
    )
}

suspend fun currentFcmToken(): String =
    FirebaseMessaging.getInstance().token.await()

data class IntegrationStatus(
    val connected: Boolean = false,
    val status: String? = null,
    val calendarId: String? = null,
    val connectedAt: String? = null,
    val lastErrorCategory: String? = null,
)

suspend fun loadCalendarStatus(userId: String): IntegrationStatus {
    val rows = SupabaseProvider.client.postgrest.from("google_calendar_connections").select {
        filter { eq("user_id", userId) }
        limit(1)
    }.decodeJsonArray()
    return rows.firstOrNull()?.jsonObject?.let { row ->
        IntegrationStatus(
            connected = row["status"]?.jsonPrimitive?.contentOrNull() == "connected",
            status = row["status"]?.jsonPrimitive?.contentOrNull(),
            calendarId = row["calendar_id"]?.jsonPrimitive?.contentOrNull(),
            connectedAt = row["connected_at"]?.jsonPrimitive?.contentOrNull(),
            lastErrorCategory = row["last_error_category"]?.jsonPrimitive?.contentOrNull(),
        )
    } ?: IntegrationStatus()
}

suspend fun loadDriveStatus(userId: String): IntegrationStatus {
    val rows = SupabaseProvider.client.postgrest.from("google_drive_connections").select {
        filter { eq("user_id", userId) }
        limit(1)
    }.decodeJsonArray()
    return rows.firstOrNull()?.jsonObject?.let { row ->
        IntegrationStatus(
            connected = row["status"]?.jsonPrimitive?.contentOrNull() == "connected",
            status = row["status"]?.jsonPrimitive?.contentOrNull(),
            connectedAt = row["created_at"]?.jsonPrimitive?.contentOrNull()
                ?: row["connected_at"]?.jsonPrimitive?.contentOrNull(),
        )
    } ?: IntegrationStatus()
}
