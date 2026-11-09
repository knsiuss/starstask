package id.starstask.mobile.data

import io.github.jan.supabase.postgrest.postgrest
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put

/**
 * Assignment edit/delete mirroring web updateAssignmentRecord
 * (apps/web/src/lib/db/assignments.ts): only the owner's row is updated,
 * and editing a rejected public request sends it back to pending review.
 */

data class AssignmentEditInput(
    val title: String,
    val description: String,
    val deadlineIso: String?,
)

suspend fun updateAssignmentRecord(
    userId: String,
    assignmentId: String,
    input: AssignmentEditInput,
): Boolean {
    val db = SupabaseProvider.client.postgrest
    val existing = db.from("assignments").select {
        filter {
            eq("id", assignmentId)
            eq("user_id", userId)
        }
        limit(1)
    }.decodeJsonArray().firstOrNull()?.jsonObject ?: return false

    val patch = buildJsonObject {
        put("title", JsonPrimitive(input.title.trim()))
        put("description", JsonPrimitive(input.description.trim()))
        if (input.deadlineIso != null) put("deadline", JsonPrimitive(input.deadlineIso)) else put("deadline", JsonNull)
        // Rejected public requests go back to review on edit (web parity).
        val existingStatus = existing["status"]?.let { runCatching { it.jsonPrimitive.content }.getOrNull() }
        val existingClassId = existing["class_id"]?.let { runCatching { it.jsonPrimitive.content }.getOrNull() }
        if (existingStatus == "rejected" && existingClassId == null) {
            put("status", JsonPrimitive("pending"))
            put("rejection_reason", JsonNull)
            put("reviewed_by", JsonNull)
            put("reviewed_at", JsonNull)
        }
    }

    val updated = db.from("assignments").update(patch) {
        filter {
            eq("id", assignmentId)
            eq("user_id", userId)
        }
    }.decodeJsonArray()
    return updated.isNotEmpty()
}

/**
 * Moderation: unpublish/archive/restore a published assignment.
 * Mirrors web features/classes/class-review-service.ts `moderateAssignment`
 * → RPC moderate_assignment is the authority (class admin for own class,
 * platform admin for anything).
 */
suspend fun moderateAssignment(
    assignmentId: String,
    action: String,
    reason: String? = null,
): String? {
    val err = runCatching {
        SupabaseProvider.client.postgrest.rpc(
            "moderate_assignment",
            buildJsonObject {
                put("p_assignment_id", JsonPrimitive(assignmentId))
                put("p_action", JsonPrimitive(action))
                if (reason.isNullOrBlank()) put("p_reason", JsonNull) else put("p_reason", JsonPrimitive(reason))
            },
        )
    }.exceptionOrNull()
    return err?.message
}

suspend fun deleteAssignmentRecord(userId: String, assignmentId: String): Boolean {
    val db = SupabaseProvider.client.postgrest
    val deleted = db.from("assignments").delete {
        filter {
            eq("id", assignmentId)
            eq("user_id", userId)
        }
    }.decodeJsonArray()
    return deleted.isNotEmpty()
}
