package id.starstask.mobile.data

import io.github.jan.supabase.postgrest.postgrest
import io.github.jan.supabase.postgrest.query.Columns
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.Serializable

// Translation of apps/web/src/lib/db/class-overview.ts getClassOverviewData.
// Android only: scoped class rows + catalog-course public rows, deduped by id,
// split into assignments vs class_announcement posts, stats from the same rows.

@Serializable
data class OverviewAssignmentItem(
    val id: String,
    val title: String,
    val courseName: String,
    val courseCode: String?,
    val deadline: String?,
    val publishedAt: String?,
    val createdAt: String,
    val completed: Boolean,
)

@Serializable
data class OverviewPostItem(
    val id: String,
    val title: String,
    val description: String,
    val publishedAt: String?,
    val createdAt: String,
    val authorName: String,
)

@Serializable
data class ClassOverviewStats(
    val total: Int,
    val upcoming: Int,
    val dueToday: Int,
    val completed: Int,
)

@Serializable
data class ClassOverviewData(
    val recent: List<OverviewAssignmentItem>,
    val posts: List<OverviewPostItem>,
    val stats: ClassOverviewStats,
)

private const val RECENT_LIMIT = 5
private const val POSTS_LIMIT = 5

suspend fun loadClassOverview(userId: String, classId: String): ClassOverviewData {
    val db = SupabaseProvider.client.postgrest

    val subjectRows = db.from("class_subjects").select(Columns.raw("course_id")) {
        filter { eq("class_id", classId) }
    }.decodeJsonArray()
    val courseIds = subjectRows.mapNotNull {
        it.jsonObject["course_id"]?.jsonPrimitive?.contentOrNull()
    }.toSet()

    val scoped = db.from("assignments").select {
        filter {
            eq("class_id", classId)
            eq("status", "published")
        }
        order("created_at", io.github.jan.supabase.postgrest.query.Order.DESCENDING)
        limit(500)
    }.decodeJsonArray()

    val publicRows = if (courseIds.isNotEmpty()) {
        db.from("assignments").select {
            filter {
                isIn("course_id", courseIds.toList())
                eq("status", "published")
            }
            order("created_at", io.github.jan.supabase.postgrest.query.Order.DESCENDING)
            limit(500)
        }.decodeJsonArray().filter { row ->
            row.jsonObject["class_id"] == kotlinx.serialization.json.JsonNull &&
                row.jsonObject["subject_id"] == kotlinx.serialization.json.JsonNull
        }
    } else {
        emptyList()
    }

    val seen = mutableSetOf<String>()
    val rows = (scoped + publicRows).filter { row ->
        val id = row.jsonObject["id"]?.jsonPrimitive?.contentOrNull()
        id != null && seen.add(id)
    }

    val assignments = rows.filter {
        it.jsonObject["content_type"]?.jsonPrimitive?.contentOrNull() != "class_announcement"
    }
    val announcements = rows.filter {
        it.jsonObject["content_type"]?.jsonPrimitive?.contentOrNull() == "class_announcement"
    }

    val now = java.time.Instant.now()
    var upcoming = 0
    var dueToday = 0
    for (row in assignments) {
        when (getDeadlineState(row.jsonObject["deadline"]?.jsonPrimitive?.contentOrNull(), now)) {
            DeadlineState.UPCOMING -> upcoming++
            DeadlineState.DUE_TODAY -> dueToday++
            else -> Unit
        }
    }

    val completedIds = loadCompletionIds(userId, assignments.mapNotNull {
        it.jsonObject["id"]?.jsonPrimitive?.content
    })

    val courseIdSet = assignments.mapNotNull {
        it.jsonObject["course_id"]?.jsonPrimitive?.contentOrNull()
    }.toSet()
    val courseNames = if (courseIdSet.isEmpty()) {
        emptyMap()
    } else {
        db.from("courses").select(Columns.raw("id,name,code")) {
            filter { isIn("id", courseIdSet.toList()) }
        }.decodeJsonArray().associateBy(
            { it.jsonObject["id"]!!.jsonPrimitive.content },
            { row ->
                row.jsonObject["name"]?.jsonPrimitive?.contentOrNull() to
                    row.jsonObject["code"]?.jsonPrimitive?.contentOrNull()
            },
        )
    }

    val recent = assignments
        .sortedByDescending { it.jsonObject["created_at"]?.jsonPrimitive?.contentOrNull() ?: "" }
        .take(RECENT_LIMIT)
        .mapNotNull { row ->
            val obj = row.jsonObject
            val id = obj["id"]?.jsonPrimitive?.content ?: return@mapNotNull null
            val courseId = obj["course_id"]?.jsonPrimitive?.contentOrNull()
            val (courseName, courseCode) = courseId?.let { courseNames[it] }
                ?: ("Unknown course" to null)
            OverviewAssignmentItem(
                id = id,
                title = obj["title"]?.jsonPrimitive?.contentOrNull() ?: "Assignment",
                courseName = courseName ?: "Unknown course",
                courseCode = courseCode,
                deadline = obj["deadline"]?.jsonPrimitive?.contentOrNull(),
                publishedAt = obj["published_at"]?.jsonPrimitive?.contentOrNull(),
                createdAt = obj["created_at"]?.jsonPrimitive?.contentOrNull() ?: "",
                completed = completedIds.contains(id),
            )
        }

    val postRows = announcements
        .sortedByDescending { it.jsonObject["created_at"]?.jsonPrimitive?.contentOrNull() ?: "" }
        .take(POSTS_LIMIT)

    val authorIds = postRows.mapNotNull {
        it.jsonObject["user_id"]?.jsonPrimitive?.content
    }.toSet()
    val authorNames = if (authorIds.isEmpty()) {
        emptyMap()
    } else {
        db.from("profiles").select(Columns.raw("id,display_name")) {
            filter { isIn("id", authorIds.toList()) }
        }.decodeJsonArray().associateBy(
            { it.jsonObject["id"]!!.jsonPrimitive.content },
            { it.jsonObject["display_name"]?.jsonPrimitive?.contentOrNull() },
        )
    }

    val posts = postRows.mapNotNull { row ->
        val obj = row.jsonObject
        val id = obj["id"]?.jsonPrimitive?.content ?: return@mapNotNull null
        OverviewPostItem(
            id = id,
            title = obj["title"]?.jsonPrimitive?.contentOrNull() ?: "Post",
            description = obj["description"]?.jsonPrimitive?.contentOrNull() ?: "",
            publishedAt = obj["published_at"]?.jsonPrimitive?.contentOrNull(),
            createdAt = obj["created_at"]?.jsonPrimitive?.contentOrNull() ?: "",
            authorName = obj["user_id"]?.jsonPrimitive?.content?.let(authorNames::get) ?: "StarsTask member",
        )
    }

    return ClassOverviewData(
        recent = recent,
        posts = posts,
        stats = ClassOverviewStats(
            total = assignments.size,
            upcoming = upcoming,
            dueToday = dueToday,
            completed = completedIds.size,
        ),
    )
}
