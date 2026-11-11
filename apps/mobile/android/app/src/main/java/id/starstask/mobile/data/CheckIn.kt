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
 */

data class CheckInResult(val ok: Boolean, val status: String?, val message: String?)

private const val ACCURACY_MAX_M = 100.0

suspend fun capturePosition(context: Context): Triple<Double, Double, Double>? {
    val outcome = capturePositionDetailed(context)
    val fix = (outcome as? CaptureOutcome.Fix)?.position ?: return null
    if (fix.accuracyM > ACCURACY_MAX_M) return null
    return Triple(fix.latitude, fix.longitude, fix.accuracyM)
}

suspend fun checkInToSession(
    userId: String,
    sessionId: String,
    latitude: Double,
    longitude: Double,
    accuracyM: Double,
): CheckInResult {
    val db = SupabaseProvider.client.postgrest

    val profileRows = db.from("profiles").select {
        filter { eq("id", userId) }
        limit(1)
    }.decodeJsonArray()
    val profile = profileRows.firstOrNull()?.jsonObject
    val fullName = profile?.get("full_name")?.jsonPrimitive?.content?.trim().orEmpty()
    val nim = profile?.get("nim")?.jsonPrimitive?.content?.trim().orEmpty()

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
        },
    ).decodeAs<kotlinx.serialization.json.JsonObject>()

    val ok = data?.get("ok")?.jsonPrimitive?.content == "true"
    return CheckInResult(
        ok = ok,
        status = data?.get("status")?.jsonPrimitive?.content,
        message = data?.get("message")?.jsonPrimitive?.content,
    )
}
