package id.starstask.mobile.data

// Class content queue (web /manage?tab=content): published / pending_review /
// unpublished / archived assignments of one class. Native does the filtering on
// the client after a bounded fetch; server (RLS + moderate_assignment RPC) is
// the authority for any state change.

import io.github.jan.supabase.postgrest.postgrest
import io.github.jan.supabase.postgrest.query.Columns
import io.github.jan.supabase.postgrest.query.Order
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive

data class ClassContentItem(
    val id: String,
    val title: String,
    val status: String,
    val deadline: String?,
    val createdAt: String?,
    val updatedAt: String?,
    val ownerId: String?,
    val ownerName: String?,
    val attachmentCount: Int,
    val contentType: String?,
    val courseId: String?,
    val subjectId: String?,
)

suspend fun listClassContent(classId: String, status: String): List<ClassContentItem> {
    val db = SupabaseProvider.client.postgrest
    val rows = db.from("assignments").select(
        Columns.list(
            "id", "title", "status", "deadline", "created_at", "updated_at",
            "user_id", "content_type", "course_id", "subject_id",
        ),
    ) {
        filter {
            eq("class_id", classId)
            eq("status", status)
        }
        order("created_at", Order.ASCENDING)
        limit(200)
    }.decodeJsonArray()
    if (rows.isEmpty()) return emptyList()

    val ownerIds = rows.mapNotNull { it.jsonObject["user_id"]?.jsonPrimitive?.contentOrNull() }.distinct()
    val ownerNames = if (ownerIds.isEmpty()) {
        emptyMap()
    } else {
        db.from("profiles").select(Columns.list("id", "display_name")) {
            filter { isIn("id", ownerIds) }
        }.decodeJsonArray().associateBy(
            { it.jsonObject["id"]?.jsonPrimitive?.contentOrNull() ?: "" },
            { it.jsonObject["display_name"]?.jsonPrimitive?.contentOrNull() },
        )
    }

    val assignmentIds = rows.mapNotNull { it.jsonObject["id"]?.jsonPrimitive?.contentOrNull() }
    val attachmentCounts = if (assignmentIds.isEmpty()) {
        emptyMap()
    } else {
        db.from("assignment_attachments").select(Columns.raw("assignment_id")) {
            filter { isIn("assignment_id", assignmentIds) }
            limit(2_000)
        }.decodeJsonArray().mapNotNull {
            it.jsonObject["assignment_id"]?.jsonPrimitive?.contentOrNull()
        }.groupingBy { it }.eachCount()
    }

    return rows.mapNotNull { element ->
        val o = element.jsonObject
        val id = o["id"]?.jsonPrimitive?.contentOrNull() ?: return@mapNotNull null
        val ownerId = o["user_id"]?.jsonPrimitive?.contentOrNull()
        ClassContentItem(
            id = id,
            title = o["title"]?.jsonPrimitive?.contentOrNull() ?: "Assignment",
            status = o["status"]?.jsonPrimitive?.contentOrNull() ?: status,
            deadline = o["deadline"]?.jsonPrimitive?.contentOrNull(),
            createdAt = o["created_at"]?.jsonPrimitive?.contentOrNull(),
            updatedAt = o["updated_at"]?.jsonPrimitive?.contentOrNull(),
            ownerId = ownerId,
            ownerName = ownerId?.let(ownerNames::get),
            attachmentCount = attachmentCounts[id] ?: 0,
            contentType = o["content_type"]?.jsonPrimitive?.contentOrNull(),
            courseId = o["course_id"]?.jsonPrimitive?.contentOrNull(),
            subjectId = o["subject_id"]?.jsonPrimitive?.contentOrNull(),
        )
    }
}
