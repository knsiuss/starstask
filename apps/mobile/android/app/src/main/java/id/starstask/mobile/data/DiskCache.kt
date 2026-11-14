package id.starstask.mobile.data

import android.content.Context
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import java.io.File
import java.security.MessageDigest

/**
 * Short-TTL on-disk cache for read models. Files live in the app's private
 * filesDir/disk-cache directory, so no other app can read them; they are
 * scoped per userId by hashing, and cleared on sign-out.
 *
 * Kept deliberately small: cached value is shown instantly on screen open,
 * then refreshed from the server in the background. Stale entries are
 * dropped on read once they expire; no network check happens first.
 */
private const val DISK_CACHE_DIR = "disk-cache"
private const val DISK_CACHE_TTL_MS = 5 * 60 * 1000L

private val diskCacheJson = Json { ignoreUnknownKeys = true; encodeDefaults = true }

private fun cacheFile(context: Context, userId: String, key: String): File {
    val digest = MessageDigest.getInstance("SHA-256")
        .digest("$userId|$key".toByteArray())
        .joinToString("") { "%02x".format(it) }
    return File(File(context.filesDir, DISK_CACHE_DIR), "$digest.json")
}

private fun cacheDir(context: Context): File =
    File(context.filesDir, DISK_CACHE_DIR).apply { mkdirs() }

internal fun <T> writeDiskCache(context: Context, userId: String, key: String, value: T, serializer: kotlinx.serialization.KSerializer<T>) {
    val file = cacheFile(context, userId, key)
    val tmp = File(file.parentFile, "${file.name}.tmp")
    try {
        tmp.writeText(diskCacheJson.encodeToString(serializer, value))
        if (file.exists() && !file.delete()) {
            tmp.delete()
            return
        }
        if (!tmp.renameTo(file)) tmp.delete()
    } catch (_: Exception) {
        runCatching { tmp.delete() }
    }
}

internal fun <T> readDiskCache(context: Context, userId: String, key: String, serializer: kotlinx.serialization.KSerializer<T>, ttlMs: Long = DISK_CACHE_TTL_MS): T? {
    val file = cacheFile(context, userId, key)
    if (!file.exists()) return null
    val ageMs = System.currentTimeMillis() - file.lastModified()
    if (ageMs > ttlMs) {
        runCatching { file.delete() }
        return null
    }
    return runCatching {
        diskCacheJson.decodeFromString(serializer, file.readText())
    }.getOrNull()
}

/** Deletes every cached read model for every user on this device. */
fun clearDiskCache(context: Context) {
    runCatching { cacheDir(context).listFiles()?.forEach { it.delete() } }
}
