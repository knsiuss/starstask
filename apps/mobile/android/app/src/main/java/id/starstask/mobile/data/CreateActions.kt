package id.starstask.mobile.data

import io.github.jan.supabase.postgrest.postgrest
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put

// ---------------------------------------------------------------------------
// Create actions used by dashboard quick actions / My Week:
// - createSession via RPC create_discussion_session (same as web
//   session-service.createSession; DB re-checks can_organize_class_sessions).
// - submitAssignment inserts into assignments; status follows
//   can_publish_public_assignment RPC (published vs pending review),
//   mirroring web insertAssignment.
// ---------------------------------------------------------------------------

suspend fun createSession(
    classId: String,
    title: String,
    startsAtIso: String,
    endsAtIso: String,
    sessionType: String = "in_person",
    location: String? = null,
    meetingUrl: String? = null,
    agenda: String? = null,
): String {
    val result = SupabaseProvider.client.postgrest.rpc(
        "create_discussion_session",
        buildJsonObject {
            put("p_class_id", JsonPrimitive(classId))
            put("p_title", JsonPrimitive(title))
            put("p_description", JsonNull)
            put("p_starts_at", JsonPrimitive(startsAtIso))
            put("p_ends_at", JsonPrimitive(endsAtIso))
            put("p_time_zone", JsonPrimitive(DEVICE_ZONE.id))
            put("p_session_type", JsonPrimitive(sessionType))
            put("p_meeting_url", meetingUrl?.takeIf { it.isNotBlank() }?.let { JsonPrimitive(it) } ?: JsonNull)
            put("p_location", location?.takeIf { it.isNotBlank() }?.let { JsonPrimitive(it) } ?: JsonNull)
            put("p_agenda", agenda?.takeIf { it.isNotBlank() }?.let { JsonPrimitive(it) } ?: JsonNull)
            put("p_capacity", JsonNull)
            put("p_registration_deadline", JsonNull)
            put("p_visibility", JsonPrimitive("class_members"))
            put("p_assignment_id", JsonNull)
        },
    )
    return result.decodeJsonPrimitive().content
}

data class CourseOption(val id: String, val name: String, val code: String?)

suspend fun loadCourses(): List<CourseOption> {
    val rows = SupabaseProvider.client.postgrest.from("courses").select {
        order("name", io.github.jan.supabase.postgrest.query.Order.ASCENDING)
        limit(200)
    }.decodeJsonArray()
    return rows.mapNotNull { row ->
        val obj = row.jsonObject
        CourseOption(
            id = obj["id"]?.jsonPrimitive?.content ?: return@mapNotNull null,
            name = obj["name"]?.jsonPrimitive?.contentOrNull() ?: "Course",
            code = obj["code"]?.jsonPrimitive?.contentOrNull(),
        )
    }
}

suspend fun submitAssignment(
    userId: String,
    courseId: String,
    title: String,
    description: String,
    deadlineIso: String?,
): String {
    val db = SupabaseProvider.client.postgrest
    val canPublish = try {
        db.rpc("can_publish_public_assignment", buildJsonObject {}).decodeJsonPrimitive().contentOrNull() == "true"
    } catch (_: Exception) {
        false
    }
    val inserted = db.from("assignments").insert(
        buildJsonObject {
            put("title", JsonPrimitive(title))
            put("description", JsonPrimitive(description))
            put("course_id", JsonPrimitive(courseId))
            put("user_id", JsonPrimitive(userId))
            put("deadline", deadlineIso?.let { JsonPrimitive(it) } ?: JsonNull)
            put("tags", JsonArray(emptyList()))
            put("reference_urls", JsonArray(emptyList()))
            put("status", JsonPrimitive(if (canPublish) "published" else "pending"))
        },
    ) {
        select()
    }.decodeJsonArray()
    return inserted.firstOrNull()?.jsonObject?.get("id")?.jsonPrimitive?.content
        ?: throw IllegalStateException("Could not create the assignment")
}

suspend fun loadSessionById(sessionId: String): SessionRow? {
    val rows = SupabaseProvider.client.postgrest.from("discussion_sessions").select {
        filter { eq("id", sessionId) }
        limit(1)
    }.decodeJsonArray()
    val obj = rows.firstOrNull()?.jsonObject ?: return null
    val classId = obj["class_id"]?.jsonPrimitive?.contentOrNull()
    val className = classId?.let {
        SupabaseProvider.client.postgrest.from("classes").select {
            filter { eq("id", it) }
            limit(1)
        }.decodeJsonArray().firstOrNull()?.jsonObject?.get("name")?.jsonPrimitive?.contentOrNull()
    }
    return SessionRow(
        id = obj["id"]?.jsonPrimitive?.content ?: return null,
        title = obj["title"]?.jsonPrimitive?.contentOrNull() ?: "Session",
        startsAt = obj["starts_at"]?.jsonPrimitive?.contentOrNull() ?: "",
        endsAt = obj["ends_at"]?.jsonPrimitive?.contentOrNull() ?: "",
        status = obj["status"]?.jsonPrimitive?.contentOrNull() ?: "",
        className = className,
    )
}

suspend fun loadClassMembers(classId: String): List<String> {
    val db = SupabaseProvider.client.postgrest
    val memberships = db.from("class_members").select {
        filter { eq("class_id", classId) }
        limit(100)
    }.decodeJsonArray()
    val userIds = memberships.mapNotNull { it.jsonObject["user_id"]?.jsonPrimitive?.content }.distinct()
    if (userIds.isEmpty()) return emptyList()
    val profiles = db.from("profiles").select {
        filter { isIn("id", userIds) }
    }.decodeJsonArray()
    return profiles.mapNotNull {
        it.jsonObject["display_name"]?.jsonPrimitive?.contentOrNull()
            ?: it.jsonObject["full_name"]?.jsonPrimitive?.contentOrNull()
    }
}
