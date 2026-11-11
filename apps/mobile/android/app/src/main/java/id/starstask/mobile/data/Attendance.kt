package id.starstask.mobile.data

import io.github.jan.supabase.postgrest.postgrest
import io.github.jan.supabase.postgrest.query.Columns
import io.github.jan.supabase.postgrest.query.filter.FilterOperator
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put


// ---------------------------------------------------------------------------
// Attendance: GPS check-in (full params), history, recap.
// Mirrors the web checkin module: the check_in_attendance_meeting RPC
// re-validates membership, session state, window, identity, accuracy
// and radius server-side; the client only captures position + identity.
// ---------------------------------------------------------------------------

// Check-in capture + RPC lives in CheckIn.kt (canonical). The offline
// queue retry below reuses it with stored positions.

/** Retry queued check-ins for the signed-in user only; returns how many the server accepted. */
suspend fun syncQueuedCheckIns(context: android.content.Context, userId: String): Int {
    val (synced, _) = syncOfflineQueue(context, userId) { item ->
        when (item.sessionKind) {
            "legacy" -> {
                val result = checkInLegacySession(
                    item.sessionId,
                    item.latitude,
                    item.longitude,
                    item.accuracyM,
                    java.time.Instant.ofEpochMilli(item.capturedAtMs).toString(),
                )
                if (result.ok) SyncOutcome.Synced
                else SyncOutcome.Rejected(result.message ?: "The server rejected this check-in.")
            }
            else -> syncOfflineAttendanceMeeting(item)
        }
    }
    return synced
}

data class AttendanceHistoryEntry(
    val sessionId: String,
    val title: String,
    val startsAt: String,
    val className: String?,
    val status: String,
    val checkedInAt: String?,
)

suspend fun loadAttendanceHistory(userId: String): List<AttendanceHistoryEntry> {
    val db = SupabaseProvider.client.postgrest
    val checkIns = db.from("discussion_session_checkins").select {
        filter { eq("user_id", userId) }
        order("checked_in_at", io.github.jan.supabase.postgrest.query.Order.DESCENDING)
        limit(100)
    }.decodeJsonArray()

    if (checkIns.isEmpty()) return emptyList()

    val sessionIds = checkIns.mapNotNull { it.jsonObject["session_id"]?.jsonPrimitive?.content }.toSet()
    val sessions = db.from("discussion_sessions").select {
        filter { isIn("id", sessionIds.toList()) }
    }.decodeJsonArray().associateBy(
        { it.jsonObject["id"]!!.jsonPrimitive.content },
        { it.jsonObject },
    )

    val classIds = sessions.values.mapNotNull { it["class_id"]?.jsonPrimitive?.content }.toSet()
    val names = if (classIds.isEmpty()) emptyMap() else {
        db.from("classes").select {
            filter { isIn("id", classIds.toList()) }
        }.decodeJsonArray().associateBy(
            { it.jsonObject["id"]!!.jsonPrimitive.content },
            { it.jsonObject["name"]?.jsonPrimitive?.contentOrNull() },
        )
    }

    return checkIns.mapNotNull {
        val obj = it.jsonObject
        val sessionObj = sessions[obj["session_id"]?.jsonPrimitive?.content]
            ?: return@mapNotNull null
        AttendanceHistoryEntry(
            sessionId = sessionObj["id"]?.jsonPrimitive?.content ?: return@mapNotNull null,
            title = sessionObj["title"]?.jsonPrimitive?.contentOrNull() ?: "Session",
            startsAt = sessionObj["starts_at"]?.jsonPrimitive?.contentOrNull() ?: "",
            className = sessionObj["class_id"]?.jsonPrimitive?.contentOrNull()?.let(names::get),
            status = obj["status"]?.jsonPrimitive?.contentOrNull() ?: "present",
            checkedInAt = obj["checked_in_at"]?.jsonPrimitive?.contentOrNull(),
        )
    }
}

data class RecapSummary(
    val present: Int,
    val absent: Int,
    val excused: Int,
    val total: Int,
    val percentage: Int,
)

/**
 * Semester recap for the signed-in student, computed client-side from
 * their own check-ins (the class_attendance_recap RPC is class-manager
 * only, so students get their personal summary instead of the sheet).
 *
 * Attendance corrections (record_attendance_correction) and the correction
 * audit list are likewise organizer-only server-side â€” the web student UI
 * does not expose them either, so native does not either. Verification
 * attempts are recorded server-side by the check-in RPC itself.
 */
fun summarizeRecap(history: List<AttendanceHistoryEntry>): RecapSummary {
    val present = history.count { it.status == "present" }
    val excused = history.count { it.status == "excused" }
    val absent = history.count { it.status == "absent" }
    val total = history.size
    val percentage = if (total > 0) (present + excused) * 100 / total else 0
    return RecapSummary(present, absent, excused, total, percentage)
}
