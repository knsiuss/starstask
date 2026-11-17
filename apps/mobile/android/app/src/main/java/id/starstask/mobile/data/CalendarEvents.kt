package id.starstask.mobile.data

import io.github.jan.supabase.postgrest.postgrest
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put

// Native mirror of apps/web/src/lib/db/calendar-events.ts.
// Personal events are user-scoped; official events require class-admin role,
// enforced here in the client query scope and again by RLS on the server.

data class CalendarEventInput(
    val title: String,
    val description: String?,
    val startsAtIso: String,
    val endsAtIso: String,
    val location: String?,
    val eventType: String? = null,
    val subjectId: String? = null,
)

private suspend fun requireSubjectInClass(classId: String, subjectId: String?): Boolean {
    if (subjectId == null) return true
    val rows = SupabaseProvider.client.postgrest.from("class_subjects").select {
        filter { eq("id", subjectId) }
        limit(1L)
    }.decodeJsonArray()
    val row = rows.firstOrNull()?.jsonObject ?: return false
    return row["class_id"]?.jsonPrimitive?.contentOrNull() == classId
}

private fun eventJson(input: CalendarEventInput): kotlinx.serialization.json.JsonObject =
    buildJsonObject {
        put("title", JsonPrimitive(input.title.trim()))
        put("starts_at", JsonPrimitive(input.startsAtIso))
        put("ends_at", JsonPrimitive(input.endsAtIso))
        put("time_zone", JsonPrimitive(CALENDAR_TZ))
        if (input.description.isNullOrBlank()) put("description", JsonNull) else put("description", JsonPrimitive(input.description.trim()))
        if (input.location.isNullOrBlank()) put("location", JsonNull) else put("location", JsonPrimitive(input.location.trim()))
    }

suspend fun createPersonalEvent(userId: String, input: CalendarEventInput): String {
    val db = SupabaseProvider.client.postgrest
    val rows = db.from("personal_calendar_events").insert(
        buildJsonObject {
            put("user_id", JsonPrimitive(userId))
            put("title", JsonPrimitive(input.title.trim()))
            put("starts_at", JsonPrimitive(input.startsAtIso))
            put("ends_at", JsonPrimitive(input.endsAtIso))
            put("time_zone", JsonPrimitive(CALENDAR_TZ))
            put("description", input.description?.takeIf { it.isNotBlank() }?.let { JsonPrimitive(it.trim()) } ?: JsonNull)
            put("location", input.location?.takeIf { it.isNotBlank() }?.let { JsonPrimitive(it.trim()) } ?: JsonNull)
        },
    ) { select() }.decodeJsonArray()
    return rows.firstOrNull()?.jsonObject?.get("id")?.jsonPrimitive?.content
        ?: throw IllegalStateException("Could not create the personal event")
}

suspend fun updatePersonalEvent(userId: String, eventId: String, input: CalendarEventInput): Boolean {
    val db = SupabaseProvider.client.postgrest
    val rows = db.from("personal_calendar_events").update(eventJson(input)) {
        filter { eq("id", eventId); eq("user_id", userId) }
    }.decodeJsonArray()
    return rows.isNotEmpty()
}

suspend fun deletePersonalEvent(userId: String, eventId: String): Boolean {
    val db = SupabaseProvider.client.postgrest
    val rows = db.from("personal_calendar_events").delete {
        filter { eq("id", eventId); eq("user_id", userId) }
    }.decodeJsonArray()
    return rows.isNotEmpty()
}

suspend fun setPersonalEventStatus(userId: String, eventId: String, status: String): Boolean {
    val db = SupabaseProvider.client.postgrest
    val rows = db.from("personal_calendar_events").update(buildJsonObject {
        put("status", JsonPrimitive(status))
    }) {
        filter { eq("id", eventId); eq("user_id", userId) }
    }.decodeJsonArray()
    return rows.isNotEmpty()
}

suspend fun createOfficialEvent(classId: String, userId: String, input: CalendarEventInput): String {
    if (!requireSubjectInClass(classId, input.subjectId)) {
        throw IllegalStateException("Subject not found in this class")
    }
    val db = SupabaseProvider.client.postgrest
    val rows = db.from("class_calendar_events").insert(
        buildJsonObject {
            put("class_id", JsonPrimitive(classId))
            put("subject_id", input.subjectId?.let { JsonPrimitive(it) } ?: JsonNull)
            put("title", JsonPrimitive(input.title.trim()))
            put("starts_at", JsonPrimitive(input.startsAtIso))
            put("ends_at", JsonPrimitive(input.endsAtIso))
            put("time_zone", JsonPrimitive(CALENDAR_TZ))
            put("event_type", JsonPrimitive(input.eventType ?: "academic_event"))
            put("description", input.description?.takeIf { it.isNotBlank() }?.let { JsonPrimitive(it.trim()) } ?: JsonNull)
            put("location", input.location?.takeIf { it.isNotBlank() }?.let { JsonPrimitive(it.trim()) } ?: JsonNull)
            put("created_by", JsonPrimitive(userId))
        },
    ) { select() }.decodeJsonArray()
    return rows.firstOrNull()?.jsonObject?.get("id")?.jsonPrimitive?.content
        ?: throw IllegalStateException("Could not create the official event")
}

suspend fun updateOfficialEvent(classId: String, eventId: String, input: CalendarEventInput): Boolean {
    if (!requireSubjectInClass(classId, input.subjectId)) {
        throw IllegalStateException("Subject not found in this class")
    }
    val db = SupabaseProvider.client.postgrest
    val rows = db.from("class_calendar_events").update(buildJsonObject {
        put("subject_id", input.subjectId?.let { JsonPrimitive(it) } ?: JsonNull)
        put("title", JsonPrimitive(input.title.trim()))
        put("starts_at", JsonPrimitive(input.startsAtIso))
        put("ends_at", JsonPrimitive(input.endsAtIso))
        put("time_zone", JsonPrimitive(CALENDAR_TZ))
        put("event_type", JsonPrimitive(input.eventType ?: "academic_event"))
        put("description", input.description?.takeIf { it.isNotBlank() }?.let { JsonPrimitive(it.trim()) } ?: JsonNull)
        put("location", input.location?.takeIf { it.isNotBlank() }?.let { JsonPrimitive(it.trim()) } ?: JsonNull)
    }) {
        filter { eq("id", eventId); eq("class_id", classId) }
    }.decodeJsonArray()
    return rows.isNotEmpty()
}

suspend fun setOfficialEventStatus(classId: String, eventId: String, status: String): Boolean {
    val db = SupabaseProvider.client.postgrest
    val rows = db.from("class_calendar_events").update(buildJsonObject {
        put("status", JsonPrimitive(status))
    }) {
        filter { eq("id", eventId); eq("class_id", classId) }
    }.decodeJsonArray()
    return rows.isNotEmpty()
}

/** Archiving keeps the row; only the status changes (web archiveClassCalendarEvent). */
suspend fun archiveOfficialEvent(classId: String, eventId: String): Boolean =
    setOfficialEventStatus(classId, eventId, "archived")
