package id.starstask.mobile.data

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.provider.OpenableColumns
import io.github.jan.supabase.postgrest.postgrest
import io.github.jan.supabase.storage.storage
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlin.time.Duration.Companion.minutes

/**
 * Attachment storage for the native shell, mirroring the web flow:
 * validate locally, upload bytes to the private bucket, then insert
 * the metadata row. Signed URLs are minted for viewing.
 */

data class AttachmentRef(
    val id: String,
    val filename: String,
    val storagePath: String,
    val mimeType: String? = null,
    val fileSize: Long? = null,
    val createdAt: String? = null,
)

data class UploadOutcome(val ok: Boolean, val filename: String?, val message: String?)

const val UPLOAD_MAX_BYTES = 10 * 1024 * 1024

val ALLOWED_EXTENSIONS = setOf(
    "pdf", "docx", "pptx", "xlsx", "png", "jpg", "jpeg", "csv", "ipynb",
    "txt", "md", "json", "zip", "mp4", "mp3", "py", "js", "ts", "tsx",
)

private val MIME_BY_EXTENSION = mapOf(
    "pdf" to "application/pdf",
    "docx" to "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "pptx" to "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "xlsx" to "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "png" to "image/png",
    "jpg" to "image/jpeg",
    "jpeg" to "image/jpeg",
    "csv" to "text/csv",
    "ipynb" to "application/json",
    "txt" to "text/plain",
    "md" to "text/markdown",
    "json" to "application/json",
    "zip" to "application/zip",
    "mp4" to "video/mp4",
    "mp3" to "audio/mpeg",
    "py" to "text/x-python",
    "js" to "text/javascript",
    "ts" to "text/typescript",
    "tsx" to "text/typescript",
)

fun mimeForExtension(extension: String): String =
    MIME_BY_EXTENSION[extension.lowercase()] ?: "application/octet-stream"

fun fileExtension(name: String): String = name.substringAfterLast('.', "").lowercase()

suspend fun listAttachments(assignmentId: String): List<AttachmentRef> {
    val db = SupabaseProvider.client.postgrest
    val rows = db.from("assignment_attachments").select {
        filter { eq("assignment_id", assignmentId) }
        order("created_at", io.github.jan.supabase.postgrest.query.Order.ASCENDING)
    }.decodeJsonArray()

    return rows.mapNotNull {
        val obj = it.jsonObject
        val fileSizeText = obj["file_size"]?.jsonPrimitive?.contentOrNull()
        AttachmentRef(
            id = obj["id"]?.jsonPrimitive?.content ?: return@mapNotNull null,
            filename = obj["original_filename"]?.jsonPrimitive?.content ?: "file",
            storagePath = obj["storage_path"]?.jsonPrimitive?.content ?: return@mapNotNull null,
            mimeType = obj["mime_type"]?.jsonPrimitive?.contentOrNull(),
            fileSize = fileSizeText?.toLongOrNull(),
            createdAt = obj["created_at"]?.jsonPrimitive?.contentOrNull(),
        )
    }
}

suspend fun uploadAttachment(
    context: Context,
    userId: String,
    assignmentId: String,
    uri: Uri,
): UploadOutcome {
    val resolver = context.contentResolver
    val name = queryName(resolver, uri) ?: return UploadOutcome(false, null, "Could not read the file name.")
    val size = querySize(resolver, uri)

    if (size <= 0) return UploadOutcome(false, null, "The file is empty.")
    if (size > UPLOAD_MAX_BYTES) return UploadOutcome(false, null, "Each file must be 10 MB or smaller.")

    val extension = fileExtension(name)
    if (extension !in ALLOWED_EXTENSIONS) {
        return UploadOutcome(false, null, "Type .$extension is not allowed for attachments.")
    }

    val mime = mimeForExtension(extension)
    val safeName = name.replace(Regex("[^\\w.\\- ]+"), "_").take(120)
    val storagePath = "$userId/$assignmentId/${System.currentTimeMillis()}-$safeName"
    val bytes = resolver.openInputStream(uri)?.readBytes()
        ?: return UploadOutcome(false, null, "Could not read the file.")

    val storage = SupabaseProvider.client.storage
    val uploadResult = runCatching {
        storage.from("assignment-attachments").upload(path = storagePath, data = bytes) {
            upsert = false
        }
    }
    if (uploadResult.isFailure) {
        return UploadOutcome(false, null, userFacingMessage(uploadResult.exceptionOrNull(), "Upload failed."))
    }

    val db = SupabaseProvider.client.postgrest
    val recordResult = runCatching {
        db.from("assignment_attachments").insert(
            kotlinx.serialization.json.buildJsonObject {
                put("assignment_id", kotlinx.serialization.json.JsonPrimitive(assignmentId))
                put("storage_path", kotlinx.serialization.json.JsonPrimitive(storagePath))
                put("original_filename", kotlinx.serialization.json.JsonPrimitive(safeName))
                put("mime_type", kotlinx.serialization.json.JsonPrimitive(mime))
                put("file_size", kotlinx.serialization.json.JsonPrimitive(size))
            },
        )
    }
    if (recordResult.isFailure) {
        runCatching { storage.from("assignment-attachments").delete(listOf(storagePath)) }
        return UploadOutcome(false, null, userFacingMessage(recordResult.exceptionOrNull(), "Could not save attachment."))
    }

    return UploadOutcome(true, safeName, null)
}

suspend fun openAttachment(context: Context, storagePath: String) {
    val storage = SupabaseProvider.client.storage
    val url = storage.from("assignment-attachments")
        .createSignedUrl(storagePath, 15.minutes)
    context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))
}

suspend fun deleteAttachment(attachmentId: String, storagePath: String): Boolean {
    val db = SupabaseProvider.client.postgrest
    val storage = SupabaseProvider.client.storage
    val dbOk = runCatching {
        db.from("assignment_attachments").delete { filter { eq("id", attachmentId) } }
    }.isSuccess
    runCatching { storage.from("assignment-attachments").delete(listOf(storagePath)) }
    return dbOk
}

suspend fun renameAttachment(context: Context, attachmentId: String, storagePath: String, newName: String): Boolean {
    // Rename is metadata-only; storage path is immutable (web pattern).
    if (newName.isBlank()) return false
    return runCatching {
        SupabaseProvider.client.postgrest.from("assignment_attachments").update(
            kotlinx.serialization.json.buildJsonObject {
                put("original_filename", kotlinx.serialization.json.JsonPrimitive(newName))
            },
        ) { filter { eq("id", attachmentId) } }
        true
    }.getOrDefault(false)
}

fun attachmentAllowedExtensionsLabel(): String = ALLOWED_EXTENSIONS.joinToString(" ") { it.uppercase() }

fun queryFileSize(context: android.content.Context, uri: android.net.Uri): Long? {
    context.contentResolver.query(uri, arrayOf(OpenableColumns.SIZE), null, null, null)?.use { cursor ->
        if (cursor.moveToFirst()) return cursor.getLong(0).takeIf { it >= 0L }
    }
    return null
}

private fun queryName(resolver: android.content.ContentResolver, uri: Uri): String? {
    resolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)?.use { cursor ->
        if (cursor.moveToFirst()) return cursor.getString(0)
    }
    return null
}

private fun querySize(resolver: android.content.ContentResolver, uri: Uri): Long {
    resolver.query(uri, arrayOf(OpenableColumns.SIZE), null, null, null)?.use { cursor ->
        if (cursor.moveToFirst()) return cursor.getLong(0)
    }
    return -1
}

fun previewable(mimeType: String?): Boolean {
    if (mimeType == null) return false
    return mimeType.startsWith("image/") || mimeType == "application/pdf"
}

suspend fun signedAttachmentUrl(storagePath: String, expiresMinutes: Long = 15): String =
    SupabaseProvider.client.storage.from("assignment-attachments")
        .createSignedUrl(storagePath, expiresMinutes.minutes)

suspend fun downloadAttachmentBytes(storagePath: String): ByteArray =
    runCatching {
        val url = SupabaseProvider.client.storage
            .from("assignment-attachments")
            .createSignedUrl(storagePath, 5.minutes)
        java.net.URL(url).openStream().use { it.readBytes() }
    }.getOrElse { throw IllegalStateException("Could not download the attachment.") }

fun formatFileSize(bytes: Long?): String {
    if (bytes == null || bytes < 0) return ""
    if (bytes < 1024) return "$bytes B"
    val kb = bytes / 1024.0
    if (kb < 1024) return "${"%.1f".format(kb).trimEnd('0').trimEnd('.')} KB"
    val mb = kb / 1024.0
    return "${"%.1f".format(mb).trimEnd('0').trimEnd('.')} MB"
}
