package id.starstask.mobile.data

import io.github.jan.supabase.postgrest.postgrest
import io.github.jan.supabase.postgrest.query.Columns
import io.github.jan.supabase.postgrest.query.filter.FilterOperator
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put
import kotlinx.serialization.Serializable


// ---------------------------------------------------------------------------
// Next schedule: nearest upcoming deadline-or-session (web getNextSchedule).
// ---------------------------------------------------------------------------

@Serializable
data class NextScheduleItem(
    val kind: String, // "assignment" | "session"
    val title: String,
    val className: String,
    val at: String,
    val endsAt: String?,
    val detail: String,
)

suspend fun loadNextSchedule(userId: String): NextScheduleItem? {
    val db = SupabaseProvider.client.postgrest
    val memberships = db.from("class_members").select {
        filter { eq("user_id", userId) }
    }.decodeJsonArray().mapNotNull { it.jsonObject["class_id"]?.jsonPrimitive?.content }
    if (memberships.isEmpty()) return null

    val activeClasses = db.from("classes").select {
        filter {
            isIn("id", memberships)
            eq("status", "active")
        }
    }.decodeJsonArray()
    val classIds = activeClasses.mapNotNull { it.jsonObject["id"]?.jsonPrimitive?.content }
    if (classIds.isEmpty()) return null
    val classNames = activeClasses.associateBy(
        { it.jsonObject["id"]!!.jsonPrimitive.content },
        { it.jsonObject["name"]?.jsonPrimitive?.contentOrNull() },
    )

    val nowIso = java.time.Instant.now().toString()

    val subjectCourseRows = db.from("class_subjects").select(Columns.raw("course_id")) {
        filter { isIn("class_id", classIds) }
    }.decodeJsonArray()
    val courseIds = subjectCourseRows.mapNotNull {
        it.jsonObject["course_id"]?.jsonPrimitive?.contentOrNull()
    }.distinct()

    val scopedTasks = db.from("assignments").select {
        filter {
            isIn("class_id", classIds)
            eq("status", "published")
            filter("deadline", FilterOperator.IS, null)
            gte("deadline", nowIso)
        }
        order("deadline", io.github.jan.supabase.postgrest.query.Order.ASCENDING)
        limit(5)
    }.decodeJsonArray()

    val publicTasks = if (courseIds.isEmpty()) {
        emptyList()
    } else {
        db.from("assignments").select {
            filter {
                filter("class_id", FilterOperator.IS, null)
                filter("subject_id", FilterOperator.IS, null)
                isIn("course_id", courseIds)
                eq("status", "published")
                filter("deadline", FilterOperator.IS, null)
                gte("deadline", nowIso)
            }
            order("deadline", io.github.jan.supabase.postgrest.query.Order.ASCENDING)
            limit(5)
        }.decodeJsonArray()
    }

    val sessions = db.from("discussion_sessions").select {
        filter {
            isIn("class_id", classIds)
            eq("status", "scheduled")
            gte("starts_at", nowIso)
        }
        order("starts_at", io.github.jan.supabase.postgrest.query.Order.ASCENDING)
        limit(5)
    }.decodeJsonArray()

    val courseNames = if (publicTasks.isEmpty()) {
        emptyMap<String, String?>()
    } else {
        db.from("courses").select(Columns.raw("id,name")) {
            filter {
                isIn(
                    "id",
                    publicTasks.mapNotNull {
                        it.jsonObject["course_id"]?.jsonPrimitive?.contentOrNull()
                    }.distinct(),
                )
            }
        }.decodeJsonArray().associateBy(
            { row -> row.jsonObject["id"]!!.jsonPrimitive.content },
            { row -> row.jsonObject["name"]?.jsonPrimitive?.contentOrNull() },
        )
    }

    val candidates = buildList {
        scopedTasks.forEach { row ->
            val obj = row.jsonObject
            val deadline = obj["deadline"]?.jsonPrimitive?.contentOrNull() ?: return@forEach
            add(
                NextScheduleItem(
                    kind = "assignment",
                    title = obj["title"]?.jsonPrimitive?.contentOrNull() ?: "Assignment",
                    className = classNames[obj["class_id"]?.jsonPrimitive?.contentOrNull()] ?: "Class",
                    at = deadline,
                    endsAt = null,
                    detail = "Deadline",
                ),
            )
        }
        publicTasks.forEach { row ->
            val obj = row.jsonObject
            val deadline = obj["deadline"]?.jsonPrimitive?.contentOrNull() ?: return@forEach
            add(
                NextScheduleItem(
                    kind = "assignment",
                    title = obj["title"]?.jsonPrimitive?.contentOrNull() ?: "Assignment",
                    className = courseNames[obj["course_id"]?.jsonPrimitive?.contentOrNull()] ?: "Course",
                    at = deadline,
                    endsAt = null,
                    detail = "Deadline",
                ),
            )
        }
        sessions.forEach { row ->
            val obj = row.jsonObject
            val startsAt = obj["starts_at"]?.jsonPrimitive?.contentOrNull() ?: return@forEach
            add(
                NextScheduleItem(
                    kind = "session",
                    title = obj["title"]?.jsonPrimitive?.contentOrNull() ?: "Session",
                    className = classNames[obj["class_id"]?.jsonPrimitive?.contentOrNull()] ?: "Class",
                    at = startsAt,
                    endsAt = obj["ends_at"]?.jsonPrimitive?.contentOrNull(),
                    detail = if (obj["session_type"]?.jsonPrimitive?.contentOrNull() == "online") "Online session" else "Session",
                ),
            )
        }
    }

    fun instantOf(iso: String): java.time.Instant = try {
        java.time.Instant.parse(iso)
    } catch (_: Exception) {
        try {
            java.time.OffsetDateTime.parse(iso).toInstant()
        } catch (_: Exception) {
            java.time.Instant.MAX
        }
    }

    return candidates.sortedBy { instantOf(it.at) }.firstOrNull()
}
