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

// Direct translation of apps/web/src/lib/db/assignments.ts listAssignments
// (RPC list_assignments). Pure filter/sort/group logic lives in
// AssignmentLogic.kt, and shared formatting in AssignmentFormat.kt.

val ASSIGNMENT_TYPES = listOf(
    "individual",
    "group",
    "lab",
    "project",
    "presentation",
    "exam",
    "other",
)

val ASSIGNMENT_SORT_LABELS = mapOf(
    "newest" to "Newest first",
    "oldest" to "Oldest first",
    "deadline" to "Deadline",
)

val COURSE_ASSIGNMENT_FILTERS = listOf(
    "all",
    "upcoming",
    "in-progress",
    "submitted",
    "closed",
)

val COURSE_ASSIGNMENT_FILTER_LABELS = mapOf(
    "all" to "All",
    "upcoming" to "Upcoming",
    "in-progress" to "In progress",
    "submitted" to "Submitted",
    "closed" to "Closed",
)

val COURSE_ASSIGNMENT_SORTS = listOf(
    "due-soonest",
    "due-latest",
    "recent",
    "title",
)

val COURSE_ASSIGNMENT_SORT_LABELS = mapOf(
    "due-soonest" to "Due date (soonest)",
    "due-latest" to "Due date (latest)",
    "recent" to "Recently published",
    "title" to "Title (A–Z)",
)

// Calendar days (Asia/Jakarta) that count as "due soon" on the course overview.
const val UPCOMING_DUE_SOON_DAYS = 3

data class ExploreAssignment(
    val id: String,
    val title: String,
    val description: String,
    val courseId: String?,
    val classId: String?,
    val courseName: String?,
    val courseCode: String?,
    val semester: String?,
    val assignmentType: String?,
    val contentType: String?,
    val sourceLabel: String?,
    val driveUrl: String?,
    val deadline: String?,
    val tags: List<String>,
    val createdAt: String?,
    val publishedAt: String?,
    val authorDisplayName: String?,
    val attachmentCount: Long,
    val totalCount: Long,
) {
    /** Legacy detail screen expects Assignment; published is the only visible status. */
    fun toAssignment(): Assignment =
        Assignment(
            id = id,
            title = title,
            status = "published",
            deadline = deadline,
            className = courseName,
        )
}

data class AssignmentPage(
    val items: List<ExploreAssignment>,
    val total: Long,
    val page: Int,
    val pageSize: Int,
    val totalPages: Int,
)

suspend fun listAssignmentPage(
    search: String? = null,
    courseId: String? = null,
    semester: String? = null,
    type: String? = null,
    tag: String? = null,
    classId: String? = null,
    sort: String = "newest",
    page: Int = 1,
    pageSize: Int = 12,
): AssignmentPage {
    val cacheKey = listingCacheKey(search, courseId, semester, type, tag, classId, sort, page, pageSize)
    cachedListing(cacheKey)?.let { return it }

    val offset = (page - 1) * pageSize
    fun uuidParam(value: String?): kotlinx.serialization.json.JsonElement =
        value?.takeIf { it.isNotBlank() }?.let { JsonPrimitive(it) } ?: JsonNull

    val textParam: (String?) -> kotlinx.serialization.json.JsonElement = {
        it?.takeIf { text -> text.isNotBlank() }?.let { text -> JsonPrimitive(text) } ?: JsonNull
    }

    val rows = SupabaseProvider.client.postgrest.rpc(
        "list_assignments",
        buildJsonObject {
            put("p_search", textParam(search))
            put("p_course_id", uuidParam(courseId))
            put("p_semester", textParam(semester))
            put("p_type", textParam(type))
            put("p_tag", textParam(tag))
            put("p_sort", sort)
            put("p_limit", pageSize)
            put("p_offset", offset)
            // Sent only when used — matches web (older DB without class migration still serves listing).
            if (classId?.isNotBlank() == true) {
                put("p_class_id", uuidParam(classId))
            } else {
                put("p_class_id", JsonNull)
            }
        },
    ).decodeJsonArray()

    val items = rows.mapNotNull { element ->
        val obj = element.jsonObject
        val id = obj["id"]?.jsonPrimitive?.content ?: return@mapNotNull null
        val tags = (obj["tags"] as? JsonArray)?.mapNotNull {
            (it as? JsonPrimitive)?.contentOrNull()
        }.orEmpty()
        ExploreAssignment(
            id = id,
            title = obj["title"]?.jsonPrimitive?.contentOrNull() ?: "Assignment",
            description = obj["description"]?.jsonPrimitive?.contentOrNull().orEmpty(),
            courseId = obj["course_id"]?.jsonPrimitive?.contentOrNull(),
            classId = obj["class_id"]?.jsonPrimitive?.contentOrNull(),
            courseName = obj["course_name"]?.jsonPrimitive?.contentOrNull(),
            courseCode = obj["course_code"]?.jsonPrimitive?.contentOrNull(),
            semester = obj["semester"]?.jsonPrimitive?.contentOrNull(),
            assignmentType = obj["assignment_type"]?.jsonPrimitive?.contentOrNull(),
            contentType = obj["content_type"]?.jsonPrimitive?.contentOrNull(),
            sourceLabel = obj["source_label"]?.jsonPrimitive?.contentOrNull(),
            driveUrl = obj["drive_url"]?.jsonPrimitive?.contentOrNull(),
            deadline = obj["deadline"]?.jsonPrimitive?.contentOrNull(),
            tags = tags,
            createdAt = obj["created_at"]?.jsonPrimitive?.contentOrNull(),
            publishedAt = null,
            authorDisplayName = obj["author_display_name"]?.jsonPrimitive?.contentOrNull(),
            attachmentCount = obj["attachment_count"]?.jsonPrimitive?.contentOrNull()?.toLongOrNull() ?: 0,
            totalCount = obj["total_count"]?.jsonPrimitive?.contentOrNull()?.toLongOrNull() ?: 0,
        )
    }

    val total = items.firstOrNull()?.totalCount ?: 0
    return AssignmentPage(
        items = items,
        total = total,
        page = page,
        pageSize = pageSize,
        totalPages = maxOf(1, kotlin.math.ceil(total.toDouble() / pageSize).toInt()),
    ).also { storeListing(cacheKey, it) }
}
