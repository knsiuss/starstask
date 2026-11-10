package id.starstask.mobile.data

import io.github.jan.supabase.postgrest.postgrest
import io.github.jan.supabase.postgrest.query.Order
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put

// Native mirror of Web workspace (/assignments):
// - apps/web/src/lib/db/assignment-workspace.ts
// - apps/web/src/lib/assignments/workspace.ts
// - @starstask/shared deadline helpers (Asia/Jakarta WIB).
// Pure helpers are pinned to Web semantics: deadlineUrgency compares
// instants, sorting is lexicographic on ISO strings, overview counts only
// published rows that carry a deadline.
//
// NOTE: queries use only the PostgREST DSL subset proven in this codebase
// (eq / neq / isIn / order / limit). Null checks, title search and
// class/course enrichment happen in memory, matching Web's in-memory merge.

private const val SCHEDULE_FETCH_LIMIT = 500
private const val REQUEST_LIMIT = 50
private const val CLASS_OPTION_LIMIT = 20

const val REVISION_REQUEST_PREFIX = "Revision requested:"

data class WorkspaceSubject(val id: String, val name: String, val code: String?)

data class WorkspaceClassOption(
    val id: String,
    val slug: String,
    val name: String,
    val classCode: String?,
    val isAdmin: Boolean,
    val subjects: List<WorkspaceSubject>,
    val semester: String? = null,
    val academicYear: String? = null,
)

data class WorkspaceScope(
    val classes: List<WorkspaceClassOption>,
    val classIds: List<String>,
    val managedClassIds: List<String>,
    val managesAnyClass: Boolean,
)

data class WorkspaceScheduleItem(
    val id: String,
    val title: String,
    val description: String,
    val status: String,
    val deadline: String?,
    val createdAt: String,
    val courseName: String,
    val courseCode: String?,
    val className: String?,
    val classCode: String?,
    val classSlug: String?,
    val classId: String? = null,
    val attachmentCount: Int,
    val assignmentType: String? = null,
)

data class WorkspaceOverview(
    val total: Int,
    val upcoming: Int,
    val expired: Int,
    val upcomingDeadlines: List<UpcomingDeadline>,
)

data class UpcomingDeadline(
    val id: String,
    val title: String,
    val label: String,
    val deadline: String,
)

enum class RequestDisplayStatus { PENDING, APPROVED, REJECTED, REVISION_REQUESTED }

data class WorkspaceRequest(
    val id: String,
    val title: String,
    val description: String,
    val status: String,
    val displayStatus: RequestDisplayStatus,
    val deadline: String?,
    val rejectionReason: String?,
    val createdAt: String,
    val classId: String,
    val className: String,
    val classSlug: String,
    val classCode: String?,
    val courseName: String,
    val subjectId: String?,
    val submitterName: String?,
)

data class SchedulePage(
    val items: List<WorkspaceScheduleItem>,
    val total: Int,
    val page: Int,
    val pageSize: Int,
    val totalPages: Int,
)

// --- Pure Web-mirrored helpers (unit-testable without network) ---

fun toRequestStatus(status: String, rejectionReason: String?): RequestDisplayStatus =
    when {
        status == "published" -> RequestDisplayStatus.APPROVED
        status == "rejected" ->
            if (rejectionReason?.startsWith(REVISION_REQUEST_PREFIX) == true) {
                RequestDisplayStatus.REVISION_REQUESTED
            } else {
                RequestDisplayStatus.REJECTED
            }
        else -> RequestDisplayStatus.PENDING
    }

fun requestFeedback(status: String, rejectionReason: String?): String? {
    val reason = rejectionReason?.trim().orEmpty()
    if (reason.isEmpty() || status != "rejected") return null
    return if (reason.startsWith(REVISION_REQUEST_PREFIX)) {
        reason.removePrefix(REVISION_REQUEST_PREFIX).trim().ifEmpty { null }
    } else {
        reason
    }
}

fun requestStatusLabel(status: RequestDisplayStatus): String = when (status) {
    RequestDisplayStatus.PENDING -> "Pending"
    RequestDisplayStatus.APPROVED -> "Approved"
    RequestDisplayStatus.REJECTED -> "Rejected"
    RequestDisplayStatus.REVISION_REQUESTED -> "Revision Requested"
}

fun sortScheduleItems(items: List<WorkspaceScheduleItem>, sort: String): List<WorkspaceScheduleItem> =
    when (sort) {
        "oldest" -> items.sortedBy { it.createdAt }
        "deadline" -> items.sortedWith { a, b ->
            when {
                a.deadline != null && b.deadline != null -> a.deadline.compareTo(b.deadline)
                a.deadline != null -> -1
                b.deadline != null -> 1
                else -> a.createdAt.compareTo(b.createdAt)
            }
        }
        else -> items.sortedByDescending { it.createdAt }
    }

fun deadlineUrgency(deadline: String?, nowIso: String): String {
    if (deadline == null) return "none"
    val deadlineMs = try {
        parseTime(deadline)
    } catch (_: Exception) {
        0L
    }
    val nowMs = try {
        parseTime(nowIso)
    } catch (_: Exception) {
        0L
    }
    return if (deadlineMs >= nowMs) "upcoming" else "expired"
}

// --- Data access (direct PostgREST, mirroring Web queries) ---

suspend fun getWorkspaceScope(userId: String): WorkspaceScope {
    val db = SupabaseProvider.client.postgrest
    val memberships = db.from("class_members").select {
        filter { eq("user_id", userId) }
        limit(100L)
    }.decodeJsonArray()

    data class ActiveClass(val id: String, val slug: String, val name: String, val classCode: String?, val isAdmin: Boolean, val semester: String? = null, val academicYear: String? = null)
    val active = mutableListOf<ActiveClass>()
    for (m in memberships) {
        val obj = m.jsonObject
        if (obj["status"]?.jsonPrimitive?.contentOrNull() !in listOf(null, "active")) continue
        val classId = obj["class_id"]?.jsonPrimitive?.contentOrNull() ?: continue
        val isAdmin = obj["is_admin"]?.jsonPrimitive?.contentOrNull() == "true" ||
            obj["role"]?.jsonPrimitive?.contentOrNull() in setOf("admin", "class_admin", "owner")
        active.add(
            ActiveClass(
                id = classId,
                slug = obj["slug"]?.jsonPrimitive?.contentOrNull() ?: "",
                name = obj["class_name"]?.jsonPrimitive?.contentOrNull() ?: "",
                classCode = obj["class_code"]?.jsonPrimitive?.contentOrNull(),
                isAdmin = isAdmin,
            ),
        )
    }
    if (active.isNotEmpty()) {
        val ids = active.map { it.id }
        val classRows = db.from("classes").select {
            filter { isIn("id", ids); eq("status", "active") }
        }.decodeJsonArray()
        val byId = classRows.associateBy { it.jsonObject["id"]?.jsonPrimitive?.contentOrNull() }
        for (i in active.indices) {
            val c = byId[active[i].id]?.jsonObject ?: continue
            active[i] = active[i].copy(
                slug = c["slug"]?.jsonPrimitive?.contentOrNull() ?: active[i].slug,
                name = c["name"]?.jsonPrimitive?.contentOrNull() ?: active[i].name,
                classCode = c["class_code"]?.jsonPrimitive?.contentOrNull() ?: active[i].classCode,
                semester = c["semester"]?.jsonPrimitive?.contentOrNull(),
                academicYear = c["academic_year"]?.jsonPrimitive?.contentOrNull(),
            )
        }
    }

    val classIds = active.map { it.id }
    val managedClassIds = active.filter { it.isAdmin }.map { it.id }
    val classes = mutableListOf<WorkspaceClassOption>()
    for (item in active.take(CLASS_OPTION_LIMIT)) {
        val subjects = try {
            db.from("class_subjects").select {
                filter {
                    eq("class_id", item.id)
                    eq("status", "active")
                }
                order("created_at", Order.ASCENDING)
            }.decodeJsonArray().mapNotNull { s ->
                val o = s.jsonObject
                val sid = o["id"]?.jsonPrimitive?.content ?: return@mapNotNull null
                WorkspaceSubject(
                    id = sid,
                    name = o["name"]?.jsonPrimitive?.contentOrNull() ?: "Course",
                    code = o["code"]?.jsonPrimitive?.contentOrNull(),
                )
            }
        } catch (_: Exception) {
            emptyList()
        }
        classes.add(
            WorkspaceClassOption(
                id = item.id,
                slug = item.slug,
                name = item.name.ifEmpty { "Class" },
                classCode = item.classCode,
                isAdmin = item.isAdmin,
                subjects = subjects,
                semester = item.semester,
                academicYear = item.academicYear,
            ),
        )
    }
    return WorkspaceScope(
        classes = classes,
        classIds = classIds,
        managedClassIds = managedClassIds,
        managesAnyClass = managedClassIds.isNotEmpty(),
    )
}

private suspend fun loadCatalogCourseIds(classIds: List<String>): List<String> {
    if (classIds.isEmpty()) return emptyList()
    val data = SupabaseProvider.client.postgrest.from("class_subjects").select {
        filter { isIn("class_id", classIds) }
    }.decodeJsonArray()
    return data.mapNotNull { it.jsonObject["course_id"]?.jsonPrimitive?.contentOrNull() }.distinct()
}

private suspend fun loadCourseNames(courseIds: List<String>): Map<String, Triple<String?, String?, String?>> {
    if (courseIds.isEmpty()) return emptyMap()
    val rows = SupabaseProvider.client.postgrest.from("courses").select {
        filter { isIn("id", courseIds) }
    }.decodeJsonArray()
    return rows.associate {
        val o = it.jsonObject
        (o["id"]?.jsonPrimitive?.contentOrNull() ?: "") to Triple(
            o["name"]?.jsonPrimitive?.contentOrNull(),
            o["code"]?.jsonPrimitive?.contentOrNull(),
            o["department"]?.jsonPrimitive?.contentOrNull(),
        )
    }
}

private suspend fun loadClassRefs(classIds: List<String>): Map<String, Triple<String?, String?, String?>> {
    if (classIds.isEmpty()) return emptyMap()
    val rows = SupabaseProvider.client.postgrest.from("classes").select {
        filter { isIn("id", classIds) }
    }.decodeJsonArray()
    return rows.associate {
        val o = it.jsonObject
        (o["id"]?.jsonPrimitive?.contentOrNull() ?: "") to Triple(
            o["name"]?.jsonPrimitive?.contentOrNull(),
            o["class_code"]?.jsonPrimitive?.contentOrNull(),
            o["slug"]?.jsonPrimitive?.contentOrNull(),
        )
    }
}

private data class RawScheduleRow(
    val id: String,
    val title: String,
    val description: String,
    val status: String,
    val deadline: String?,
    val createdAt: String,
    val courseId: String?,
    val classId: String?,
    val subjectId: String?,
    val assignmentType: String?,
)

suspend fun listWorkspaceSchedule(
    scope: WorkspaceScope,
    search: String? = null,
    classFilter: String? = null,
    status: String = "all",
    sort: String = "newest",
    type: String? = null,
    page: Int = 1,
    pageSize: Int = 12,
): SchedulePage {
    if (scope.classIds.isEmpty()) {
        return SchedulePage(emptyList(), 0, page, pageSize, 1)
    }
    val db = SupabaseProvider.client.postgrest
    val courseIds = loadCatalogCourseIds(scope.classIds)
    val validClassFilter = classFilter?.takeIf { scope.classIds.contains(it) }

    fun parse(obj: kotlinx.serialization.json.JsonObject): RawScheduleRow? {
        val id = obj["id"]?.jsonPrimitive?.content ?: return null
        return RawScheduleRow(
            id = id,
            title = obj["title"]?.jsonPrimitive?.contentOrNull() ?: "Assignment",
            description = obj["description"]?.jsonPrimitive?.contentOrNull().orEmpty(),
            status = obj["status"]?.jsonPrimitive?.contentOrNull() ?: "published",
            deadline = obj["deadline"]?.jsonPrimitive?.contentOrNull(),
            createdAt = obj["created_at"]?.jsonPrimitive?.contentOrNull() ?: "",
            courseId = obj["course_id"]?.jsonPrimitive?.contentOrNull(),
            classId = obj["class_id"]?.jsonPrimitive?.contentOrNull(),
            subjectId = obj["subject_id"]?.jsonPrimitive?.contentOrNull(),
            assignmentType = obj["assignment_type"]?.jsonPrimitive?.contentOrNull(),
        )
    }

    val publishedScoped = db.from("assignments").select {
        filter {
            isIn("class_id", scope.classIds)
            eq("status", "published")
        }
        order("created_at", Order.DESCENDING)
        limit(SCHEDULE_FETCH_LIMIT.toLong())
    }.decodeJsonArray().mapNotNull { parse(it.jsonObject) }

    val publicRows = if (courseIds.isEmpty()) {
        emptyList()
    } else {
        db.from("assignments").select {
            filter {
                isIn("course_id", courseIds)
                eq("status", "published")
            }
            order("created_at", Order.DESCENDING)
            limit(SCHEDULE_FETCH_LIMIT.toLong())
        }.decodeJsonArray().mapNotNull { parse(it.jsonObject) }
            .filter { it.classId == null && it.subjectId == null }
    }

    val managed = if (scope.managedClassIds.isEmpty()) {
        emptyList()
    } else {
        db.from("assignments").select {
            filter { isIn("class_id", scope.managedClassIds) }
            order("created_at", Order.DESCENDING)
            limit(SCHEDULE_FETCH_LIMIT.toLong())
        }.decodeJsonArray().mapNotNull { parse(it.jsonObject) }
            .filter { it.status != "published" }
    }

    val merged = (publishedScoped + publicRows + managed).distinctBy { it.id }
    val classCourseNames = scope.classes.associate { it.id to it.name }
    val courseIdsAll = merged.mapNotNull { it.courseId }.distinct()
    val classIdsAll = merged.mapNotNull { it.classId }.distinct()
    val courseNames = loadCourseNames(courseIdsAll)
    val classRefs = loadClassRefs(classIdsAll)

    val items = merged.map { raw ->
        val courseName = courseNames[raw.courseId]?.first
        val courseCode = courseNames[raw.courseId]?.second
        val (className, classCode, classSlug) = classRefs[raw.classId] ?: Triple(null, null, null)
        WorkspaceScheduleItem(
            id = raw.id,
            title = raw.title,
            description = raw.description,
            status = raw.status,
            deadline = raw.deadline,
            createdAt = raw.createdAt,
            courseName = courseName ?: (raw.classId?.let { classCourseNames[it] } ?: "Unknown course"),
            courseCode = courseCode,
            className = className,
            classCode = classCode,
            classSlug = classSlug,
            classId = raw.classId,
            attachmentCount = 0,
            assignmentType = raw.assignmentType,
        )
    }

    // Attachment counts in one extra query (mirrors embedded count in Web).
    if (items.isNotEmpty()) {
        try {
            val ids = items.map { it.id }
            val attRows = db.from("assignment_attachments").select {
                filter { isIn("assignment_id", ids) }
                limit(SCHEDULE_FETCH_LIMIT.toLong())
            }.decodeJsonArray()
            val counts = attRows.groupBy { it.jsonObject["assignment_id"]?.jsonPrimitive?.contentOrNull() }.mapValues { it.value.size }
            // Attach via copy (items is a List; rebuild).
            val withCounts = items.map { it.copy(attachmentCount = counts[it.id] ?: 0) }
            val searched = applyScheduleFilters(withCounts, search, validClassFilter, status, type)
            val sorted = sortScheduleItems(searched, sort)
            val total = sorted.size
            val offset = (page - 1) * pageSize
            return SchedulePage(sorted.drop(offset).take(pageSize), total, page, pageSize, maxOf(1, kotlin.math.ceil(total.toDouble() / pageSize).toInt()))
        } catch (_: Exception) {
            // Fall through to unfiltered-count path below.
        }
    }
    val searched = applyScheduleFilters(items, search, validClassFilter, status, type)
    val sorted = sortScheduleItems(searched, sort)
    val total = sorted.size
    val offset = (page - 1) * pageSize
    return SchedulePage(sorted.drop(offset).take(pageSize), total, page, pageSize, maxOf(1, kotlin.math.ceil(total.toDouble() / pageSize).toInt()))
}

private fun applyScheduleFilters(
    items: List<WorkspaceScheduleItem>,
    search: String?,
    classFilter: String?,
    status: String,
    type: String? = null,
): List<WorkspaceScheduleItem> {
    val q = search?.trim()?.lowercase().orEmpty()
    val nowIso = java.time.Instant.now().toString()
    return items.filter { item ->
        val matchesSearch = q.isEmpty() || item.title.lowercase().contains(q)
        val matchesClass = classFilter == null || item.classId == classFilter
        val matchesType = type == null || item.assignmentType == type
        val matchesStatus = if (status == "all") {
            true
        } else {
            when (status) {
                "upcoming" -> deadlineUrgency(item.deadline, nowIso) == "upcoming"
                "overdue" -> deadlineUrgency(item.deadline, nowIso) == "expired"
                "no_deadline" -> item.deadline == null
                else -> item.status == status
            }
        }
        matchesSearch && matchesClass && matchesType && matchesStatus
    }
}

suspend fun getWorkspaceOverview(scope: WorkspaceScope): WorkspaceOverview {
    if (scope.classIds.isEmpty()) return WorkspaceOverview(0, 0, 0, emptyList())
    val db = SupabaseProvider.client.postgrest
    val courseIds = loadCatalogCourseIds(scope.classIds)
    val nowIso = java.time.Instant.now().toString()
    val scoped = db.from("assignments").select {
        filter {
            isIn("class_id", scope.classIds)
            eq("status", "published")
        }
    }.decodeJsonArray()
    val publicRows = if (courseIds.isEmpty()) {
        emptyList()
    } else {
        db.from("assignments").select {
            filter {
                isIn("course_id", courseIds)
                eq("status", "published")
            }
        }.decodeJsonArray().filter { it.jsonObject["class_id"].toString() == "null" && it.jsonObject["subject_id"].toString() == "null" }
    }
    val classNames = scope.classes.associate { it.id to it.name }
    data class Row(val id: String, val title: String, val deadline: String, val label: String)
    val rows = (scoped + publicRows).mapNotNull { el ->
        val o = el.jsonObject
        val id = o["id"]?.jsonPrimitive?.content ?: return@mapNotNull null
        val deadline = o["deadline"]?.jsonPrimitive?.contentOrNull() ?: return@mapNotNull null
        val classId = o["class_id"]?.jsonPrimitive?.contentOrNull()
        Row(id, o["title"]?.jsonPrimitive?.contentOrNull() ?: "Assignment", deadline, classId?.let { classNames[it] } ?: "Unknown course")
    }.distinctBy { it.id }
    var upcoming = 0
    var expired = 0
    for (r in rows) if (r.deadline >= nowIso) upcoming++ else expired++
    val upcomingDeadlines = rows
        .filter { it.deadline >= nowIso }
        .sortedBy { it.deadline }
        .take(5)
        .map { UpcomingDeadline(it.id, it.title, it.label, it.deadline) }
    return WorkspaceOverview(rows.size, upcoming, expired, upcomingDeadlines)
}

private suspend fun enrichRequests(rows: List<kotlinx.serialization.json.JsonElement>): List<WorkspaceRequest> {
    val courseIds = rows.mapNotNull { it.jsonObject["course_id"]?.jsonPrimitive?.contentOrNull() }.distinct()
    val classIds = rows.mapNotNull { it.jsonObject["class_id"]?.jsonPrimitive?.contentOrNull() }.distinct()
    val courseNames = loadCourseNames(courseIds)
    val classRefs = loadClassRefs(classIds)
    return rows.mapNotNull { el ->
        val o = el.jsonObject
        val classId = o["class_id"]?.jsonPrimitive?.contentOrNull() ?: return@mapNotNull null
        val (className, classCode, classSlug) = classRefs[classId] ?: Triple("Class", null, "")
        val status = o["status"]?.jsonPrimitive?.contentOrNull() ?: "pending_review"
        val reason = o["rejection_reason"]?.jsonPrimitive?.contentOrNull()
        val courseId = o["course_id"]?.jsonPrimitive?.contentOrNull()
        WorkspaceRequest(
            id = o["id"]?.jsonPrimitive?.content ?: return@mapNotNull null,
            title = o["title"]?.jsonPrimitive?.contentOrNull() ?: "Assignment",
            description = o["description"]?.jsonPrimitive?.contentOrNull().orEmpty(),
            status = status,
            displayStatus = toRequestStatus(status, reason),
            deadline = o["deadline"]?.jsonPrimitive?.contentOrNull(),
            rejectionReason = reason,
            createdAt = o["created_at"]?.jsonPrimitive?.contentOrNull() ?: "",
            classId = classId,
            className = className ?: "Class",
            classSlug = classSlug ?: "",
            classCode = classCode,
            courseName = courseNames[courseId]?.first ?: "Unknown course",
            subjectId = o["subject_id"]?.jsonPrimitive?.contentOrNull(),
            submitterName = null,
        )
    }
}

suspend fun listMyRequests(userId: String, scope: WorkspaceScope): List<WorkspaceRequest> {
    if (scope.classIds.isEmpty()) return emptyList()
    val rows = SupabaseProvider.client.postgrest.from("assignments").select {
        filter {
            eq("user_id", userId)
            isIn("class_id", scope.classIds)
        }
        order("created_at", Order.DESCENDING)
        limit(REQUEST_LIMIT.toLong())
    }.decodeJsonArray().filter {
        it.jsonObject["status"]?.jsonPrimitive?.contentOrNull() in listOf("pending_review", "rejected", "published")
    }
    return enrichRequests(rows)
}

suspend fun listManagedRequests(scope: WorkspaceScope): List<WorkspaceRequest> {
    if (scope.managedClassIds.isEmpty()) return emptyList()
    val db = SupabaseProvider.client.postgrest
    val rows = db.from("assignments").select {
        filter { isIn("class_id", scope.managedClassIds) }
        order("created_at", Order.DESCENDING)
        limit(REQUEST_LIMIT.toLong())
    }.decodeJsonArray().filter {
        it.jsonObject["status"]?.jsonPrimitive?.contentOrNull() in listOf("pending_review", "rejected", "published")
    }
    val enriched = enrichRequests(rows)
    val ownerIds = rows.mapNotNull { it.jsonObject["user_id"]?.jsonPrimitive?.contentOrNull() }.distinct()
    if (ownerIds.isEmpty()) return enriched
    val profiles = try {
        db.from("profiles").select { filter { isIn("id", ownerIds) } }.decodeJsonArray()
            .associate {
                (it.jsonObject["id"]?.jsonPrimitive?.contentOrNull() ?: "") to
                    (it.jsonObject["display_name"]?.jsonPrimitive?.contentOrNull())
            }
    } catch (_: Exception) {
        emptyMap()
    }
    val ownerById = rows.associate {
        (it.jsonObject["id"]?.jsonPrimitive?.contentOrNull() ?: "") to
            (it.jsonObject["user_id"]?.jsonPrimitive?.contentOrNull())
    }
    return enriched.map { it.copy(submitterName = ownerById[it.id]?.let { p -> profiles[p] }) }
}

// --- Assignment detail helpers (Web getAssignmentDetail / trust loop) ---

data class AssignmentDetail(
    val id: String,
    val title: String,
    val description: String,
    val status: String,
    val deadline: String?,
    val createdAt: String,
    val updatedAt: String? = null,
    val courseName: String,
    val courseCode: String?,
    val courseDepartment: String? = null,
    val lecturerName: String? = null,
    val semester: String? = null,
    val academicYear: String? = null,
    val referenceUrls: List<String> = emptyList(),
    val rejectionReason: String? = null,
    val className: String?,
    val classCode: String?,
    val classSlug: String?,
    val classId: String?,
    val assignmentType: String?,
    val ownerId: String?,
    val authorDisplayName: String? = null,
    val authorAvatarUrl: String? = null,
    val contentType: String?,
    val sourceLabel: String?,
    val tags: List<String> = emptyList(),
    val driveUrl: String?,
    val publishedAt: String?,
)

suspend fun getWorkspaceAssignmentDetail(assignmentId: String): AssignmentDetail? {
    val db = SupabaseProvider.client.postgrest
    val rows = db.from("assignments").select {
        filter { eq("id", assignmentId) }
        limit(1L)
    }.decodeJsonArray()
    val obj = rows.firstOrNull()?.jsonObject ?: return null
    val classId = obj["class_id"]?.jsonPrimitive?.contentOrNull()
    val courseId = obj["course_id"]?.jsonPrimitive?.contentOrNull()
    val course = courseId?.let { loadCourseNames(listOf(it))[it] }
    val cls = classId?.let { loadClassRefs(listOf(it))[it] }
    val authorId = obj["user_id"]?.jsonPrimitive?.contentOrNull()
    val authorProfile = authorId?.let {
        db.from("profiles").select {
            filter { eq("id", it) }
            limit(1L)
        }.decodeJsonArray().firstOrNull()?.jsonObject
    }
    val authorName = authorProfile?.get("display_name")?.jsonPrimitive?.contentOrNull()
    val authorAvatarUrl = authorProfile?.get("avatar_url")?.jsonPrimitive?.contentOrNull()
    return AssignmentDetail(
        id = obj["id"]?.jsonPrimitive?.content ?: return null,
        title = obj["title"]?.jsonPrimitive?.contentOrNull() ?: "Assignment",
        description = obj["description"]?.jsonPrimitive?.contentOrNull().orEmpty(),
        status = obj["status"]?.jsonPrimitive?.contentOrNull() ?: "published",
        deadline = obj["deadline"]?.jsonPrimitive?.contentOrNull(),
        createdAt = obj["created_at"]?.jsonPrimitive?.contentOrNull() ?: "",
        courseName = course?.first ?: "Unknown course",
        courseCode = course?.second,
        courseDepartment = course?.third,
        lecturerName = obj["lecturer_name"]?.jsonPrimitive?.contentOrNull(),
        semester = obj["semester"]?.jsonPrimitive?.contentOrNull(),
        academicYear = obj["academic_year"]?.jsonPrimitive?.contentOrNull(),
        rejectionReason = obj["rejection_reason"]?.jsonPrimitive?.contentOrNull(),
        updatedAt = obj["updated_at"]?.jsonPrimitive?.contentOrNull(),
        className = cls?.first,
        classCode = cls?.second,
        classSlug = cls?.third,
        classId = classId,
        assignmentType = obj["assignment_type"]?.jsonPrimitive?.contentOrNull(),
        ownerId = obj["user_id"]?.jsonPrimitive?.contentOrNull(),
        authorDisplayName = authorName,
        authorAvatarUrl = authorAvatarUrl,
        referenceUrls = (obj["reference_urls"] as? JsonArray)?.mapNotNull {
            (it as? JsonPrimitive)?.contentOrNull()
        }.orEmpty(),
        contentType = obj["content_type"]?.jsonPrimitive?.contentOrNull(),
        sourceLabel = obj["source_label"]?.jsonPrimitive?.contentOrNull(),
        tags = (obj["tags"] as? kotlinx.serialization.json.JsonArray)?.mapNotNull {
            (it as? kotlinx.serialization.json.JsonPrimitive)?.contentOrNull()
        }.orEmpty(),
        driveUrl = obj["drive_url"]?.jsonPrimitive?.contentOrNull(),
        publishedAt = obj["published_at"]?.jsonPrimitive?.contentOrNull(),
    )
}

data class AssignmentRevision(
    val id: String,
    val revision: Int,
    val changeKind: String,
    val changedFields: List<String>,
    val createdAt: String,
)

suspend fun listAssignmentRevisions(assignmentId: String): List<AssignmentRevision> {
    // Visible only to author/class reviewers/platform admins (RLS); other
    // readers get an empty list. Best-effort — never blocks the detail page.
    return try {
        val rows = SupabaseProvider.client.postgrest.from("assignment_revisions").select {
            filter { eq("assignment_id", assignmentId) }
            order("revision", Order.DESCENDING)
            limit(20L)
        }.decodeJsonArray()
        rows.mapNotNull { el ->
            val o = el.jsonObject
            val fields = (o["changed_fields"] as? JsonArray)?.mapNotNull {
                (it as? JsonPrimitive)?.contentOrNull()
            }.orEmpty()
            AssignmentRevision(
                id = o["id"]?.jsonPrimitive?.content ?: return@mapNotNull null,
                revision = o["revision"]?.jsonPrimitive?.contentOrNull()?.toIntOrNull() ?: 0,
                changeKind = o["change_kind"]?.jsonPrimitive?.contentOrNull() ?: "updated",
                changedFields = fields,
                createdAt = o["created_at"]?.jsonPrimitive?.contentOrNull() ?: "",
            )
        }
    } catch (_: Exception) {
        emptyList()
    }
}

// --- Saved assignments (Web saved-assignments; RLS owner-only) ---

suspend fun loadSavedIds(userId: String, assignmentIds: List<String>): Set<String> {
    if (assignmentIds.isEmpty()) return emptySet()
    val rows = SupabaseProvider.client.postgrest.from("saved_assignments").select {
        filter {
            eq("user_id", userId)
            isIn("assignment_id", assignmentIds)
        }
        limit(500L)
    }.decodeJsonArray()
    return rows.mapNotNull { it.jsonObject["assignment_id"]?.jsonPrimitive?.content }.toSet()
}

suspend fun isAssignmentSaved(userId: String, assignmentId: String): Boolean =
    loadSavedIds(userId, listOf(assignmentId)).contains(assignmentId)

suspend fun saveAssignment(userId: String, assignmentId: String) {
    SupabaseProvider.client.postgrest.from("saved_assignments").insert(
        buildJsonObject {
            put("user_id", JsonPrimitive(userId))
            put("assignment_id", JsonPrimitive(assignmentId))
        },
    )
}

suspend fun unsaveAssignment(userId: String, assignmentId: String) {
    SupabaseProvider.client.postgrest.from("saved_assignments").delete {
        filter {
            eq("user_id", userId)
            eq("assignment_id", assignmentId)
        }
    }
}

// --- Reader reports (Web report_assignment RPC) ---

val ASSIGNMENT_REPORT_REASONS = listOf(
    "wrong_deadline" to "Wrong deadline",
    "wrong_details" to "Wrong details",
    "duplicate" to "Duplicate",
    "broken_attachment" to "Broken attachment",
    "other" to "Other",
)

data class MyAssignmentReport(
    val id: String,
    val reason: String,
    val note: String?,
    val status: String,
    val resolutionNote: String?,
)

suspend fun loadMyAssignmentReport(assignmentId: String): MyAssignmentReport? {
    // Returns own open report if any (RLS reporter-only). Empty when none.
    return try {
        val rows = SupabaseProvider.client.postgrest.from("assignment_reports").select {
            filter { eq("assignment_id", assignmentId) }
            order("created_at", Order.DESCENDING)
            limit(5L)
        }.decodeJsonArray()
        rows.firstOrNull()?.let { el ->
            val o = el.jsonObject
            MyAssignmentReport(
                id = o["id"]?.jsonPrimitive?.content ?: return@let null,
                reason = o["reason"]?.jsonPrimitive?.contentOrNull() ?: "",
                note = o["note"]?.jsonPrimitive?.contentOrNull(),
                status = o["status"]?.jsonPrimitive?.contentOrNull() ?: "",
                resolutionNote = o["resolution_note"]?.jsonPrimitive?.contentOrNull(),
            )
        }
    } catch (_: Exception) {
        null
    }
}

suspend fun reportAssignment(assignmentId: String, reason: String, note: String?): String {
    val result = SupabaseProvider.client.postgrest.rpc(
        "report_assignment",
        buildJsonObject {
            put("p_assignment_id", JsonPrimitive(assignmentId))
            put("p_reason", JsonPrimitive(reason))
            note?.takeIf { it.isNotBlank() }?.let { put("p_note", JsonPrimitive(it.trim())) } ?: put("p_note", JsonNull)
        },
    )
    return result.decodeJsonPrimitive().content
}

// --- Create / review (mirrors POST /api/classes/[slug]/submissions) ---

suspend fun createWorkspaceAssignment(
    userId: String,
    scope: WorkspaceScope,
    classId: String,
    subjectId: String,
    title: String,
    description: String,
    deadlineIso: String?,
): String {
    val db = SupabaseProvider.client.postgrest
    val isAdmin = scope.classes.firstOrNull { it.id == classId }?.isAdmin == true
    val status = if (isAdmin) "published" else "pending_review"
    val inserted = db.from("assignments").insert(
        buildJsonObject {
            put("title", JsonPrimitive(title.trim()))
            put("description", JsonPrimitive(description.trim()))
            put("content_type", JsonPrimitive("lecturer_assignment"))
            put("subject_id", JsonPrimitive(subjectId))
            put("class_id", JsonPrimitive(classId))
            put("user_id", JsonPrimitive(userId))
            put("status", JsonPrimitive(status))
            deadlineIso?.let { put("deadline", JsonPrimitive(it)) } ?: put("deadline", JsonNull)
            put("tags", JsonArray(emptyList()))
            put("reference_urls", JsonArray(emptyList()))
        },
    ) { select() }.decodeJsonArray()
    return inserted.firstOrNull()?.jsonObject?.get("id")?.jsonPrimitive?.content
        ?: throw IllegalStateException("Could not create the assignment")
}

suspend fun reviewWorkspaceRequest(
    assignmentId: String,
    decision: String, // approved | rejected | revision
    reason: String?,
) {
    val db = SupabaseProvider.client.postgrest
    if (decision == "approved") {
        db.from("assignments").update(
            buildJsonObject {
                put("status", JsonPrimitive("published"))
                put("rejection_reason", JsonNull)
            },
        ) { filter { eq("id", assignmentId) } }
    } else {
        val stored = if (decision == "revision") {
            "$REVISION_REQUEST_PREFIX ${reason?.trim().orEmpty()}"
        } else {
            reason?.trim().orEmpty()
        }
        db.from("assignments").update(
            buildJsonObject {
                put("status", JsonPrimitive("rejected"))
                put("rejection_reason", JsonPrimitive(stored))
            },
        ) { filter { eq("id", assignmentId) } }
    }
}
