package id.starstask.mobile.data

import io.github.jan.supabase.postgrest.postgrest
import io.github.jan.supabase.postgrest.query.Columns
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put
import id.starstask.mobile.ui.theme.Success

// Native mirror of web feedback (packages/contracts/src/feedback.ts +
// apps/web/src/lib/db/feedback.ts): categories, 10-2000 char message,
// column list, newest-first, limit 5 for own notes.

const val FEEDBACK_MESSAGE_MIN = 10
const val FEEDBACK_MESSAGE_MAX = 2000
const val FEEDBACK_PAGE_PATH_MAX = 200
const val FEEDBACK_LIST_LIMIT = 5

object FeedbackCategories {
    val VALUES: List<String> = listOf("bug", "confusing", "idea", "other")
    val LABELS: Map<String, String> = mapOf(
        "bug" to "Something is broken",
        "confusing" to "A screen was confusing",
        "idea" to "An idea for improving StarsTask",
        "other" to "Something else",
    )
    val STATUS_LABELS: Map<String, String> = mapOf(
        "open" to "Open",
        "reviewing" to "Reviewing",
        "resolved" to "Resolved",
        "dismissed" to "Dismissed",
    )
}

data class FeedbackEntry(
    val id: String,
    val category: String,
    val message: String,
    val pagePath: String?,
    val status: String,
    val createdAt: String,
)

sealed class FeedbackSubmitResult {
    data class Success(val entry: FeedbackEntry) : FeedbackSubmitResult()
    data class Error(val message: String) : FeedbackSubmitResult()
}

suspend fun listMyFeedback(userId: String): List<FeedbackEntry> {
    val rows = SupabaseProvider.client.postgrest
        .from("feedback_entries")
        .select(
            Columns.list("id", "category", "message", "page_path", "status", "created_at"),
        ) {
            filter { eq("user_id", userId) }
            order("created_at", io.github.jan.supabase.postgrest.query.Order.DESCENDING)
            limit(FEEDBACK_LIST_LIMIT.toLong())
        }.decodeJsonArray()
    return rows.mapNotNull { row ->
        val obj = row.jsonObject
        val id = obj["id"]?.jsonPrimitive?.contentOrNull() ?: return@mapNotNull null
        FeedbackEntry(
            id = id,
            category = obj["category"]?.jsonPrimitive?.contentOrNull() ?: "other",
            message = obj["message"]?.jsonPrimitive?.contentOrNull().orEmpty(),
            pagePath = obj["page_path"]?.jsonPrimitive?.contentOrNull(),
            status = obj["status"]?.jsonPrimitive?.contentOrNull() ?: "open",
            createdAt = obj["created_at"]?.jsonPrimitive?.contentOrNull() ?: "",
        )
    }
}

suspend fun submitFeedback(
    userId: String,
    category: String,
    message: String,
    pagePath: String?,
): FeedbackSubmitResult {
    if (category !in FeedbackCategories.VALUES) {
        return FeedbackSubmitResult.Error("Please check the message before sending it.")
    }
    val trimmed = message.trim()
    if (trimmed.length < FEEDBACK_MESSAGE_MIN || trimmed.length > FEEDBACK_MESSAGE_MAX) {
        return FeedbackSubmitResult.Error("Please check the message before sending it.")
    }
    val path = pagePath?.trim()?.take(FEEDBACK_PAGE_PATH_MAX)?.ifEmpty { null }
    return try {
        val inserted = SupabaseProvider.client.postgrest
            .from("feedback_entries")
            .insert(
                buildJsonObject {
                    put("user_id", JsonPrimitive(userId))
                    put("category", JsonPrimitive(category))
                    put("message", JsonPrimitive(trimmed))
                    if (path != null) put("page_path", JsonPrimitive(path)) else put("page_path", JsonNull)
                },
            ) { select(Columns.list("id", "category", "message", "page_path", "status", "created_at")) }
            .decodeJsonArray()
        val obj = inserted.firstOrNull()?.jsonObject
        val id = obj?.get("id")?.jsonPrimitive?.contentOrNull()
            ?: return FeedbackSubmitResult.Error("The note could not be sent. Try again in a moment.")
        FeedbackSubmitResult.Success(
            FeedbackEntry(
                id = id,
                category = obj["category"]?.jsonPrimitive?.contentOrNull() ?: category,
                message = obj["message"]?.jsonPrimitive?.contentOrNull() ?: trimmed,
                pagePath = obj["page_path"]?.jsonPrimitive?.contentOrNull(),
                status = obj["status"]?.jsonPrimitive?.contentOrNull() ?: "open",
                createdAt = obj["created_at"]?.jsonPrimitive?.contentOrNull() ?: "",
            ),
        )
    } catch (_: Exception) {
        FeedbackSubmitResult.Error("The note could not be sent. Check your connection.")
    }
}
