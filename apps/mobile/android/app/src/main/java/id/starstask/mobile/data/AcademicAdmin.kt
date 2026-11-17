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

// Mirrors web /app/classes/[slug]/academic/...:
// - admins: class-admins.ts (class_admin_assignments + permissions)
// - grades: grades-readonly.ts (grade_batches / grade_entries / grade_history)
// - schedule: schedule-readonly.ts (schedule_rules / instances / exceptions)
// - attendance admin: academic-attendance.ts (attendance_meetings)
// - announcements: announcements.ts table, read-only list here.
// Only explicit columns are selected; select * is rejected after lockdown.

data class ClassAdminAssignment(
    val id: String,
    val userId: String?,
    val studentIdentityId: String?,
    val grantedAt: String,
    val revokedAt: String?,
    val permissionCodes: List<String>,
    val displayName: String?,
)

suspend fun listClassAdminAssignments(classId: String): List<ClassAdminAssignment> {
    val db = SupabaseProvider.client.postgrest
    val rows = db.from("class_admin_assignments")
        .select(Columns.list("id", "user_id", "student_identity_id", "granted_at", "revoked_at")) {
            filter { eq("class_id", classId) }
            order("granted_at", Order.DESCENDING)
            limit(100)
        }.decodeJsonArray()
    if (rows.isEmpty()) return emptyList()
    val ids = rows.mapNotNull { it.jsonObject["id"]?.jsonPrimitive?.contentOrNull() }
    val permRows = db.from("class_admin_permissions")
        .select(Columns.list("assignment_id", "permission_code")) {
            filter { isIn("assignment_id", ids) }
        }.decodeJsonArray()
    val perms = permRows.groupBy(
        { it.jsonObject["assignment_id"]?.jsonPrimitive?.contentOrNull() ?: "" },
        { it.jsonObject["permission_code"]?.jsonPrimitive?.contentOrNull() ?: "" },
    )
    val profileIds = rows.flatMap {
        listOf(
            it.jsonObject["user_id"]?.jsonPrimitive?.contentOrNull(),
        )
    }.filterNotNull().distinct()
    val profiles = if (profileIds.isEmpty()) emptyMap() else {
        db.from("profiles").select(Columns.list("id", "display_name")) {
            filter { isIn("id", profileIds) }
        }.decodeJsonArray().associate {
            (it.jsonObject["id"]?.jsonPrimitive?.contentOrNull() ?: "") to
                it.jsonObject["display_name"]?.jsonPrimitive?.contentOrNull()
        }
    }
    return rows.mapNotNull { el ->
        val o = el.jsonObject
        val id = o["id"]?.jsonPrimitive?.contentOrNull() ?: return@mapNotNull null
        val userId = o["user_id"]?.jsonPrimitive?.contentOrNull()
        ClassAdminAssignment(
            id = id,
            userId = userId,
            studentIdentityId = o["student_identity_id"]?.jsonPrimitive?.contentOrNull(),
            grantedAt = o["granted_at"]?.jsonPrimitive?.contentOrNull() ?: "",
            revokedAt = o["revoked_at"]?.jsonPrimitive?.contentOrNull(),
            permissionCodes = perms[id].orEmpty(),
            displayName = userId?.let { profiles[it] },
        )
    }
}

// assignClassAdmin/revokeClassAdmin canonical versions live in ClassManage.kt
// (same RPCs). Removed here to avoid duplicate-definition conflicts.

data class CourseOffering(
    val id: String,
    val courseName: String,
    val courseCode: String?,
    val status: String,
)

suspend fun listOfferingsForClass(classId: String): List<CourseOffering> {
    val rows = SupabaseProvider.client.postgrest.from("course_offerings")
        .select(Columns.list("id", "course_id", "status")) {
            filter { eq("class_id", classId) }
            order("created_at", Order.DESCENDING)
        }.decodeJsonArray()
    if (rows.isEmpty()) return emptyList()
    val courseIds = rows.mapNotNull { it.jsonObject["course_id"]?.jsonPrimitive?.contentOrNull() }
    val courses = SupabaseProvider.client.postgrest.from("courses")
        .select(Columns.list("id", "name", "code")) {
            filter { isIn("id", courseIds.distinct()) }
        }.decodeJsonArray().associate {
            (it.jsonObject["id"]?.jsonPrimitive?.contentOrNull() ?: "") to
                ((it.jsonObject["name"]?.jsonPrimitive?.contentOrNull() ?: "Unknown course") to
                    it.jsonObject["code"]?.jsonPrimitive?.contentOrNull())
        }
    return rows.mapNotNull { el ->
        val o = el.jsonObject
        val id = o["id"]?.jsonPrimitive?.contentOrNull() ?: return@mapNotNull null
        val (name, code) = courses[o["course_id"]?.jsonPrimitive?.contentOrNull()] ?: ("Unknown course" to null)
        CourseOffering(id, name, code, o["status"]?.jsonPrimitive?.contentOrNull() ?: "")
    }
}

data class GradeBatch(val id: String, val offeringId: String, val status: String, val entryCount: Int, val publishedCount: Int, val createdAt: String)

suspend fun listGradeBatches(offeringIds: List<String>): List<GradeBatch> {
    if (offeringIds.isEmpty()) return emptyList()
    val db = SupabaseProvider.client.postgrest
    val rows = db.from("grade_batches")
        .select(Columns.list("id", "offering_id", "status", "created_at")) {
            filter { isIn("offering_id", offeringIds) }
            order("created_at", Order.DESCENDING)
        }.decodeJsonArray()
    if (rows.isEmpty()) return emptyList()
    val batchIds = rows.mapNotNull { it.jsonObject["id"]?.jsonPrimitive?.contentOrNull() }
    val entries = db.from("grade_entries").select(Columns.list("batch_id", "published")) {
        filter { isIn("batch_id", batchIds) }
    }.decodeJsonArray()
    val counts = entries.groupBy { it.jsonObject["batch_id"]?.jsonPrimitive?.contentOrNull() ?: "" }
    return rows.mapNotNull { el ->
        val o = el.jsonObject
        val id = o["id"]?.jsonPrimitive?.contentOrNull() ?: return@mapNotNull null
        val list = counts[id].orEmpty()
        GradeBatch(
            id = id,
            offeringId = o["offering_id"]?.jsonPrimitive?.contentOrNull() ?: "",
            status = o["status"]?.jsonPrimitive?.contentOrNull() ?: "",
            entryCount = list.size,
            publishedCount = list.count { it.jsonObject["published"]?.jsonPrimitive?.contentOrNull() == "true" },
            createdAt = o["created_at"]?.jsonPrimitive?.contentOrNull() ?: "",
        )
    }
}

data class ScheduleRule(val id: String, val weekday: Int, val startTime: String, val endTime: String, val room: String?, val timezone: String)

suspend fun listScheduleRules(offeringIds: List<String>): List<ScheduleRule> {
    if (offeringIds.isEmpty()) return emptyList()
    val rows = SupabaseProvider.client.postgrest.from("schedule_rules")
        .select(Columns.list("id", "weekday", "start_time", "end_time", "room", "timezone")) {
            filter { isIn("offering_id", offeringIds) }
            order("weekday", Order.ASCENDING)
        }.decodeJsonArray()
    return rows.mapNotNull { el ->
        val o = el.jsonObject
        val id = o["id"]?.jsonPrimitive?.contentOrNull() ?: return@mapNotNull null
        ScheduleRule(
            id = id,
            weekday = o["weekday"]?.jsonPrimitive?.contentOrNull()?.toIntOrNull() ?: 0,
            startTime = o["start_time"]?.jsonPrimitive?.contentOrNull() ?: "",
            endTime = o["end_time"]?.jsonPrimitive?.contentOrNull() ?: "",
            room = o["room"]?.jsonPrimitive?.contentOrNull(),
            timezone = o["timezone"]?.jsonPrimitive?.contentOrNull() ?: "",
        )
    }
}

data class AcademicAttendanceMeeting(
    val id: String,
    val offeringId: String,
    val scheduledAt: String,
    val status: String,
    val location: String?,
)

suspend fun listAcademicAttendanceMeetings(offeringIds: List<String>): List<AcademicAttendanceMeeting> {
    if (offeringIds.isEmpty()) return emptyList()
    val rows = SupabaseProvider.client.postgrest.from("attendance_meetings")
        .select(Columns.list("id", "offering_id", "scheduled_at", "status", "location")) {
            filter { isIn("offering_id", offeringIds) }
            order("scheduled_at", Order.DESCENDING)
            limit(100)
        }.decodeJsonArray()
    return rows.mapNotNull { el ->
        val o = el.jsonObject
        val id = o["id"]?.jsonPrimitive?.contentOrNull() ?: return@mapNotNull null
        AcademicAttendanceMeeting(
            id = id,
            offeringId = o["offering_id"]?.jsonPrimitive?.contentOrNull() ?: "",
            scheduledAt = o["scheduled_at"]?.jsonPrimitive?.contentOrNull() ?: "",
            status = o["status"]?.jsonPrimitive?.contentOrNull() ?: "",
            location = o["location"]?.jsonPrimitive?.contentOrNull(),
        )
    }
}

data class ClassAnnouncement(val id: String, val title: String, val body: String, val createdAt: String)

suspend fun listAnnouncements(classId: String): List<ClassAnnouncement> {
    val rows = SupabaseProvider.client.postgrest.from("announcements")
        .select(Columns.list("id", "title", "body", "created_at")) {
            filter { eq("class_id", classId) }
            order("created_at", Order.DESCENDING)
            limit(50)
        }.decodeJsonArray()
    return rows.mapNotNull { el ->
        val o = el.jsonObject
        val id = o["id"]?.jsonPrimitive?.contentOrNull() ?: return@mapNotNull null
        ClassAnnouncement(
            id = id,
            title = o["title"]?.jsonPrimitive?.contentOrNull() ?: "Announcement",
            body = o["body"]?.jsonPrimitive?.contentOrNull().orEmpty(),
            createdAt = o["created_at"]?.jsonPrimitive?.contentOrNull() ?: "",
        )
    }
}

/**
 * Announcement read receipt, mirroring web lib/db/announcements.ts
 * recordAnnouncementRead (idempotent upsert on announcement_id,user_id).
 * The read is best-effort: failure must never block the announcement list.
 */
suspend fun markAnnouncementRead(announcementId: String, userId: String, universityId: String?): String? {
    if (universityId.isNullOrBlank()) return null
    val err = runCatching {
        SupabaseProvider.client.postgrest.from("announcement_reads").upsert(
            buildJsonObject {
                put("university_id", JsonPrimitive(universityId))
                put("announcement_id", JsonPrimitive(announcementId))
                put("user_id", JsonPrimitive(userId))
            },
        )
    }.exceptionOrNull()
    return err?.let { userFacingMessage(it) }
}
