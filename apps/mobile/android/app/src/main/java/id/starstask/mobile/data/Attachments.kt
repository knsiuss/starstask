package id.starstask.mobile.data

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.provider.OpenableColumns
import io.github.jan.supabase.postgrest.postgrest
import io.github.jan.supabase.storage.storage
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlin.time.Duration.Companion.minutes

/**
 * Attachment storage for the native shell, mirroring the web flow:
 * validate locally, upload bytes to the private bucket, then insert
 * the metadata row. Signed URLs are minted for viewing.
 */

data class AttachmentRef(val id: String, val filename: String, val storagePath: String)

data class UploadOutcome(val ok: Boolean, val filename: String?, val message: String?)

const val UPLOAD_MAX_BYTES = 10 * 1024 * 1024

val ALLOWED_EXTENSIONS = setOf(
    "pdf", "docx", "pptx", "xlsx", "png", "jpg", "jpeg", "csv", "ipynb",
    "txt", "md", "json", "zip", "mp4", "mp3",
)

suspend fun listAttachments(assignmentId: String): List<AttachmentRef> {
    val db = SupabaseProvider.client.postgrest
    val rows = db.from("assignment_attachments").select {
        filter { eq("assignment_id", assignmentId) }
        order("created_at", io.github.jan.supabase.postgrest.query.Order.ASCENDING)
    }.decodeJsonArray()

    return rows.mapNotNull {
        val obj = it.jsonObject
        AttachmentRef(
            id = obj["id"]?.jsonPrimitive?.content ?: return@mapNotNull null,
            filename = obj["original_filename"]?.jsonPrimitive?.content ?: "file",
            storagePath = obj["storage_path"]?.jsonPrimitive?.content ?: return@mapNotNull null,
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

    val extension = name.substringAfterLast(".", "").lowercase()
    if (extension !in ALLOWED_EXTENSIONS) {
        return UploadOutcome(false, null, "Type .$extension is not allowed for attachments.")
    }

    val mime = resolver.getType(uri) ?: "application/octet-stream"
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
        return UploadOutcome(false, null, uploadResult.exceptionOrNull()?.message ?: "Upload failed.")
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
        return UploadOutcome(false, null, recordResult.exceptionOrNull()?.message ?: "Could not save attachment.")
    }

    return UploadOutcome(true, safeName, null)
}

suspend fun openAttachment(context: Context, storagePath: String) {
    val storage = SupabaseProvider.client.storage
    val url = storage.from("assignment-attachments")
        .createSignedUrl(storagePath, 15.minutes)
    context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))
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
