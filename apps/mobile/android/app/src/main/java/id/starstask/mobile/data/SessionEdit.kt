package id.starstask.mobile.data

import io.github.jan.supabase.postgrest.postgrest
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put

/**
 * Session edit mirroring web updateSession
 * (apps/web/src/features/sessions/session-service.ts): RPC
 * update_discussion_session re-checks organize permission server-side.
 * The form only edits title/start/end/location; every other field is
 * preserved from the stored row.
 */

data class SessionDetail(
    val id: String,
    val title: String,
    val description: String?,
    val startsAt: String,
    val endsAt: String,
    val timeZone: String?,
    val sessionType: String?,
    val meetingUrl: String?,
    val location: String?,
    val agenda: String?,
    val capacity: Int?,
    val registrationDeadline: String?,
    val visibility: String?,
    val assignmentId: String?,
)

suspend fun loadSessionDetail(sessionId: String): SessionDetail? {
    val rows = SupabaseProvider.client.postgrest.from("discussion_sessions").select {
        filter { eq("id", sessionId) }
        limit(1)
    }.decodeJsonArray()
    val obj = rows.firstOrNull()?.jsonObject ?: return null
    return SessionDetail(
        id = obj["id"]?.jsonPrimitive?.content ?: return null,
        title = obj["title"]?.jsonPrimitive?.contentOrNull() ?: "Session",
        description = obj["description"]?.jsonPrimitive?.contentOrNull(),
        startsAt = obj["starts_at"]?.jsonPrimitive?.contentOrNull() ?: "",
        endsAt = obj["ends_at"]?.jsonPrimitive?.contentOrNull() ?: "",
        timeZone = obj["time_zone"]?.jsonPrimitive?.contentOrNull(),
        sessionType = obj["session_type"]?.jsonPrimitive?.contentOrNull(),
        meetingUrl = obj["meeting_url"]?.jsonPrimitive?.contentOrNull(),
        location = obj["location"]?.jsonPrimitive?.contentOrNull(),
        agenda = obj["agenda"]?.jsonPrimitive?.contentOrNull(),
        capacity = obj["capacity"]?.jsonPrimitive?.content?.toIntOrNull(),
        registrationDeadline = obj["registration_deadline"]?.jsonPrimitive?.contentOrNull(),
        visibility = obj["visibility"]?.jsonPrimitive?.contentOrNull(),
        assignmentId = obj["assignment_id"]?.jsonPrimitive?.contentOrNull(),
    )
}

/**
 * RSVP + check-in location, mirroring web features/sessions/session-service.ts.
 * Writes via RPCs so auth.uid() is the authority, never the body.
 */

suspend fun rsvpSession(sessionId: String, status: String): String? {
    val err = runCatching {
        SupabaseProvider.client.postgrest.rpc(
            "rsvp_discussion_session",
            buildJsonObject {
                put("p_session_id", JsonPrimitive(sessionId))
                put("p_status", JsonPrimitive(status))
            },
        )
    }.exceptionOrNull()
    return err?.let { userFacingMessage(it) }
}

suspend fun cancelRsvp(sessionId: String): String? {
    val err = runCatching {
        SupabaseProvider.client.postgrest.rpc(
            "cancel_session_rsvp",
            buildJsonObject { put("p_session_id", JsonPrimitive(sessionId)) },
        )
    }.exceptionOrNull()
    return err?.let { userFacingMessage(it) }
}

suspend fun setCheckInLocation(
    sessionId: String,
    latitude: Double,
    longitude: Double,
    radiusM: Int,
): String? {
    val err = runCatching {
        SupabaseProvider.client.postgrest.rpc(
            "set_discussion_session_checkin_location",
            buildJsonObject {
                put("p_session_id", JsonPrimitive(sessionId))
                put("p_latitude", JsonPrimitive(latitude))
                put("p_longitude", JsonPrimitive(longitude))
                put("p_radius_m", JsonPrimitive(radiusM))
            },
        )
    }.exceptionOrNull()
    return err?.let { userFacingMessage(it) }
}

suspend fun clearCheckInLocation(sessionId: String): String? {
    val err = runCatching {
        SupabaseProvider.client.postgrest.rpc(
            "clear_discussion_session_checkin_location",
            buildJsonObject { put("p_session_id", JsonPrimitive(sessionId)) },
        )
    }.exceptionOrNull()
    return err?.let { userFacingMessage(it) }
}

suspend fun updateSessionRecord(
    detail: SessionDetail,
    title: String,
    startsAtIso: String,
    endsAtIso: String,
    location: String?,
) {
    SupabaseProvider.client.postgrest.rpc(
        "update_discussion_session",
        buildJsonObject {
            put("p_session_id", JsonPrimitive(detail.id))
            put("p_title", JsonPrimitive(title.trim()))
            put("p_description", detail.description?.let { JsonPrimitive(it) } ?: JsonNull)
            put("p_starts_at", JsonPrimitive(startsAtIso))
            put("p_ends_at", JsonPrimitive(endsAtIso))
            put("p_time_zone", detail.timeZone?.let { JsonPrimitive(it) } ?: JsonPrimitive("Asia/Jakarta"))
            put("p_session_type", detail.sessionType?.let { JsonPrimitive(it) } ?: JsonPrimitive("offline"))
            put("p_meeting_url", detail.meetingUrl?.let { JsonPrimitive(it) } ?: JsonNull)
            put("p_location", location?.takeIf { it.isNotBlank() }?.let { JsonPrimitive(it) } ?: JsonNull)
            put("p_agenda", detail.agenda?.let { JsonPrimitive(it) } ?: JsonNull)
            put("p_capacity", detail.capacity?.let { JsonPrimitive(it) } ?: JsonNull)
            put("p_registration_deadline", detail.registrationDeadline?.let { JsonPrimitive(it) } ?: JsonNull)
            put("p_visibility", detail.visibility?.let { JsonPrimitive(it) } ?: JsonPrimitive("class"))
            put("p_assignment_id", detail.assignmentId?.let { JsonPrimitive(it) } ?: JsonNull)
        },
    )
}
