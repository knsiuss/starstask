package id.starstask.mobile.data

import android.content.Context
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.serialization.Serializable
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import java.io.File
import java.nio.file.Files
import java.nio.file.StandardCopyOption

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
    /** Wall-clock millis of capture (epoch), for display deltas, not an offset. */
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

/** Row shape written before `capturedAtMs` became a required field. */
@Serializable
private data class LegacyPendingCheckIn(
    val id: String,
    val sessionId: String,
    val userId: String,
    val latitude: Double,
    val longitude: Double,
    val accuracyM: Double,
    val fullName: String,
    val nim: String,
    val timeFromGnss: Boolean = true,
    val deviceClockAuto: Boolean = true,
    val deviceTimeMs: Long = 0L,
    val provider: String? = null,
    val sessionKind: String = "legacy",
    val capturedAt: String = "",
)

private const val QUEUE_FILE = "offline-checkins.json"
private const val DEAD_LETTER_LIMIT = 20
private val queueJson = Json {
    ignoreUnknownKeys = true
    encodeDefaults = true
}

private val queueMutex = Mutex()

private fun queueFile(context: Context): File =
    File(context.filesDir, QUEUE_FILE)

private fun LegacyPendingCheckIn.toPending(): PendingCheckIn = PendingCheckIn(
    id = id,
    sessionId = sessionId,
    userId = userId,
    latitude = latitude,
    longitude = longitude,
    accuracyM = accuracyM,
    fullName = fullName,
    nim = nim,
    capturedAtMs = deviceTimeMs.takeIf { it > 0L } ?: System.currentTimeMillis(),
    timeFromGnss = timeFromGnss,
    deviceClockAuto = deviceClockAuto,
    deviceTimeMs = deviceTimeMs,
    provider = provider,
    sessionKind = sessionKind,
    capturedAt = capturedAt,
)

private fun readFile(context: Context): QueueFile {
    val file = queueFile(context)
    if (!file.exists()) return QueueFile()
    val raw = runCatching { file.readText() }.getOrNull() ?: return QueueFile()
    // Current format: QueueFile wrapper. Older installs wrote a bare list
    // whose rows predate the required `capturedAtMs`, so migrate on read
    // instead of dropping them.
    runCatching { return queueJson.decodeFromString<QueueFile>(raw) }
    runCatching {
        val legacy = queueJson.decodeFromString<List<LegacyPendingCheckIn>>(raw)
        return QueueFile(pending = legacy.map { it.toPending() })
    }
    return QueueFile()
}

private fun writeFile(context: Context, value: QueueFile) {
    val file = queueFile(context)
    val tmp = File(file.parentFile, "${file.name}.tmp")
    try {
        tmp.writeText(queueJson.encodeToString(value))
        moveAtomically(tmp, file)
    } catch (_: Exception) {
        runCatching { tmp.delete() }
    }
}

private fun moveAtomically(tmp: File, target: File) {
    try {
        Files.move(
            tmp.toPath(),
            target.toPath(),
            StandardCopyOption.ATOMIC_MOVE,
            StandardCopyOption.REPLACE_EXISTING,
        )
    } catch (_: Exception) {
        // ATOMIC_MOVE unsupported (cross-filesystem / some devices): plain rename.
        if (!tmp.renameTo(target)) {
            tmp.delete()
        }
    }
}

fun getOfflineQueue(context: Context): List<PendingCheckIn> = readFile(context).pending

fun getDeadLetterQueue(context: Context): List<DeadLetterCheckIn> = readFile(context).deadLetter

fun countOfflineQueue(context: Context, userId: String): Int =
    readFile(context).pending.count { it.userId == userId }

fun pendingForSession(context: Context, userId: String, sessionId: String): Boolean =
    readFile(context).pending.any { it.userId == userId && it.sessionId == sessionId }

suspend fun queueOfflineCheckin(
    context: Context,
    item: PendingCheckIn,
): PendingCheckIn = queueMutex.withLock {
    val queued = item.copy(
        id = "${System.currentTimeMillis()}-${(0..9999).random()}",
        capturedAt = java.time.Instant.ofEpochMilli(item.capturedAtMs).toString(),
    )
    val current = readFile(context)
    writeFile(context, current.copy(pending = current.pending + queued))
    CheckInSyncWorker.enqueue(context)
    queued
}

/**
 * @param send returns SyncOutcome so the caller can tell a transport failure
 *   (stay queued) from a definitive server rejection (move to dead-letter).
 *
 * The file read/modify/write runs under the queue mutex; `send` itself runs
 * outside the lock so a slow network no longer blocks enqueue, but callers
 * must accept that an item synced here can race a foreground enqueue (the
 * merge is last-write-wins on the pending list, which is why the server
 * treats repeats as `already_checked_in`).
 */
suspend fun syncOfflineQueue(
    context: Context,
    userId: String,
    send: suspend (PendingCheckIn) -> SyncOutcome,
): Pair<Int, Int> {
    val snapshot = queueMutex.withLock { readFile(context) }
    val remaining = mutableListOf<PendingCheckIn>()
    val deadLetter = snapshot.deadLetter.toMutableList()
    var synced = 0

    for (item in snapshot.pending) {
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

    queueMutex.withLock {
        val latest = readFile(context)
        // Merge instead of blind overwrite: keep rows queued by a concurrent
        // enqueue that happened while `send` ran.
        val mergedPending = remaining + latest.pending.filter { queued ->
            remaining.none { it.id == queued.id } &&
                snapshot.pending.none { it.id == queued.id }
        }
        writeFile(
            context,
            QueueFile(
                pending = mergedPending,
                deadLetter = (deadLetter + latest.deadLetter).distinctBy { it.item.id to it.reason }.take(DEAD_LETTER_LIMIT),
            ),
        )
    }
    return synced to remaining.size
}

sealed interface SyncOutcome {
    data object Synced : SyncOutcome

    /** Transient failure (no network, DNS, 5xx): keep the item. */
    data object Retry : SyncOutcome

    /** Server is certain: do not retry. */
    data class Rejected(val reason: String) : SyncOutcome
}
