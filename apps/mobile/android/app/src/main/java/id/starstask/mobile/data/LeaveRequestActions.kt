package id.starstask.mobile.data

import android.content.Context
import android.net.Uri
import android.provider.OpenableColumns
import io.github.jan.supabase.postgrest.postgrest
import io.github.jan.supabase.storage.storage
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put
import kotlin.time.Duration.Companion.minutes

/**
 * Leave request mutations. Every write goes through the same SECURITY DEFINER
 * RPCs as the web app (apps/web/src/features/leave/leave-service.ts); there is
 * no client-writable status column. The server derives the student from the
 * auth session, so no user id is ever sent.
 */

const val LEAVE_EVIDENCE_BUCKET = "leave-evidence"
const val LEAVE_EVIDENCE_MAX_BYTES = 10 * 1024 * 1024
const val LEAVE_EVIDENCE_MAX_FILES = 10
const val LEAVE_EXPLANATION_MIN = 10
const val LEAVE_EXPLANATION_MAX = 4000
const val LEAVE_MAX_RANGE_DAYS = 365

/** Maps a database failure to a safe, user-facing message. Never leaks SQL. */
fun leaveFailureMessage(error: Throwable): String {
    val message = error.message ?: ""
    return when {
        "SS014" in message ->
            "This request is incomplete. Fill in the dates, reason, and explanation, and attach a supporting document."
        "SS011" in message -> "This request can no longer be edited."
        "SS012" in message -> "That action is no longer available for this request."
        "SS013" in message -> "That request is no longer ready for this action."
        "23514" in message -> "You can attach at most 10 files."
        "42501" in message -> "You don't have permission to do this."
        "P0002" in message -> "That leave request was not found."
        else -> "Something went wrong. Please try again."
    }
}

private fun jsonString(value: String?): kotlinx.serialization.json.JsonElement =
    if (value.isNullOrBlank()) JsonNull else JsonPrimitive(value)

data class LeaveDraftInput(
    val leaveStartDate: String?,
    val leaveEndDate: String?,
    val reasonCategory: String?,
    val explanation: String?,
    val documentIssueDate: String?,
    val subjectIds: List<String>,
)

/** Creates a draft (web: create_leave_request + set_leave_request_subjects). */
suspend fun createLeaveDraft(classId: String, input: LeaveDraftInput): String {
    val db = SupabaseProvider.client.postgrest
    val result = db.rpc(
        "create_leave_request",
        buildJsonObject {
            put("p_class_id", JsonPrimitive(classId))
            put("p_leave_start_date", jsonString(input.leaveStartDate))
            put("p_leave_end_date", jsonString(input.leaveEndDate))
            put("p_reason_category", jsonString(input.reasonCategory))
            put("p_explanation", jsonString(input.explanation))
            put("p_document_issue_date", jsonString(input.documentIssueDate))
        },
    )
    val created = result.decodeJsonArray().firstOrNull()?.jsonObject
        ?: throw IllegalStateException("Could not create the leave request.")
    val id = created["id"]?.jsonPrimitive?.content
        ?: throw IllegalStateException("Could not create the leave request.")
    if (input.subjectIds.isNotEmpty()) {
        setLeaveSubjects(id, input.subjectIds)
    }
    return id
}

/** Edits a draft or revision-returned request (web: update_leave_request). */
suspend fun updateLeaveDraft(requestId: String, input: LeaveDraftInput) {
    val db = SupabaseProvider.client.postgrest
    db.rpc(
        "update_leave_request",
        buildJsonObject {
            put("p_request_id", JsonPrimitive(requestId))
            put("p_leave_start_date", jsonString(input.leaveStartDate))
            put("p_leave_end_date", jsonString(input.leaveEndDate))
            put("p_reason_category", jsonString(input.reasonCategory))
            put("p_explanation", jsonString(input.explanation))
            put("p_document_issue_date", jsonString(input.documentIssueDate))
        },
    )
    setLeaveSubjects(requestId, input.subjectIds)
}

private suspend fun setLeaveSubjects(requestId: String, subjectIds: List<String>) {
    SupabaseProvider.client.postgrest.rpc(
        "set_leave_request_subjects",
        buildJsonObject {
            put("p_request_id", JsonPrimitive(requestId))
            put("p_subject_ids", JsonArray(subjectIds.map { JsonPrimitive(it) }))
        },
    )
}

/** Submits a draft (or resubmits a revision-returned request). */
suspend fun submitLeaveRequestById(requestId: String) {
    SupabaseProvider.client.postgrest.rpc(
        "submit_leave_request",
        buildJsonObject { put("p_request_id", JsonPrimitive(requestId)) },
    )
}

/** Records which values the student confirmed after extraction (web confirm_leave_request_ocr). */
suspend fun confirmLeaveOcr(requestId: String, fieldSources: Map<String, String>) {
    SupabaseProvider.client.postgrest.rpc(
        "confirm_leave_request_ocr",
        buildJsonObject {
            put("p_request_id", JsonPrimitive(requestId))
            put("p_field_sources", buildJsonObject {
                fieldSources.forEach { (field, source) -> put(field, JsonPrimitive(source)) }
            })
        },
    )
}

/** Withdraws a draft or pending request. Forwarded requests cannot be cancelled. */
suspend fun cancelLeaveRequestById(requestId: String, note: String?) {
    SupabaseProvider.client.postgrest.rpc(
        "cancel_leave_request",
        buildJsonObject {
            put("p_request_id", JsonPrimitive(requestId))
            put("p_note", jsonString(note))
        },
    )
}

data class StagedEvidenceFile(
    val uri: Uri,
    val name: String,
    val size: Long,
)

/** Validates one picked file with the web rules: type, size, magic bytes. */
fun validateStagedEvidence(name: String, size: Long, header: ByteArray): String? {
    if (size <= 0) return "The file is empty."
    if (size > LEAVE_EVIDENCE_MAX_BYTES) return "Each file must be 10 MB or smaller."
    val extension = name.substringAfterLast(".", "").lowercase()
    val signatures = mapOf(
        "pdf" to "application/pdf",
        "png" to "image/png",
        "jpg" to "image/jpeg",
        "jpeg" to "image/jpeg",
    )
    if (extension !in signatures) return "Allowed file types: PDF, JPG, PNG."
    val matches = when (extension) {
        "pdf" -> header.startsWith(byteArrayOf(0x25, 0x50, 0x44, 0x46, 0x2D))
        "png" -> header.startsWith(
            byteArrayOf(0x89.toByte(), 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A),
        )
        else -> header.startsWith(byteArrayOf(0xFF.toByte(), 0xD8.toByte(), 0xFF.toByte()))
    }
    if (!matches) return "$name does not look like a valid ${extension.uppercase()} file."
    return null
}

private fun ByteArray.startsWith(prefix: ByteArray): Boolean =
    size >= prefix.size && (0 until prefix.size).all { this[it] == prefix[it] }

private fun evidenceMimeType(name: String): String =
    when (name.substringAfterLast(".", "").lowercase()) {
        "png" -> "image/png"
        "jpg", "jpeg" -> "image/jpeg"
        else -> "application/pdf"
    }

/**
 * Uploads one staged file and registers it (web: uploadEvidence). The object
 * is removed again if registration fails, so a rejected upload leaves nothing
 * behind. OCR is a server-side web step after upload; it is best-effort and
 * never blocks the workflow, so native uploads simply rely on manual entry.
 */
suspend fun uploadLeaveEvidence(
    context: Context,
    userId: String,
    requestId: String,
    uri: Uri,
    name: String,
): String {
    val resolver = context.contentResolver
    val bytes = resolver.openInputStream(uri)?.readBytes()
        ?: throw IllegalStateException("Could not read the file.")
    val safeName = name.replace(Regex("[^\\w.\\- ]+"), "_").take(200).ifBlank { "document" }
    val storagePath = "$userId/$requestId/${java.util.UUID.randomUUID()}-$safeName"
    val storage = SupabaseProvider.client.storage
    storage.from(LEAVE_EVIDENCE_BUCKET).upload(path = storagePath, data = bytes) {
        upsert = false
    }
    try {
        SupabaseProvider.client.postgrest.rpc(
            "add_leave_request_evidence",
            buildJsonObject {
                put("p_request_id", JsonPrimitive(requestId))
                put("p_storage_path", JsonPrimitive(storagePath))
                put("p_original_filename", JsonPrimitive(safeName))
                put("p_mime_type", JsonPrimitive(evidenceMimeType(safeName)))
                put("p_file_size", JsonPrimitive(bytes.size))
            },
        )
    } catch (error: Exception) {
        runCatching { storage.from(LEAVE_EVIDENCE_BUCKET).delete(listOf(storagePath)) }
        throw error
    }
    return safeName
}

/** Soft-deletes the evidence row, then removes the stored object. */
suspend fun removeLeaveEvidence(evidenceId: String) {
    val storage = SupabaseProvider.client.storage
    val path = SupabaseProvider.client.postgrest.rpc(
        "remove_leave_request_evidence",
        buildJsonObject { put("p_evidence_id", JsonPrimitive(evidenceId)) },
    ).decodeJsonPrimitive().contentOrNull()
    if (!path.isNullOrBlank() && path != "null") {
        runCatching { storage.from(LEAVE_EVIDENCE_BUCKET).delete(listOf(path)) }
    }
}

/** Five-minute signed URL, matching the web evidence view. */
suspend fun openLeaveEvidence(context: Context, evidence: LeaveEvidence) {
    val url = SupabaseProvider.client.storage
        .from(LEAVE_EVIDENCE_BUCKET)
        .createSignedUrl(evidence.storagePath, 5.minutes)
    context.startActivity(
        android.content.Intent(android.content.Intent.ACTION_VIEW, Uri.parse(url)),
    )
}

fun queryPickedFile(context: Context, uri: Uri): StagedEvidenceFile? {
    val resolver = context.contentResolver
    var name: String? = null
    var size = -1L
    resolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME, OpenableColumns.SIZE), null, null, null)?.use { cursor ->
        if (cursor.moveToFirst()) {
            name = cursor.getString(0)
            size = cursor.getLong(1)
        }
    }
    val fileName = name ?: return null
    if (size < 0) {
        size = resolver.openInputStream(uri)?.use { it.skip(Long.MAX_VALUE) } ?: -1
    }
    return StagedEvidenceFile(uri = uri, name = fileName, size = size)
}

fun readPickedHeader(context: Context, uri: Uri): ByteArray =
    context.contentResolver.openInputStream(uri)?.use { stream ->
        val buffer = ByteArray(8)
        var read = 0
        while (read < buffer.size) {
            val count = stream.read(buffer, read, buffer.size - read)
            if (count < 0) break
            read += count
        }
        if (read == buffer.size) buffer else buffer.copyOf(read)
    } ?: ByteArray(0)

/** Client-side mirror of the web submission requirements. */
fun validateLeaveForSubmit(
    input: LeaveDraftInput,
    classHasCourses: Boolean,
    stagedFiles: Int,
    existingEvidence: Int,
): String? {
    if (input.leaveStartDate.isNullOrBlank() || input.leaveEndDate.isNullOrBlank()) {
        return "Choose the leave start and end dates."
    }
    val start = runCatching { java.time.LocalDate.parse(input.leaveStartDate) }.getOrNull()
    val end = runCatching { java.time.LocalDate.parse(input.leaveEndDate) }.getOrNull()
    if (start == null || end == null) return "Enter valid leave dates."
    if (end.isBefore(start)) return "The end date cannot be before the start date."
    if (java.time.temporal.ChronoUnit.DAYS.between(start, end) > LEAVE_MAX_RANGE_DAYS) {
        return "A single request may cover at most $LEAVE_MAX_RANGE_DAYS days."
    }
    if (input.reasonCategory.isNullOrBlank()) return "Choose a reason."
    val explanation = input.explanation?.trim().orEmpty()
    if (explanation.length < LEAVE_EXPLANATION_MIN) {
        return "Explain the reason in at least $LEAVE_EXPLANATION_MIN characters."
    }
    if (classHasCourses && input.subjectIds.isEmpty()) {
        return "Select at least one course this leave covers."
    }
    if (stagedFiles + existingEvidence == 0) {
        return "Attach at least one supporting document before submitting."
    }
    return null
}

/** Client-side mirror of the shared date-range rule for drafts. */
fun validateLeaveDateRange(start: String?, end: String?): String? {
    if (start.isNullOrBlank() || end.isNullOrBlank()) return null
    val startDate = runCatching { java.time.LocalDate.parse(start) }.getOrNull() ?: return null
    val endDate = runCatching { java.time.LocalDate.parse(end) }.getOrNull() ?: return null
    if (endDate.isBefore(startDate)) return "The end date cannot be before the start date."
    if (java.time.temporal.ChronoUnit.DAYS.between(startDate, endDate) > LEAVE_MAX_RANGE_DAYS) {
        return "A single request may cover at most $LEAVE_MAX_RANGE_DAYS days."
    }
    return null
}
