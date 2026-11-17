package id.starstask.mobile.data

import io.github.jan.supabase.postgrest.postgrest
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive

// ---------------------------------------------------------------------------
// My Week (web getMyWeek): one Mon-Sun window in the device zone containing
// sessions, assignment deadlines, and the student's own leave requests.
// weekOffset moves the window; clamped to +/-52 like the web page.
// ---------------------------------------------------------------------------

const val MAX_WEEK_OFFSET = 52

enum class MyWeekItemKind { SESSION, ASSIGNMENT, LEAVE }

data class MyWeekItem(
    val key: String,
    val kind: MyWeekItemKind,
    val title: String,
    val at: String,
    val className: String?,
    val hrefId: String,
)

data class MyWeekData(
    val weekStartIso: String,
    val items: List<MyWeekItem>,
)

private fun weekStartFor(offset: Int): java.time.LocalDate {
    val zone = java.time.ZoneId.systemDefault()
    val today = java.time.LocalDate.now(zone)
    val monday = today.minusDays((today.dayOfWeek.value - 1).toLong())
    return monday.plusWeeks(offset.toLong())
}

suspend fun loadMyWeek(userId: String, weekOffset: Int): MyWeekData {
    val clamped = weekOffset.coerceIn(-MAX_WEEK_OFFSET, MAX_WEEK_OFFSET)
    val start = weekStartFor(clamped)
    val end = start.plusWeeks(1)
    val zone = java.time.ZoneId.systemDefault()
    val startIso = start.atStartOfDay(zone).toInstant().toString()
    val endIso = end.atStartOfDay(zone).toInstant().toString()

    val db = SupabaseProvider.client.postgrest
    val memberships = db.from("class_members").select {
        filter { eq("user_id", userId) }
    }.decodeJsonArray().mapNotNull { it.jsonObject["class_id"]?.jsonPrimitive?.content }

    val items = mutableListOf<MyWeekItem>()

    if (memberships.isNotEmpty()) {
        val classNames = db.from("classes").select {
            filter { isIn("id", memberships) }
        }.decodeJsonArray().mapNotNull { row ->
            row.jsonObject["id"]?.jsonPrimitive?.content?.let { id -> id to (row.jsonObject["name"]?.jsonPrimitive?.contentOrNull()) }
        }.toMap()

        val sessions = db.from("discussion_sessions").select {
            filter {
                isIn("class_id", memberships)
                neq("status", "cancelled")
                gte("starts_at", startIso)
                lt("starts_at", endIso)
            }
            order("starts_at", io.github.jan.supabase.postgrest.query.Order.ASCENDING)
            limit(100)
        }.decodeJsonArray()
        sessions.forEach { row ->
            val obj = row.jsonObject
            val id = obj["id"]?.jsonPrimitive?.content ?: return@forEach
            val startsAt = obj["starts_at"]?.jsonPrimitive?.contentOrNull() ?: return@forEach
            items += MyWeekItem(
                key = "session-$id",
                kind = MyWeekItemKind.SESSION,
                title = obj["title"]?.jsonPrimitive?.contentOrNull() ?: "Session",
                at = startsAt,
                className = classNames[obj["class_id"]?.jsonPrimitive?.contentOrNull()],
                hrefId = id,
            )
        }

        val assignments = db.from("assignments").select {
            filter {
                isIn("class_id", memberships)
                eq("status", "published")
                filter("deadline", io.github.jan.supabase.postgrest.query.filter.FilterOperator.IS, null)
                gte("deadline", startIso)
                lt("deadline", endIso)
            }
            order("deadline", io.github.jan.supabase.postgrest.query.Order.ASCENDING)
            limit(100)
        }.decodeJsonArray()
        assignments.forEach { row ->
            val obj = row.jsonObject
            val id = obj["id"]?.jsonPrimitive?.content ?: return@forEach
            val deadline = obj["deadline"]?.jsonPrimitive?.contentOrNull() ?: return@forEach
            items += MyWeekItem(
                key = "assignment-$id",
                kind = MyWeekItemKind.ASSIGNMENT,
                title = obj["title"]?.jsonPrimitive?.contentOrNull() ?: "Assignment",
                at = deadline,
                className = classNames[obj["class_id"]?.jsonPrimitive?.contentOrNull()],
                hrefId = id,
            )
        }
    }

    val leave = db.from("leave_requests").select {
        filter {
            eq("student_id", userId)
            gte("leave_start_date", start.toString())
            lt("leave_start_date", end.toString())
        }
        order("leave_start_date", io.github.jan.supabase.postgrest.query.Order.ASCENDING)
        limit(50)
    }.decodeJsonArray()
    leave.forEach { row ->
        val obj = row.jsonObject
        val id = obj["id"]?.jsonPrimitive?.content ?: return@forEach
        val startDate = obj["leave_start_date"]?.jsonPrimitive?.contentOrNull() ?: return@forEach
        val status = obj["status"]?.jsonPrimitive?.contentOrNull() ?: ""
        items += MyWeekItem(
            key = "leave-$id",
            kind = MyWeekItemKind.LEAVE,
            title = "Absence · ${status.replaceFirstChar { it.uppercase() }}",
            at = startDate,
            className = null,
            hrefId = id,
        )
    }

    return MyWeekData(weekStartIso = start.toString(), items = items)
}

/** Classes the user administers — only these can host a new session. */
suspend fun loadManageableClasses(userId: String): List<ClassDetail> {
    val db = SupabaseProvider.client.postgrest
    val adminClassIds = db.from("class_admins").select {
        filter { eq("user_id", userId) }
    }.decodeJsonArray().mapNotNull { it.jsonObject["class_id"]?.jsonPrimitive?.content }
    if (adminClassIds.isEmpty()) return emptyList()
    val rows = db.from("classes").select {
        filter { isIn("id", adminClassIds) }
        order("name", io.github.jan.supabase.postgrest.query.Order.ASCENDING)
    }.decodeJsonArray()
    return rows.mapNotNull { row ->
        val obj = row.jsonObject
        ClassDetail(
            id = obj["id"]?.jsonPrimitive?.content ?: return@mapNotNull null,
            name = obj["name"]?.jsonPrimitive?.contentOrNull() ?: "Class",
            slug = obj["slug"]?.jsonPrimitive?.contentOrNull() ?: "",
            semester = obj["semester"]?.jsonPrimitive?.contentOrNull() ?: "",
            academicYear = obj["academic_year"]?.jsonPrimitive?.contentOrNull() ?: "",
            memberCount = 0,
        )
    }
}
