package id.starstask.mobile.data

import io.github.jan.supabase.postgrest.postgrest
import io.github.jan.supabase.postgrest.query.Columns
import io.github.jan.supabase.postgrest.query.Order
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put

// Mirrors web /app/classes/[slug]/manage (settings tab) + Server Actions:
// - class-management-service.ts: update_class_metadata (rename etc.)
// - set_class_join_policy (invitation | open)
// - set_class_status (active | archived)
// - delete_class (only when no academic history)
// Column grants after lockdown: classes exposes only the columns in
// CLASS_COLUMNS below; anything else returns 400, so never select *.

private val CLASS_MANAGE_COLUMNS = Columns.list(
    "id", "slug", "name", "class_code", "description", "course_id",
    "course_name", "institution", "lecturer_name", "semester",
    "academic_year", "status", "join_policy", "archived_at",
    "created_at", "updated_at",
)

data class ManagedClass(
    val id: String,
    val slug: String,
    val name: String,
    val classCode: String?,
    val description: String?,
    val courseName: String?,
    val institution: String?,
    val lecturerName: String?,
    val semester: String?,
    val academicYear: String?,
    val status: String,
    val joinPolicy: String,
    val archivedAt: String?,
)

data class ClassDependencies(
    val classStatus: String = "active",
    val memberCount: Int = 0,
    val assignmentCount: Int = 0,
    val submissionCount: Int = 0,
    val sessionCount: Int = 0,
    val attendanceCount: Int = 0,
    val scheduleCount: Int = 0,
    val calendarEventCount: Int = 0,
    val leaveRequestCount: Int = 0,
    val subjectCount: Int = 0,
    val invitationCount: Int = 0,
    val hasHistory: Boolean = false,
    val canDelete: Boolean = false,
)

private fun parseManagedClass(obj: kotlinx.serialization.json.JsonObject): ManagedClass? {
    val id = obj["id"]?.jsonPrimitive?.content ?: return null
    return ManagedClass(
        id = id,
        slug = obj["slug"]?.jsonPrimitive?.contentOrNull() ?: "",
        name = obj["name"]?.jsonPrimitive?.contentOrNull() ?: "Class",
        classCode = obj["class_code"]?.jsonPrimitive?.contentOrNull(),
        description = obj["description"]?.jsonPrimitive?.contentOrNull(),
        courseName = obj["course_name"]?.jsonPrimitive?.contentOrNull(),
        institution = obj["institution"]?.jsonPrimitive?.contentOrNull(),
        lecturerName = obj["lecturer_name"]?.jsonPrimitive?.contentOrNull(),
        semester = obj["semester"]?.jsonPrimitive?.contentOrNull(),
        academicYear = obj["academic_year"]?.jsonPrimitive?.contentOrNull(),
        status = obj["status"]?.jsonPrimitive?.contentOrNull() ?: "active",
        joinPolicy = obj["join_policy"]?.jsonPrimitive?.contentOrNull() ?: "invitation",
        archivedAt = obj["archived_at"]?.jsonPrimitive?.contentOrNull(),
    )
}

suspend fun getManagedClassBySlug(slug: String): ManagedClass? {
    val rows = SupabaseProvider.client.postgrest.from("classes")
        .select(CLASS_MANAGE_COLUMNS) {
            filter { eq("slug", slug) }
            limit(1)
        }.decodeJsonArray()
    return rows.firstOrNull()?.let { parseManagedClass(it.jsonObject) }
}

suspend fun getManagedClassById(classId: String): ManagedClass? {
    val rows = SupabaseProvider.client.postgrest.from("classes")
        .select(CLASS_MANAGE_COLUMNS) {
            filter { eq("id", classId) }
            limit(1)
        }.decodeJsonArray()
    return rows.firstOrNull()?.let { parseManagedClass(it.jsonObject) }
}

suspend fun updateClassMetadataFull(
    classId: String,
    name: String,
    description: String?,
    courseName: String?,
    semester: String?,
    academicYear: String?,
    institution: String?,
    lecturerName: String?,
    classCode: String?,
) {
    // RPC signature: update_class_metadata(uuid, text, text, text, text, text,
    // text, text, text) — description/course_name/semester/year are text NOT NULL.
    fun req(v: String?): String = v?.trim().orEmpty()
    SupabaseProvider.client.postgrest.rpc(
        "update_class_metadata",
        buildJsonObject {
            put("p_class_id", JsonPrimitive(classId))
            put("p_name", JsonPrimitive(name.trim()))
            put("p_description", JsonPrimitive(req(description)))
            put("p_course_name", JsonPrimitive(req(courseName)))
            put("p_semester", JsonPrimitive(req(semester)))
            put("p_academic_year", JsonPrimitive(req(academicYear)))
            put("p_institution", institution?.trim()?.takeIf { it.isNotEmpty() }?.let(::JsonPrimitive) ?: kotlinx.serialization.json.JsonNull)
            put("p_lecturer_name", lecturerName?.trim()?.takeIf { it.isNotEmpty() }?.let(::JsonPrimitive) ?: kotlinx.serialization.json.JsonNull)
            put("p_class_code", classCode?.trim()?.takeIf { it.isNotEmpty() }?.let(::JsonPrimitive) ?: kotlinx.serialization.json.JsonNull)
        },
    )
}


// Class management writes (RPCs; server validates policy/status):
// set_class_join_policy, set_class_status, delete_class,
// assign_class_admin, revoke_class_admin.
suspend fun setClassJoinPolicy(classId: String, policy: String) {
    SupabaseProvider.client.postgrest.rpc(
        "set_class_join_policy",
        buildJsonObject {
            put("p_class_id", JsonPrimitive(classId))
            put("p_policy", JsonPrimitive(policy))
        },
    )
}

suspend fun setClassStatus(classId: String, status: String) {
    SupabaseProvider.client.postgrest.rpc(
        "set_class_status",
        buildJsonObject {
            put("p_class_id", JsonPrimitive(classId))
            put("p_status", JsonPrimitive(status))
        },
    )
}

suspend fun deleteClass(classId: String) {
    SupabaseProvider.client.postgrest.rpc(
        "delete_class",
        buildJsonObject { put("p_class_id", JsonPrimitive(classId)) },
    )
}

suspend fun assignClassAdmin(classId: String, userId: String) {
    SupabaseProvider.client.postgrest.rpc(
        "assign_class_admin",
        buildJsonObject {
            put("p_class_id", JsonPrimitive(classId))
            put("p_user_id", JsonPrimitive(userId))
        },
    )
}

suspend fun revokeClassAdmin(classId: String, userId: String) {
    SupabaseProvider.client.postgrest.rpc(
        "revoke_class_admin",
        buildJsonObject {
            put("p_class_id", JsonPrimitive(classId))
            put("p_user_id", JsonPrimitive(userId))
        },
    )
}

suspend fun getClassDependencies(classId: String): ClassDependencies {
    // The typed RPC returns the full history the delete confirmation must
    // show; client-side table counts cannot see grants-locked tables.
    val rows = SupabaseProvider.client.postgrest.rpc(
        "get_class_dependencies",
        buildJsonObject { put("p_class_id", JsonPrimitive(classId)) },
    ).decodeJsonArray()
    val obj = rows.firstOrNull()?.jsonObject ?: return ClassDependencies()
    fun count(key: String): Int = obj[key]?.jsonPrimitive?.contentOrNull()?.toLongOrNull()?.toInt() ?: 0
    fun flag(key: String): Boolean = obj[key]?.jsonPrimitive?.contentOrNull() == "true"
    return ClassDependencies(
        classStatus = obj["class_status"]?.jsonPrimitive?.contentOrNull() ?: "active",
        memberCount = count("member_count"),
        assignmentCount = count("assignment_count"),
        submissionCount = count("submission_count"),
        sessionCount = count("session_count"),
        attendanceCount = count("attendance_count"),
        scheduleCount = count("schedule_count"),
        calendarEventCount = count("calendar_event_count"),
        leaveRequestCount = count("leave_request_count"),
        subjectCount = count("subject_count"),
        invitationCount = count("invitation_count"),
        hasHistory = flag("has_history"),
        canDelete = flag("can_delete"),
    )
}

suspend fun removeClassMember(classId: String, userId: String) {
    SupabaseProvider.client.postgrest.rpc(
        "remove_class_member",
        buildJsonObject {
            put("p_class_id", JsonPrimitive(classId))
            put("p_user_id", JsonPrimitive(userId))
        },
    )
}
