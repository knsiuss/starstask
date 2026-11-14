package id.starstask.mobile.data

import io.github.jan.supabase.postgrest.postgrest
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put

// Translation of apps/web/src/lib/db/assignment-completions.ts.

suspend fun loadCompletionIds(
    userId: String,
    assignmentIds: List<String>,
): Set<String> {
    if (assignmentIds.isEmpty()) return emptySet()
    val rows = SupabaseProvider.client.postgrest.from("assignment_completions").select {
        filter {
            eq("user_id", userId)
            isIn("assignment_id", assignmentIds)
        }
    }.decodeJsonArray()
    return rows.mapNotNull {
        it.jsonObject["assignment_id"]?.jsonPrimitive?.content
    }.toSet()
}

suspend fun setAssignmentCompletion(
    userId: String,
    assignmentId: String,
    completed: Boolean,
) {
    val db = SupabaseProvider.client.postgrest
    if (!completed) {
        db.from("assignment_completions").delete {
            filter {
                eq("user_id", userId)
                eq("assignment_id", assignmentId)
            }
        }
        return
    }
    db.from("assignment_completions").upsert(
        buildJsonObject {
            put("assignment_id", JsonPrimitive(assignmentId))
            put("user_id", JsonPrimitive(userId))
        },
    )
}
