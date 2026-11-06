package id.starstask.mobile.data

import android.content.Context
import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import java.io.File

/**
 * Offline check-in queue, mirroring the web offline-queue module.
 *
 * When a check-in cannot reach the server (no signal on campus), the
 * captured position is persisted to a JSON file and retried by
 * [syncOfflineQueue] once connectivity returns. Items only leave the
 * queue after the server accepts them — a rejected item stays queued
 * instead of being silently dropped.
 */
@Serializable
data class PendingCheckIn(
    val id: String,
    val sessionId: String,
    val userId: String,
    val latitude: Double,
    val longitude: Double,
    val accuracyM: Double,
    val fullName: String,
    val nim: String,
    val capturedAt: String,
)

private const val QUEUE_FILE = "offline-checkins.json"
private val queueJson = Json { ignoreUnknownKeys = true }

private fun queueFile(context: Context): File =
    File(context.filesDir, QUEUE_FILE)

fun getOfflineQueue(context: Context): List<PendingCheckIn> {
    return try {
        val raw = queueFile(context).readText()
        queueJson.decodeFromString<List<PendingCheckIn>>(raw)
    } catch (_: Exception) {
        emptyList()
    }
}

private fun saveQueue(context: Context, queue: List<PendingCheckIn>) {
    try {
        queueFile(context).writeText(queueJson.encodeToString(queue))
    } catch (_: Exception) {
        // Storage full/blocked: the queue simply does not persist this round.
    }
}

fun queueOfflineCheckin(
    context: Context,
    item: PendingCheckIn,
): PendingCheckIn {
    val queued = item.copy(
        id = "${System.currentTimeMillis()}-${(0..9999).random()}",
        capturedAt = java.time.Instant.now().toString(),
    )
    saveQueue(context, getOfflineQueue(context) + queued)
    return queued
}

suspend fun syncOfflineQueue(
    context: Context,
    send: suspend (PendingCheckIn) -> Boolean,
): Pair<Int, Int> {
    val queue = getOfflineQueue(context)
    val remaining = mutableListOf<PendingCheckIn>()
    var synced = 0

    for (item in queue) {
        val ok = try {
            send(item)
        } catch (_: Exception) {
            false
        }
        if (ok) {
            synced += 1
        } else {
            remaining.add(item)
        }
    }

    saveQueue(context, remaining)
    return synced to remaining.size
}
