package id.starstask.mobile.data

import android.content.Context
import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import java.io.File

/**
 * Offline check-in queue.
 *
 * When a check-in cannot reach the server (no signal on campus), the
 * captured position is persisted to a JSON file and retried once
 * connectivity returns. Items only leave the queue after the server
 * accepts them. A rejection the server is sure about (outside radius,
 * meeting closed, window passed) moves to the dead-letter list instead of
 * being retried forever; a transport failure stays queued.
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
    /** Device/GNSS wall clock at capture (epoch millis). */
    val capturedAtMs: Long,
    /** True when capturedAtMs came from the satellite fix, not the device clock. */
    val timeFromGnss: Boolean = true,
    /** True when the device used network-provided time at capture. */
    val deviceClockAuto: Boolean = true,
    /** Device timezone offset (minutes) at capture, for display deltas. */
    val deviceTimeMs: Long = System.currentTimeMillis(),
    val provider: String? = null,
    /** meeting = check_in_attendance_meeting path; legacy = discussion_sessions. */
    val sessionKind: String = "meeting",
    val capturedAt: String = "",
)

@Serializable
data class DeadLetterCheckIn(
    val item: PendingCheckIn,
    val reason: String,
    val failedAtMs: Long,
)

@Serializable
private data class QueueFile(
    val pending: List<PendingCheckIn> = emptyList(),
    val deadLetter: List<DeadLetterCheckIn> = emptyList(),
)

private const val QUEUE_FILE = "offline-checkins.json"
private const val DEAD_LETTER_LIMIT = 20
private val queueJson = Json {
    ignoreUnknownKeys = true
    encodeDefaults = true
}

private fun queueFile(context: Context): File =
    File(context.filesDir, QUEUE_FILE)

private fun readFile(context: Context): QueueFile {
    val file = queueFile(context)
    if (!file.exists()) return QueueFile()
    val raw = runCatching { file.readText() }.getOrNull() ?: return QueueFile()
    // Current format is the QueueFile wrapper; older installs wrote a bare list.
    runCatching { return queueJson.decodeFromString<QueueFile>(raw) }
    runCatching {
        val legacy = queueJson.decodeFromString<List<PendingCheckIn>>(raw)
        return QueueFile(pending = legacy)
    }
    return QueueFile()
}

private fun writeFile(context: Context, value: QueueFile) {
    val file = queueFile(context)
    val tmp = File(file.parentFile, "${file.name}.tmp")
    try {
        tmp.writeText(queueJson.encodeToString(value))
        if (file.exists() && !file.delete()) {
            tmp.delete()
            return
        }
        if (!tmp.renameTo(file)) {
            tmp.delete()
        }
    } catch (_: Exception) {
        runCatching { tmp.delete() }
    }
}

fun getOfflineQueue(context: Context): List<PendingCheckIn> = readFile(context).pending

fun getDeadLetterQueue(context: Context): List<DeadLetterCheckIn> = readFile(context).deadLetter

fun countOfflineQueue(context: Context, userId: String): Int =
    readFile(context).pending.count { it.userId == userId }

fun pendingForSession(context: Context, userId: String, sessionId: String): Boolean =
    readFile(context).pending.any { it.userId == userId && it.sessionId == sessionId }

fun queueOfflineCheckin(
    context: Context,
    item: PendingCheckIn,
): PendingCheckIn {
    val queued = item.copy(
        id = "${System.currentTimeMillis()}-${(0..9999).random()}",
        capturedAt = java.time.Instant.ofEpochMilli(item.capturedAtMs).toString(),
    )
    val current = readFile(context)
    writeFile(context, current.copy(pending = current.pending + queued))
    CheckInSyncWorker.enqueue(context)
    return queued
}

/**
 * @param send returns SyncOutcome so the caller can tell a transport failure
 *   (stay queued) from a definitive server rejection (move to dead-letter).
 */
suspend fun syncOfflineQueue(
    context: Context,
    userId: String,
    send: suspend (PendingCheckIn) -> SyncOutcome,
): Pair<Int, Int> {
    val current = readFile(context)
    val remaining = mutableListOf<PendingCheckIn>()
    val deadLetter = current.deadLetter.toMutableList()
    var synced = 0

    for (item in current.pending) {
        // Queue rows from a previous account on this device are not ours to
        // submit, and not ours to drop.
        if (item.userId != userId) {
            remaining.add(item)
            continue
        }
        when (val outcome = runCatching { send(item) }.getOrElse { SyncOutcome.Retry }) {
            SyncOutcome.Synced -> synced += 1
            SyncOutcome.Retry -> remaining.add(item)
            is SyncOutcome.Rejected -> {
                deadLetter.add(0, DeadLetterCheckIn(item, outcome.reason, System.currentTimeMillis()))
            }
        }
    }

    writeFile(
        context,
        QueueFile(
            pending = remaining,
            deadLetter = deadLetter.take(DEAD_LETTER_LIMIT),
        ),
    )
    return synced to remaining.size
}

sealed interface SyncOutcome {
    data object Synced : SyncOutcome

    /** Transient failure (no network, DNS, 5xx): keep the item. */
    data object Retry : SyncOutcome

    /** Server is certain: do not retry. */
    data class Rejected(val reason: String) : SyncOutcome
}
