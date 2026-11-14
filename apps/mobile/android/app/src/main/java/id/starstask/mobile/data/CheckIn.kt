package id.starstask.mobile.data

import android.content.Context
import io.github.jan.supabase.postgrest.postgrest
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put

/**
 * GPS check-in with offline queue, mirroring the web attendance flow.
 * Position is captured on device; the server RPC re-validates
 * membership, window, identity, accuracy, and radius.
 *
 * When the device cannot reach the server at capture time the caller
 * queues a [PendingCheckIn] and syncs later through
 * [syncOfflineAttendanceMeeting], which uses the offline RPC (no 60s
 * freshness) and marks the row `method = 'offline_sync'`.
 */

data class CheckInResult(val ok: Boolean, val status: String?, val message: String?)

private const val ACCURACY_MAX_M = 100.0

/** Captures one position; accuracy capped at [ACCURACY_MAX_M] (server limit is 100 m). */
suspend fun capturePosition(context: Context): CapturedPosition? {
    val outcome = capturePositionDetailed(context)
    val fix = (outcome as? CaptureOutcome.Fix)?.position ?: return null
    if (fix.accuracyM > ACCURACY_MAX_M) return null
    return fix
}

suspend fun checkInToSession(
    userId: String,
    sessionId: String,
    latitude: Double,
    longitude: Double,
    accuracyM: Double,
    capturedAtMs: Long = System.currentTimeMillis(),
): CheckInResult {
    val db = SupabaseProvider.client.postgrest

    val identity = loadAttendanceIdentity(userId)
    val fullName = identity?.fullName?.trim().orEmpty()
    val nim = identity?.nim?.trim().orEmpty()
    if (fullName.isEmpty() || nim.isEmpty()) {
        return CheckInResult(false, null, "Add your full name and NIM in your profile first.")
    }

    val data = db.rpc(
        "check_in_attendance_meeting",
        buildJsonObject {
            put("p_session_id", sessionId)
            put("p_full_name", fullName)
            put("p_nim", nim)
            put("p_latitude", latitude)
            put("p_longitude", longitude)
            put("p_accuracy_m", accuracyM)
            put("p_captured_at", java.time.Instant.ofEpochMilli(capturedAtMs).toString())
        },
    ).decodeAs<kotlinx.serialization.json.JsonObject>()

    val ok = data["ok"]?.jsonPrimitive?.content == "true"
    return CheckInResult(
        ok = ok,
        status = data["status"]?.jsonPrimitive?.content,
        message = data["message"]?.jsonPrimitive?.content,
    )
}

/**
 * Sync a queued offline check-in. The server validates against the captured
 * (GNSS) time, not the sync time, and records the row as offline_sync.
 */
suspend fun syncOfflineAttendanceMeeting(item: PendingCheckIn): SyncOutcome {
    val db = SupabaseProvider.client.postgrest
    val data = try {
        db.rpc(
            "sync_offline_attendance_meeting",
            buildJsonObject {
                put("p_session_id", item.sessionId)
                put("p_full_name", item.fullName)
                put("p_nim", item.nim)
                put("p_latitude", item.latitude)
                put("p_longitude", item.longitude)
                put("p_accuracy_m", item.accuracyM)
                put("p_captured_at", java.time.Instant.ofEpochMilli(item.capturedAtMs).toString())
                put("p_time_from_gnss", item.timeFromGnss)
                put("p_device_clock_auto", item.deviceClockAuto)
            },
        ).decodeAs<kotlinx.serialization.json.JsonObject>()
    } catch (_: Exception) {
        // Transport/RPC unreachable: try again later.
        return SyncOutcome.Retry
    }
    if (data["ok"]?.jsonPrimitive?.content == "true") {
        return SyncOutcome.Synced
    }
    val message = data["message"]?.jsonPrimitive?.content ?: "The server rejected this check-in."
    // Server envelopes always carry ok/code/message; an explicit rejection is final.
    return SyncOutcome.Rejected(message)
}
