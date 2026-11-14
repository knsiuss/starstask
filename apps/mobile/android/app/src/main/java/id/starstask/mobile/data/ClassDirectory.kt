package id.starstask.mobile.data

// Directory data for the My Classes screen and class detail. Every value is
// read from the existing tables; nothing is synthesized for the UI, and
// authorization stays host-enforced by RLS.

import io.github.jan.supabase.postgrest.postgrest
import io.github.jan.supabase.postgrest.query.Columns
import io.github.jan.supabase.postgrest.query.Order
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.Serializable

@Serializable
data class DirectoryClass(
    val id: String,
    val name: String,
    val slug: String,
    val classCode: String?,
    val semester: String,
    val academicYear: String,
    val status: String,
    val subjectCount: Int,
    val memberCount: Int,
    val assignmentCount: Int,
    val isAdmin: Boolean,
)

suspend fun loadClassDirectory(userId: String): List<DirectoryClass> {
    val db = SupabaseProvider.client.postgrest

    val memberships = db.from("class_members").select {
        filter { eq("user_id", userId) }
        limit(100L)
    }.decodeJsonArray()

    val memberClassIds = memberships.mapNotNull {
        it.jsonObject["class_id"]?.jsonPrimitive?.contentOrNull()
    }.toSet()

    if (memberClassIds.isEmpty()) return emptyList()

    // Admin membership lives in class_admins; class_members carries no role.
    val adminClassIds = db.from("class_admins").select(Columns.raw("class_id")) {
        filter {
            eq("user_id", userId)
            isIn("class_id", memberClassIds.toList())
        }
    }.decodeJsonArray().mapNotNull {
        it.jsonObject["class_id"]?.jsonPrimitive?.contentOrNull()
    }.toSet()

    val classRows = db.from("classes").select {
        filter {
            isIn("id", memberClassIds.toList())
            eq("status", "active")
        }
    }.decodeJsonArray()

    val subjectCounts = countByClass("class_subjects", memberClassIds.toList()) {
        it.jsonObject["class_id"]?.jsonPrimitive?.contentOrNull()
    }
    val memberCounts = countByClass("class_members", memberClassIds.toList()) {
        it.jsonObject["class_id"]?.jsonPrimitive?.contentOrNull()
    }
    val assignmentCounts = db.from("assignments").select(Columns.raw("class_id")) {
        filter {
            isIn("class_id", memberClassIds.toList())
            eq("status", "published")
        }
        limit(1000L)
    }.decodeJsonArray().groupingBy {
        it.jsonObject["class_id"]?.jsonPrimitive?.contentOrNull() ?: ""
    }.eachCount()

    return classRows.mapNotNull { row ->
        val obj = row.jsonObject
        val id = obj["id"]?.jsonPrimitive?.contentOrNull() ?: return@mapNotNull null

        DirectoryClass(
            id = id,
            name = obj["name"]?.jsonPrimitive?.contentOrNull() ?: "Class",
            slug = obj["slug"]?.jsonPrimitive?.contentOrNull() ?: "",
            classCode = obj["class_code"]?.jsonPrimitive?.contentOrNull(),
            semester = obj["semester"]?.jsonPrimitive?.contentOrNull() ?: "",
            academicYear = obj["academic_year"]?.jsonPrimitive?.contentOrNull() ?: "",
            status = obj["status"]?.jsonPrimitive?.contentOrNull() ?: "active",
            subjectCount = subjectCounts[id] ?: 0,
            memberCount = memberCounts[id] ?: 0,
            assignmentCount = assignmentCounts[id] ?: 0,
            isAdmin = id in adminClassIds,
        )
    }.sortedWith(compareBy({ it.name.lowercase() }, { it.slug }))
}

data class DirectoryMember(
    val id: String,
    val name: String,
    val avatarUrl: String?,
    val role: String,
    val isAdmin: Boolean,
)

suspend fun loadClassRoster(classId: String): List<DirectoryMember> {
    val db = SupabaseProvider.client.postgrest

    val adminIds = db.from("class_admins").select(Columns.raw("user_id")) {
        filter { eq("class_id", classId) }
    }.decodeJsonArray().mapNotNull {
        it.jsonObject["user_id"]?.jsonPrimitive?.contentOrNull()
    }.toSet()

    val memberships = db.from("class_members").select {
        filter { eq("class_id", classId) }
        limit(100L)
    }.decodeJsonArray()

    val userIds = memberships.mapNotNull {
        it.jsonObject["user_id"]?.jsonPrimitive?.contentOrNull()
    }

    if (userIds.isEmpty()) return emptyList()

    val profiles = db.from("profiles").select {
        filter { isIn("id", userIds) }
    }.decodeJsonArray().associateBy {
        it.jsonObject["id"]?.jsonPrimitive?.contentOrNull()
    }

    return memberships.mapNotNull { row ->
        val obj = row.jsonObject
        val userId = obj["user_id"]?.jsonPrimitive?.contentOrNull() ?: return@mapNotNull null
        val profile = profiles[userId]?.jsonObject
        val isAdmin = userId in adminIds
        DirectoryMember(
            id = userId,
            name = profile?.get("display_name")?.jsonPrimitive?.contentOrNull()
                ?: profile?.get("full_name")?.jsonPrimitive?.contentOrNull()
                ?: "Member",
            avatarUrl = profile?.get("avatar_url")?.jsonPrimitive?.contentOrNull(),
            role = if (isAdmin) "class_admin" else "member",
            isAdmin = isAdmin,
        )
    }.sortedBy { it.name.lowercase() }
}

suspend fun loadPendingLeaveForClass(classId: String): List<LeaveRequest> =
    loadClassLeaveRequests(classId).filter {
        it.status == "submitted" || it.status == "pending_review"
    }

private suspend fun countByClass(
    table: String,
    classIds: List<String>,
    classIdOf: (kotlinx.serialization.json.JsonElement) -> String?,
): Map<String, Int> {
    if (classIds.isEmpty()) return emptyMap()

    return SupabaseProvider.client.postgrest.from(table).select(Columns.raw("class_id")) {
        filter { isIn("class_id", classIds) }
        limit(1000L)
    }.decodeJsonArray().groupingBy { classIdOf(it) ?: "" }.eachCount()
}
