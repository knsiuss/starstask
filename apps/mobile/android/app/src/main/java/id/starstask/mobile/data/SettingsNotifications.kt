package id.starstask.mobile.data

import io.github.jan.supabase.postgrest.postgrest
import io.github.jan.supabase.postgrest.query.Columns
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put

// Native mirror of web notification settings (apps/web/src/lib/db/push.ts):
// getNotificationPreferences, updateNotificationPreferences (update-then-insert),
// listPushDevices, deletePushDevice. Web push subscription (VAPID) is browser-only,
// so native shows read-only device info + preference toggles.

val DEFAULT_NOTIFICATION_TIMEZONE: String get() = DEVICE_ZONE.id

data class NotificationPreferences(
    val pushEnabled: Boolean = false,
    val reminder24h: Boolean = true,
    val reminder3h: Boolean = true,
    val sessionReminder24h: Boolean = true,
    val sessionReminder3h: Boolean = true,
    val timezone: String = DEFAULT_NOTIFICATION_TIMEZONE,
)

val DEFAULT_NOTIFICATION_PREFERENCES = NotificationPreferences()

data class PushDevice(
    val id: String,
    val deviceLabel: String?,
    val createdAt: String,
    val lastSuccessAt: String?,
)

suspend fun loadNotificationPreferences(userId: String): NotificationPreferences {
    val rows = SupabaseProvider.client.postgrest
        .from("notification_preferences")
        .select(
            Columns.list(
                "push_enabled",
                "reminder_24h",
                "reminder_3h",
                "session_reminder_24h",
                "session_reminder_3h",
                "timezone",
            ),
        ) {
            filter { eq("user_id", userId) }
            limit(1)
        }.decodeJsonArray()
    val obj = rows.firstOrNull()?.jsonObject ?: return DEFAULT_NOTIFICATION_PREFERENCES
    fun bool(key: String, default: Boolean): Boolean =
        obj[key]?.jsonPrimitive?.contentOrNull()?.let { it == "true" } ?: default
    return NotificationPreferences(
        pushEnabled = bool("push_enabled", false),
        reminder24h = bool("reminder_24h", true),
        reminder3h = bool("reminder_3h", true),
        sessionReminder24h = bool("session_reminder_24h", true),
        sessionReminder3h = bool("session_reminder_3h", true),
        timezone = obj["timezone"]?.jsonPrimitive?.contentOrNull() ?: DEFAULT_NOTIFICATION_TIMEZONE,
    )
}

private fun preferencesJson(prefs: NotificationPreferences) = buildJsonObject {
    put("push_enabled", JsonPrimitive(prefs.pushEnabled))
    put("reminder_24h", JsonPrimitive(prefs.reminder24h))
    put("reminder_3h", JsonPrimitive(prefs.reminder3h))
    put("session_reminder_24h", JsonPrimitive(prefs.sessionReminder24h))
    put("session_reminder_3h", JsonPrimitive(prefs.sessionReminder3h))
    put("timezone", JsonPrimitive(prefs.timezone))
}

/** Web merges a partial patch then UPDATEs, INSERTs on miss. Native always writes the full merged value. */
suspend fun saveNotificationPreferences(userId: String, prefs: NotificationPreferences): NotificationPreferences {
    val db = SupabaseProvider.client.postgrest
    val updated = db.from("notification_preferences").update(preferencesJson(prefs)) {
        filter { eq("user_id", userId) }
    }.decodeJsonArray()
    if (updated.isNotEmpty()) return prefs
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
    return prefs
}

suspend fun loadPushDevices(userId: String): List<PushDevice> {
    val rows = SupabaseProvider.client.postgrest
        .from("push_subscriptions")
        .select(Columns.list("id", "device_label", "created_at", "last_success_at")) {
            filter { eq("user_id", userId) }
            order("created_at", io.github.jan.supabase.postgrest.query.Order.DESCENDING)
            limit(20)
        }.decodeJsonArray()
    return rows.mapNotNull { row ->
        val obj = row.jsonObject
        val id = obj["id"]?.jsonPrimitive?.contentOrNull() ?: return@mapNotNull null
        PushDevice(
            id = id,
            deviceLabel = obj["device_label"]?.jsonPrimitive?.contentOrNull(),
            createdAt = obj["created_at"]?.jsonPrimitive?.contentOrNull() ?: "",
            lastSuccessAt = obj["last_success_at"]?.jsonPrimitive?.contentOrNull(),
        )
    }
}

suspend fun deletePushDevice(userId: String, deviceId: String): Boolean {
    val rows = SupabaseProvider.client.postgrest
        .from("push_subscriptions").delete {
            filter { eq("id", deviceId); eq("user_id", userId) }
        }.decodeJsonArray()
    return rows.isNotEmpty()
}
