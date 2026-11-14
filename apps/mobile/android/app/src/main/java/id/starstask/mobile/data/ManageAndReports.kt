package id.starstask.mobile.data

import io.github.jan.supabase.postgrest.postgrest
import io.github.jan.supabase.postgrest.query.Columns
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put

// Translate of web manage page + class_functions.sql RPCs.
// Grants for classes are column-scoped; never use select * here.
// NOTE: postgrest-kotlin update/upsert with JsonObject conflicts with
// typed overloads (Conflicting overloads). Use rpc where possible.

suspend fun renameClass(classId: String, name: String) {
    // update_class_metadata rewrites name/description/course/semester/year
    // atomically, so reuse the current row instead of writing partial fields.
    val current = getManagedClassById(classId)
        ?: throw IllegalStateException("Class not found.")
    updateClassMetadataFull(
        classId = classId,
        name = name,
        description = current.description,
        courseName = current.courseName ?: "Course",
        semester = current.semester ?: "",
        academicYear = current.academicYear ?: "",
        institution = current.institution,
        lecturerName = current.lecturerName,
        classCode = current.classCode,
    )
}

suspend fun loadClassAdmins(classId: String): List<ClassAdminRow> {
    val rows = SupabaseProvider.client.postgrest.from("class_admins")
        .select(Columns.list("class_id", "user_id", "assigned_at")) {
            filter { eq("class_id", classId) }
        }.decodeJsonArray()
    return rows.mapNotNull { row ->
        val obj = row.jsonObject
        ClassAdminRow(
            userId = obj["user_id"]?.jsonPrimitive?.content ?: return@mapNotNull null,
            assignedAt = obj["assigned_at"]?.jsonPrimitive?.contentOrNull(),
        )
    }
}

data class ClassAdminRow(val userId: String, val assignedAt: String?)

suspend fun loadAnnouncements(classId: String): List<AnnouncementRow> {
    val rows = SupabaseProvider.client.postgrest.from("assignments")
        .select(Columns.list("id", "title", "content_type", "created_at")) {
            filter {
                eq("class_id", classId)
                eq("content_type", "class_announcement")
                eq("status", "published")
            }
            order("created_at", io.github.jan.supabase.postgrest.query.Order.DESCENDING)
            limit(50)
        }.decodeJsonArray()
    return rows.mapNotNull { row ->
        val obj = row.jsonObject
        AnnouncementRow(
            id = obj["id"]?.jsonPrimitive?.content ?: return@mapNotNull null,
            title = obj["title"]?.jsonPrimitive?.contentOrNull() ?: "Announcement",
            createdAt = obj["created_at"]?.jsonPrimitive?.contentOrNull(),
        )
    }
}

data class AnnouncementRow(val id: String, val title: String, val createdAt: String?)

/**
 * Publishes an announcement using the same path the web class submission form
 * uses: submit with contentType=class_announcement, then publish. Requires a
 * course subject because the RPC now enforces subjectId (20261102110000).
 */
suspend fun publishAnnouncement(classId: String, title: String, body: String, subjectId: String?) {
    if (subjectId.isNullOrBlank()) {
        throw IllegalStateException("Pick a course for this announcement first.")
    }
    val db = SupabaseProvider.client.postgrest
    val id = db.rpc(
        "submit_class_assignment",
        buildJsonObject {
            put("p_class_id", JsonPrimitive(classId))
            put("p_title", JsonPrimitive(title.trim()))
            put("p_description", JsonPrimitive(body.trim()))
            put("p_deadline", JsonNull)
            put("p_assignment_type", JsonNull)
            put("p_tags", JsonArray(emptyList()))
            put("p_reference_urls", JsonArray(emptyList()))
            put("p_content_type", JsonPrimitive("class_announcement"))
            put("p_source_label", JsonNull)
            put("p_drive_url", JsonNull)
            put("p_subject_id", JsonPrimitive(subjectId))
        },
    ).decodeJsonPrimitive().content
    db.rpc(
        "publish_class_assignment",
        buildJsonObject { put("p_assignment_id", JsonPrimitive(id)) },
    )
}

fun csvForReports(assignments: List<ExploreAssignment>): String {
    val header = "id,title,status,deadline,class_id,created_at"
    val lines = assignments.joinToString("\n") { a ->
        listOf(a.id, a.title, a.assignmentType ?: a.contentType ?: "", a.deadline ?: "", a.classId ?: "", a.createdAt ?: "")
            .joinToString(",") { it.replace(",", " ") }
    }
    return if (lines.isBlank()) header else "$header\n$lines"
}

suspend fun joinClassByCode(code: String): String = acceptClassInvitationToken(code)

/**
 * Redeems a class invitation token the same way the web does (RPC
 * `accept_class_invitation`); expiry, revocation, usage limits, class state,
 * and the optional email restriction are verified server-side.
 */
suspend fun acceptClassInvitationToken(token: String): String {
    val trimmed = token.trim()
    if (trimmed.isEmpty()) {
        throw IllegalArgumentException("Enter the invitation code.")
    }
    val result = SupabaseProvider.client.postgrest.rpc(
        "accept_class_invitation",
        buildJsonObject { put("p_token", JsonPrimitive(trimmed)) },
    )
    return result.decodeJsonPrimitive().content
}

suspend fun loadMyApplications(userId: String): List<ApplicationRow> {
    val rows = SupabaseProvider.client.postgrest.from("class_applications")
        .select(Columns.list("id", "proposed_slug", "proposed_name", "course_name", "status", "created_at")) {
            filter { eq("applicant_id", userId) }
            order("created_at", io.github.jan.supabase.postgrest.query.Order.DESCENDING)
            limit(30)
        }.decodeJsonArray()
    return rows.mapNotNull { row ->
        val obj = row.jsonObject
        ApplicationRow(
            id = obj["id"]?.jsonPrimitive?.content ?: return@mapNotNull null,
            slug = obj["proposed_slug"]?.jsonPrimitive?.contentOrNull() ?: "",
            name = obj["proposed_name"]?.jsonPrimitive?.contentOrNull() ?: "",
            courseName = obj["course_name"]?.jsonPrimitive?.contentOrNull(),
            status = obj["status"]?.jsonPrimitive?.contentOrNull() ?: "",
            createdAt = obj["created_at"]?.jsonPrimitive?.contentOrNull(),
        )
    }
}

data class ApplicationRow(
    val id: String,
    val slug: String,
    val name: String,
    val courseName: String?,
    val status: String,
    val createdAt: String?,
)

suspend fun submitApplication(slug: String, name: String, courseName: String, reason: String) {
    SupabaseProvider.client.postgrest.rpc(
        "submit_class_application",
        buildJsonObject {
            put("p_slug", JsonPrimitive(slug.trim()))
            put("p_name", JsonPrimitive(name.trim()))
            put("p_course_name", JsonPrimitive(courseName.trim()))
            put("p_reason", JsonPrimitive(reason.trim()))
        },
    )
}

suspend fun loadLeaveHistoryForClass(classId: String): List<LeaveAdminRow> {
    val rows = SupabaseProvider.client.postgrest.from("leave_requests")
        .select(Columns.list("id", "class_id", "status", "leave_start_date", "leave_end_date")) {
            filter { eq("class_id", classId) }
            order("created_at", io.github.jan.supabase.postgrest.query.Order.DESCENDING)
            limit(50)
        }.decodeJsonArray()
    return rows.mapNotNull { row ->
        val obj = row.jsonObject
        LeaveAdminRow(
            id = obj["id"]?.jsonPrimitive?.content ?: return@mapNotNull null,
            status = obj["status"]?.jsonPrimitive?.contentOrNull() ?: "",
            startDate = obj["leave_start_date"]?.jsonPrimitive?.contentOrNull(),
            endDate = obj["leave_end_date"]?.jsonPrimitive?.contentOrNull(),
        )
    }
}

data class LeaveAdminRow(val id: String, val status: String, val startDate: String?, val endDate: String?)

/** Class admin decision: approved / rejected / revision_requested (web review_leave_request). */
suspend fun reviewLeaveRequest(requestId: String, decision: String, note: String?) {
    require(decision in listOf("approved", "rejected", "revision_requested")) { "Invalid review decision" }
    SupabaseProvider.client.postgrest.rpc(
        "review_leave_request",
        buildJsonObject {
            put("p_request_id", JsonPrimitive(requestId))
            put("p_decision", JsonPrimitive(decision))
            put("p_note", note?.takeIf { it.isNotBlank() }?.let { JsonPrimitive(it.trim()) } ?: JsonNull)
        },
    )
}

/** Review note rule from the web contract: rejection/revision needs an explanation. */
fun leaveReviewNoteError(decision: String, note: String): String? {
    if ((decision == "rejected" || decision == "revision_requested") && note.trim().length < 3) {
        return "Explain the decision in at least 3 characters so the student knows what to do."
    }
    return null
}

suspend fun reviseSubmission(assignmentId: String, title: String, description: String) {
    // revise_class_assignment (class_functions.sql) takes text, text, timestamptz, text, text[], jsonb.
    SupabaseProvider.client.postgrest.rpc(
        "revise_class_assignment",
        buildJsonObject {
            put("p_assignment_id", JsonPrimitive(assignmentId))
            put("p_title", JsonPrimitive(title.trim()))
            put("p_description", JsonPrimitive(description.trim()))
            put("p_deadline", JsonNull)
            put("p_assignment_type", JsonNull)
            put("p_tags", kotlinx.serialization.json.JsonArray(emptyList()))
            put("p_reference_urls", kotlinx.serialization.json.JsonArray(emptyList()))
        },
    )
}

data class DeveloperOverview(
    val activeClasses: Long,
    val archivedClasses: Long,
    val totalUsers: Long,
)

suspend fun loadDeveloperOverview(): DeveloperOverview? {
    val result = SupabaseProvider.client.postgrest.rpc("get_developer_overview", buildJsonObject {})
        .decodeJsonArray().firstOrNull()?.jsonObject
    val active = result?.get("active_classes")?.jsonPrimitive?.contentOrNull()?.toLongOrNull() ?: 0L
    val archived = result?.get("archived_classes")?.jsonPrimitive?.contentOrNull()?.toLongOrNull() ?: 0L
    val users = result?.get("total_users")?.jsonPrimitive?.contentOrNull()?.toLongOrNull() ?: 0L
    return DeveloperOverview(active, archived, users)
}
