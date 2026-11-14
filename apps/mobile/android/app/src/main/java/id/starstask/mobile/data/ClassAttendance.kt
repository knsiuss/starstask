package id.starstask.mobile.data

// userFacingMessage lives in UserFacingError.kt (same package).

// Attendance meetings for the class Attendance tab. Every read goes through the
// web's SECURITY DEFINER RPCs; the authorization boundary is can_manage_class /
// can_organize_class_sessions inside the function, never the client.

import io.github.jan.supabase.postgrest.postgrest
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put

data class AttendanceMeeting(
    val sessionId: String,
    val subjectId: String?,
    val subjectName: String,
    val subjectCode: String?,
    val meetingNumber: Int?,
    val meetingDate: String?,
    val title: String,
    val location: String?,
    val startsAt: String,
    val endsAt: String,
    val openedAt: String?,
    val closedAt: String?,
    val finalizedAt: String?,
    val closesAt: String?,
    val radiusM: Int,
    val lateAfterMinutes: Int,
    val phase: String,
    val expected: Int,
    val present: Int,
    val late: Int,
    val excused: Int,
    val sick: Int,
    val absent: Int,
    val notRecorded: Int,
    val failed: Int,
)

data class MeetingRosterEntry(
    val userId: String,
    val fullName: String,
    val nim: String?,
    val displayName: String?,
    val eligible: Boolean,
    val status: String,
    val method: String?,
    val distanceM: Double?,
    val identityVerified: Boolean,
)

data class MeetingFailure(
    val userId: String,
    val displayName: String,
    val outcome: String,
    val distanceM: Double?,
    val createdAt: String,
)

data class CorrectionAuditEntry(
    val id: String,
    val sessionId: String?,
    val meetingNumber: Int?,
    val studentName: String,
    val subjectName: String?,
    val previousStatus: String,
    val newStatus: String,
    val reason: String,
    val adminName: String?,
    val createdAt: String,
)

data class MemberAttendanceCounts(
    val userId: String,
    val present: Int,
    val late: Int,
    val excused: Int,
    val absent: Int,
    val unrecorded: Int,
)

data class SessionAttendanceCounts(
    val sessionId: String,
    val expected: Int,
    val present: Int,
    val late: Int,
    val excused: Int,
    val absent: Int,
    val unrecorded: Int,
)

suspend fun listAttendanceMeetings(classId: String): List<AttendanceMeeting> {
    val rows = SupabaseProvider.client.postgrest.rpc(
        "class_attendance_meeting_list",
        buildJsonObject { put("p_class_id", JsonPrimitive(classId)) },
    ).decodeJsonArray()

    val nowMs = System.currentTimeMillis()
    return rows.mapNotNull { element ->
        val o = element.jsonObject
        val sessionId = o["session_id"]?.jsonPrimitive?.contentOrNull() ?: return@mapNotNull null
        val startsAt = o["starts_at"]?.jsonPrimitive?.contentOrNull() ?: ""
        AttendanceMeeting(
            sessionId = sessionId,
            subjectId = o["subject_id"]?.jsonPrimitive?.contentOrNull(),
            subjectName = o["subject_name"]?.jsonPrimitive?.contentOrNull() ?: "Course",
            subjectCode = o["subject_code"]?.jsonPrimitive?.contentOrNull(),
            meetingNumber = o["meeting_number"]?.jsonPrimitive?.contentOrNull()?.toIntOrNull(),
            meetingDate = o["meeting_date"]?.jsonPrimitive?.contentOrNull(),
            title = o["title"]?.jsonPrimitive?.contentOrNull() ?: "Meeting",
            location = o["location"]?.jsonPrimitive?.contentOrNull(),
            startsAt = startsAt,
            endsAt = o["ends_at"]?.jsonPrimitive?.contentOrNull() ?: startsAt,
            openedAt = o["attendance_opened_at"]?.jsonPrimitive?.contentOrNull(),
            closedAt = o["attendance_closed_at"]?.jsonPrimitive?.contentOrNull(),
            finalizedAt = o["attendance_finalized_at"]?.jsonPrimitive?.contentOrNull(),
            closesAt = o["attendance_closes_at"]?.jsonPrimitive?.contentOrNull(),
            radiusM = o["radius_m"]?.jsonPrimitive?.contentOrNull()?.toIntOrNull() ?: 200,
            lateAfterMinutes = o["late_after_minutes"]?.jsonPrimitive?.contentOrNull()?.toIntOrNull() ?: 10,
            phase = resolveMeetingPhase(
                openedAt = o["attendance_opened_at"]?.jsonPrimitive?.contentOrNull(),
                closedAt = o["attendance_closed_at"]?.jsonPrimitive?.contentOrNull(),
                finalizedAt = o["attendance_finalized_at"]?.jsonPrimitive?.contentOrNull(),
                closesAt = o["attendance_closes_at"]?.jsonPrimitive?.contentOrNull(),
                endsAt = o["ends_at"]?.jsonPrimitive?.contentOrNull(),
                nowMs = nowMs,
            ),
            expected = o["expected_count"]?.jsonPrimitive?.contentOrNull()?.toIntOrNull() ?: 0,
            present = o["present_count"]?.jsonPrimitive?.contentOrNull()?.toIntOrNull() ?: 0,
            late = o["late_count"]?.jsonPrimitive?.contentOrNull()?.toIntOrNull() ?: 0,
            excused = o["excused_count"]?.jsonPrimitive?.contentOrNull()?.toIntOrNull() ?: 0,
            sick = o["sick_count"]?.jsonPrimitive?.contentOrNull()?.toIntOrNull() ?: 0,
            absent = o["absent_count"]?.jsonPrimitive?.contentOrNull()?.toIntOrNull() ?: 0,
            notRecorded = o["not_recorded_count"]?.jsonPrimitive?.contentOrNull()?.toIntOrNull() ?: 0,
            failed = o["failed_count"]?.jsonPrimitive?.contentOrNull()?.toIntOrNull() ?: 0,
        )
    }
}

/** Exact port of resolveAttendanceMeetingPhase in @starstask/contracts. */
fun resolveMeetingPhase(
    openedAt: String?,
    closedAt: String?,
    finalizedAt: String?,
    closesAt: String?,
    endsAt: String?,
    nowMs: Long,
): String {
    if (finalizedAt != null) return "finalized"
    if (closedAt != null) return "closed"
    if (openedAt == null) return "scheduled"
    val closes = (closesAt ?: endsAt)?.let { parseTimeMs(it) }
    if (closes != null && nowMs > closes) return "closed"
    return "open"
}

private fun parseTimeMs(iso: String): Long? = runCatching { java.time.Instant.parse(iso).toEpochMilli() }
    .recoverCatching { java.time.OffsetDateTime.parse(iso).toInstant().toEpochMilli() }
    .getOrNull()

suspend fun createAttendanceMeeting(
    classId: String,
    subjectId: String,
    meetingNumber: Int,
    meetingDate: String,
    startsAtIso: String,
    endsAtIso: String,
    location: String,
    lateAfterMinutes: Int,
    radiusM: Int,
    latitude: Double,
    longitude: Double,
    title: String?,
): String {
    val result = SupabaseProvider.client.postgrest.rpc(
        "create_attendance_meeting",
        buildJsonObject {
            put("p_class_id", JsonPrimitive(classId))
            put("p_subject_id", JsonPrimitive(subjectId))
            put("p_meeting_number", JsonPrimitive(meetingNumber))
            put("p_meeting_date", JsonPrimitive(meetingDate))
            put("p_starts_at", JsonPrimitive(startsAtIso))
            put("p_ends_at", JsonPrimitive(endsAtIso))
            put("p_opens_at", JsonNull)
            put("p_closes_at", JsonNull)
            put("p_location", JsonPrimitive(location))
            put("p_late_after_minutes", JsonPrimitive(lateAfterMinutes))
            put("p_latitude", JsonPrimitive(latitude))
            put("p_longitude", JsonPrimitive(longitude))
            put("p_radius_m", JsonPrimitive(radiusM))
            put("p_title", title?.let(::JsonPrimitive) ?: JsonNull)
        },
    )
    return result.decodeJsonPrimitive().content
}

suspend fun openAttendanceMeeting(sessionId: String) {
    SupabaseProvider.client.postgrest.rpc(
        "open_attendance_meeting",
        buildJsonObject { put("p_session_id", JsonPrimitive(sessionId)) },
    )
}

suspend fun closeAttendanceMeeting(sessionId: String, finalize: Boolean): Int {
    // Returns the number of absent rows written when finalizing.
    return SupabaseProvider.client.postgrest.rpc(
        "close_attendance_meeting",
        buildJsonObject {
            put("p_session_id", JsonPrimitive(sessionId))
            put("p_finalize", JsonPrimitive(finalize))
        },
    ).decodeJsonPrimitive().content.toIntOrNull() ?: 0
}

suspend fun reopenAttendanceMeeting(sessionId: String) {
    SupabaseProvider.client.postgrest.rpc(
        "reopen_attendance_meeting",
        buildJsonObject { put("p_session_id", JsonPrimitive(sessionId)) },
    )
}

suspend fun loadMeetingRoster(sessionId: String): List<MeetingRosterEntry> {
    val rows = SupabaseProvider.client.postgrest.rpc(
        "attendance_meeting_roster",
        buildJsonObject { put("p_session_id", JsonPrimitive(sessionId)) },
    ).decodeJsonArray()
    return rows.mapNotNull { element ->
        val o = element.jsonObject
        val userId = o["user_id"]?.jsonPrimitive?.contentOrNull() ?: return@mapNotNull null
        MeetingRosterEntry(
            userId = userId,
            fullName = o["full_name"]?.jsonPrimitive?.contentOrNull() ?: "Member",
            nim = o["nim"]?.jsonPrimitive?.contentOrNull(),
            displayName = o["display_name"]?.jsonPrimitive?.contentOrNull(),
            eligible = o["eligible"]?.jsonPrimitive?.contentOrNull() == "true",
            status = o["status"]?.jsonPrimitive?.contentOrNull() ?: "not_recorded",
            method = o["method"]?.jsonPrimitive?.contentOrNull(),
            distanceM = o["distance_m"]?.jsonPrimitive?.contentOrNull()?.toDoubleOrNull(),
            identityVerified = o["identity_verified"]?.jsonPrimitive?.contentOrNull() == "true",
        )
    }
}

suspend fun loadMeetingFailures(sessionId: String): List<MeetingFailure> {
    val rows = SupabaseProvider.client.postgrest.rpc(
        "attendance_meeting_failures",
        buildJsonObject { put("p_session_id", JsonPrimitive(sessionId)) },
    ).decodeJsonArray()
    return rows.mapNotNull { element ->
        val o = element.jsonObject
        val userId = o["user_id"]?.jsonPrimitive?.contentOrNull() ?: return@mapNotNull null
        MeetingFailure(
            userId = userId,
            displayName = o["display_name"]?.jsonPrimitive?.contentOrNull() ?: "Member",
            outcome = o["outcome"]?.jsonPrimitive?.contentOrNull() ?: "unknown",
            distanceM = o["distance_m"]?.jsonPrimitive?.contentOrNull()?.toDoubleOrNull(),
            createdAt = o["created_at"]?.jsonPrimitive?.contentOrNull() ?: "",
        )
    }
}

suspend fun recordAttendanceCorrection(
    sessionId: String,
    userId: String,
    status: String,
    reason: String,
    physicallyVerified: Boolean,
) {
    SupabaseProvider.client.postgrest.rpc(
        "record_attendance_correction",
        buildJsonObject {
            put("p_session_id", JsonPrimitive(sessionId))
            put("p_user_id", JsonPrimitive(userId))
            put("p_status", JsonPrimitive(status))
            put("p_reason", JsonPrimitive(reason))
            put("p_physically_verified", JsonPrimitive(physicallyVerified))
        },
    )
}

suspend fun loadCorrectionAudit(classId: String, subjectId: String? = null): List<CorrectionAuditEntry> {
    val rows = SupabaseProvider.client.postgrest.rpc(
        "attendance_correction_audit_list",
        buildJsonObject {
            put("p_class_id", JsonPrimitive(classId))
            put("p_subject_id", subjectId?.let(::JsonPrimitive) ?: JsonNull)
        },
    ).decodeJsonArray()
    return rows.mapNotNull { element ->
        val o = element.jsonObject
        val id = o["id"]?.jsonPrimitive?.contentOrNull() ?: return@mapNotNull null
        CorrectionAuditEntry(
            id = id,
            sessionId = o["session_id"]?.jsonPrimitive?.contentOrNull(),
            meetingNumber = o["meeting_number"]?.jsonPrimitive?.contentOrNull()?.toIntOrNull(),
            studentName = o["student_name"]?.jsonPrimitive?.contentOrNull() ?: "Student",
            subjectName = o["subject_name"]?.jsonPrimitive?.contentOrNull(),
            previousStatus = o["previous_status"]?.jsonPrimitive?.contentOrNull() ?: "",
            newStatus = o["new_status"]?.jsonPrimitive?.contentOrNull() ?: "",
            reason = o["reason"]?.jsonPrimitive?.contentOrNull() ?: "",
            adminName = o["admin_name"]?.jsonPrimitive?.contentOrNull(),
            createdAt = o["created_at"]?.jsonPrimitive?.contentOrNull() ?: "",
        )
    }
}

suspend fun loadMemberAttendanceCounts(classId: String): List<MemberAttendanceCounts> {
    val rows = SupabaseProvider.client.postgrest.rpc(
        "class_attendance_member_summary",
        buildJsonObject { put("p_class_id", JsonPrimitive(classId)) },
    ).decodeJsonArray()
    return rows.mapNotNull { element ->
        val o = element.jsonObject
        val userId = o["user_id"]?.jsonPrimitive?.contentOrNull() ?: return@mapNotNull null
        MemberAttendanceCounts(
            userId = userId,
            present = o["present_count"]?.jsonPrimitive?.contentOrNull()?.toLongOrNull()?.toInt() ?: 0,
            late = o["late_count"]?.jsonPrimitive?.contentOrNull()?.toLongOrNull()?.toInt() ?: 0,
            excused = o["excused_count"]?.jsonPrimitive?.contentOrNull()?.toLongOrNull()?.toInt() ?: 0,
            absent = o["absent_count"]?.jsonPrimitive?.contentOrNull()?.toLongOrNull()?.toInt() ?: 0,
            unrecorded = o["unrecorded_count"]?.jsonPrimitive?.contentOrNull()?.toLongOrNull()?.toInt() ?: 0,
        )
    }
}

suspend fun loadSessionAttendanceCounts(classId: String): List<SessionAttendanceCounts> {
    val rows = SupabaseProvider.client.postgrest.rpc(
        "class_attendance_session_summary",
        buildJsonObject { put("p_class_id", JsonPrimitive(classId)) },
    ).decodeJsonArray()
    return rows.mapNotNull { element ->
        val o = element.jsonObject
        val sessionId = o["session_id"]?.jsonPrimitive?.contentOrNull() ?: return@mapNotNull null
        SessionAttendanceCounts(
            sessionId = sessionId,
            expected = o["expected_count"]?.jsonPrimitive?.contentOrNull()?.toLongOrNull()?.toInt() ?: 0,
            present = o["present_count"]?.jsonPrimitive?.contentOrNull()?.toLongOrNull()?.toInt() ?: 0,
            late = o["late_count"]?.jsonPrimitive?.contentOrNull()?.toLongOrNull()?.toInt() ?: 0,
            excused = o["excused_count"]?.jsonPrimitive?.contentOrNull()?.toLongOrNull()?.toInt() ?: 0,
            absent = o["absent_count"]?.jsonPrimitive?.contentOrNull()?.toLongOrNull()?.toInt() ?: 0,
            unrecorded = o["unrecorded_count"]?.jsonPrimitive?.contentOrNull()?.toLongOrNull()?.toInt() ?: 0,
        )
    }
}

/** Audited location change for a scheduled meeting (mirrors web changeAttendanceMeetingLocation). */
suspend fun changeAttendanceMeetingLocation(
    sessionId: String,
    latitude: Double,
    longitude: Double,
    radiusM: Int,
    reason: String,
): String? {
    val trimmedReason = reason.trim()
    if (trimmedReason.length < 3) return "Explain why the location is changing."
    return try {
        SupabaseProvider.client.postgrest.rpc(
            "update_attendance_meeting_location",
            buildJsonObject {
                put("p_session_id", JsonPrimitive(sessionId))
                put("p_latitude", JsonPrimitive(latitude))
                put("p_longitude", JsonPrimitive(longitude))
                put("p_radius_m", JsonPrimitive(radiusM))
                put("p_reason", JsonPrimitive(trimmedReason))
            },
        )
        null
    } catch (error: Exception) {
        userFacingMessage(error, "Could not change the meeting location.")
    }
}
