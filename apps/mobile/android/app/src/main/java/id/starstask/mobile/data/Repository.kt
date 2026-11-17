package id.starstask.mobile.data

import io.github.jan.supabase.postgrest.postgrest
import io.github.jan.supabase.postgrest.query.Columns
import io.github.jan.supabase.postgrest.query.filter.FilterOperator
import kotlinx.coroutines.tasks.await
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put
import kotlinx.serialization.Serializable

/**
 * Read models for the native shell, mirroring the web dashboard queries.
 * Only public-safe columns are selected; eligibility/authorization stays
 * server-side via RLS + RPCs.
 */

@Serializable
data class DashboardSession(
    val id: String,
    val title: String,
    val startsAt: String,
    val endsAt: String,
    val subjectName: String?,
    val checkInStatus: String?,
    val checkInLatitude: Double?,
    val checkInLongitude: Double?,
)

@Serializable
data class DashboardAssignment(
    val id: String,
    val title: String,
    val deadline: String?,
    val subjectName: String?,
)

@Serializable
data class DashboardClass(
    val id: String,
    val name: String,
    val slug: String = "",
    val semester: String = "",
    val academicYear: String = "",
    val classCode: String? = null,
    val subjectCount: Int = 0,
    val taskCount: Int = 0,
    val isAdmin: Boolean = false,
    val adminName: String? = null,
)

@Serializable
data class DashboardData(
    val displayName: String?,
    val totalTasks: Int,
    val dueSoon: Int,
    val pastDeadline: Int,
    val newThisWeek: Int = 0,
    val classes: List<DashboardClass>,
    val todaySessions: List<DashboardSession>,
    val upcomingAssignments: List<DashboardAssignment>,
    val latestPastAssignment: DashboardAssignment? = null,
)

suspend fun loadDashboard(userId: String): DashboardData {
    val db = SupabaseProvider.client.postgrest

    val memberships = db.from("class_members").select {
        filter { eq("user_id", userId) }
    }.decodeJsonArray().mapNotNull { it.jsonObject["class_id"]?.jsonPrimitive?.content }

    val profileRows = db.from("profiles").select {
        filter { eq("id", userId) }
        limit(1)
    }.decodeJsonArray()
    val profile: String? = profileRows.firstOrNull()
        ?.jsonObject?.get("display_name")?.jsonPrimitive?.contentOrNull()

    if (memberships.isEmpty()) {
        return DashboardData(
            displayName = profile,
            totalTasks = 0,
            dueSoon = 0,
            pastDeadline = 0,
            newThisWeek = 0,
            classes = emptyList(),
            todaySessions = emptyList(),
            upcomingAssignments = emptyList(),
            latestPastAssignment = null,
        )
    }

    val nowIso = java.time.Instant.now().toString()
    val dueSoonEnd = java.time.Instant.now().plusSeconds(7 * 24 * 3600).toString()
    val windowStart = java.time.Instant.now().minusSeconds(24 * 3600).toString()
    val windowEnd = java.time.Instant.now().plusSeconds(7 * 24 * 3600).toString()

    val classRows = db.from("classes").select {
        filter { isIn("id", memberships) }
    }.decodeJsonArray().mapNotNull {
        val obj = it.jsonObject
        val id = obj["id"]?.jsonPrimitive?.content ?: return@mapNotNull null
        val name = obj["name"]?.jsonPrimitive?.content ?: return@mapNotNull null
        DashboardClass(
            id = id,
            name = name,
            slug = obj["slug"]?.jsonPrimitive?.contentOrNull() ?: "",
            semester = obj["semester"]?.jsonPrimitive?.contentOrNull() ?: "",
            academicYear = obj["academic_year"]?.jsonPrimitive?.contentOrNull() ?: "",
            classCode = obj["class_code"]?.jsonPrimitive?.contentOrNull(),
        )
    }.sortedBy { it.name }

    // Web MyClassesSection chips: subject/task counts, admin badge + name.
    val subjectCounts = if (classRows.isEmpty()) {
        emptyMap<String, Int>()
    } else {
        db.from("class_subjects").select(Columns.raw("class_id")) {
            filter { isIn("class_id", classRows.map { it.id }) }
        }.decodeJsonArray().groupingBy {
            it.jsonObject["class_id"]!!.jsonPrimitive.content
        }.eachCount()
    }
    val taskCounts = if (classRows.isEmpty()) {
        emptyMap<String, Int>()
    } else {
        db.from("assignments").select(Columns.raw("class_id")) {
            filter {
                isIn("class_id", classRows.map { it.id })
                eq("status", "published")
            }
        }.decodeJsonArray().groupingBy {
            it.jsonObject["class_id"]!!.jsonPrimitive.content
        }.eachCount()
    }
    val adminClassIds = if (classRows.isEmpty()) {
        emptySet<String>()
    } else {
        db.from("class_admins").select {
            filter {
                eq("user_id", userId)
                isIn("class_id", classRows.map { it.id })
            }
        }.decodeJsonArray().mapNotNull {
            it.jsonObject["class_id"]?.jsonPrimitive?.content
        }.toSet()
    }
    val adminNames = run {
        val creatorIds = db.from("classes").select(Columns.raw("id,created_by")) {
            filter { isIn("id", classRows.map { c -> c.id }) }
        }.decodeJsonArray().mapNotNull {
            val obj = it.jsonObject
            val cid = obj["id"]?.jsonPrimitive?.content
            val uid = obj["created_by"]?.jsonPrimitive?.contentOrNull()
            if (cid != null && uid != null) cid to uid else null
        }.toMap()
        if (creatorIds.isEmpty()) {
            emptyMap<String, String>()
        } else {
            db.from("profiles").select(Columns.raw("id,display_name")) {
                filter { isIn("id", creatorIds.values.toList()) }
            }.decodeJsonArray().associateBy(
                { row -> row.jsonObject["id"]!!.jsonPrimitive.content },
                { row -> row.jsonObject["display_name"]?.jsonPrimitive?.contentOrNull() },
            ).let { names ->
                creatorIds.mapValues { (_, uid) -> names[uid] }
            }
        }
    }
    val enrichedClasses = classRows.map {
        it.copy(
            subjectCount = subjectCounts[it.id] ?: 0,
            taskCount = taskCounts[it.id] ?: 0,
            isAdmin = it.id in adminClassIds,
            adminName = adminNames[it.id],
        )
    }

    val sessions = db.from("discussion_sessions").select {
        filter {
            isIn("class_id", memberships)
            eq("status", "scheduled")
            filterNot("meeting_number", io.github.jan.supabase.postgrest.query.filter.FilterOperator.IS, null)
            gte("starts_at", windowStart)
            lte("starts_at", windowEnd)
        }
        order("starts_at", io.github.jan.supabase.postgrest.query.Order.ASCENDING)
        limit(50)
    }.decodeJsonArray()

    val assignments = db.from("assignments").select {
        filter {
            eq("status", "published")
            gte("deadline", windowStart)
        }
        order("deadline", io.github.jan.supabase.postgrest.query.Order.ASCENDING)
        limit(5)
    }.decodeJsonArray()

    // Dashboard slot falls back to the most recent past-deadline task when no
    // upcoming one exists, so the slot is never empty. Fetched raw here; the
    // subject name lookup happens once subjectNames is built.
    val latestPastElement = runCatching {
        db.from("assignments").select {
            filter {
                eq("status", "published")
                lt("deadline", nowIso)
            }
            order("deadline", io.github.jan.supabase.postgrest.query.Order.DESCENDING)
            limit(1)
        }.decodeJsonArray().firstOrNull()
    }.getOrNull()

    val allRows: List<kotlinx.serialization.json.JsonElement> = sessions + assignments + listOfNotNull(latestPastElement)
    val subjectIds: Set<String> = allRows.mapNotNull {
        it.jsonObject["subject_id"]?.jsonPrimitive?.contentOrNull()
    }.toSet()

    val subjectNames: Map<String, String?> = if (subjectIds.isEmpty()) {
        emptyMap()
    } else {
        db.from("class_subjects").select {
            filter { isIn("id", subjectIds.toList()) }
        }.decodeJsonArray().associateBy(
            { row: kotlinx.serialization.json.JsonElement -> row.jsonObject["id"]!!.jsonPrimitive.content },
            { row: kotlinx.serialization.json.JsonElement -> row.jsonObject["name"]?.jsonPrimitive?.contentOrNull() },
        )
    }

    val latestPastAssignment = latestPastElement?.let {
        val obj = it.jsonObject
        DashboardAssignment(
            id = obj["id"]!!.jsonPrimitive.content,
            title = obj["title"]?.jsonPrimitive?.contentOrNull() ?: "Assignment",
            deadline = obj["deadline"]?.jsonPrimitive?.contentOrNull(),
            subjectName = obj["subject_id"]?.jsonPrimitive?.contentOrNull()?.let(subjectNames::get),
        )
    }

    val today = java.time.LocalDate.now(java.time.ZoneId.systemDefault()).toString()
    val todayRows = sessions.filter {
        it.jsonObject["starts_at"]?.jsonPrimitive?.content?.substring(0, 10) == today ||
            deviceDate(it.jsonObject["starts_at"]!!.jsonPrimitive.content) == today
    }

    val checkIns = if (todayRows.isNotEmpty()) {
        db.from("discussion_session_checkins").select {
            filter {
                eq("user_id", userId)
                isIn("session_id", todayRows.map { it.jsonObject["id"]!!.jsonPrimitive.content })
            }
        }.decodeJsonArray()
    } else {
        emptyList()
    }
    val checkInBySession = checkIns.associateBy(
        { it.jsonObject["session_id"]!!.jsonPrimitive.content },
        { it.jsonObject["status"]?.jsonPrimitive?.contentOrNull() },
    )

    val totalTasks = countPublished(db, memberships, null)
    val dueSoon = countPublished(db, memberships, nowIso..dueSoonEnd)
    val pastDeadline = countPublished(db, memberships, null, ltDeadline = nowIso)
    val weekAgo = java.time.Instant.now().minusSeconds(7 * 24 * 3600).toString()
    val newThisWeek = countPublished(db, memberships, weekAgo..nowIso)

    return DashboardData(
        displayName = profile,
        totalTasks = totalTasks,
        dueSoon = dueSoon,
        pastDeadline = pastDeadline,
        newThisWeek = newThisWeek,
        classes = enrichedClasses,
        todaySessions = todayRows.map {
            val obj = it.jsonObject
            DashboardSession(
                id = obj["id"]!!.jsonPrimitive.content,
                title = obj["title"]?.jsonPrimitive?.contentOrNull() ?: "Session",
                startsAt = obj["starts_at"]!!.jsonPrimitive.content,
                endsAt = obj["ends_at"]!!.jsonPrimitive.content,
                subjectName = obj["subject_id"]?.jsonPrimitive?.contentOrNull()?.let(subjectNames::get),
                checkInStatus = checkInBySession[obj["id"]!!.jsonPrimitive.content],
                checkInLatitude = obj["checkin_latitude"]?.jsonPrimitive?.content?.toDoubleOrNull(),
                checkInLongitude = obj["checkin_longitude"]?.jsonPrimitive?.content?.toDoubleOrNull(),
            )
        },
        upcomingAssignments = assignments.map {
            val obj = it.jsonObject
            DashboardAssignment(
                id = obj["id"]!!.jsonPrimitive.content,
                title = obj["title"]?.jsonPrimitive?.contentOrNull() ?: "Assignment",
                deadline = obj["deadline"]?.jsonPrimitive?.contentOrNull(),
                subjectName = obj["subject_id"]?.jsonPrimitive?.contentOrNull()?.let(subjectNames::get),
            )
        },
        latestPastAssignment = latestPastAssignment,
    )
}

private suspend fun countPublished(
    db: io.github.jan.supabase.postgrest.Postgrest,
    classIds: List<String>,
    range: ClosedRange<String>? = null,
    ltDeadline: String? = null,
): Int {
    val result = db.from("assignments").select(
        Columns.raw("id"),
    ) {
        filter {
            eq("status", "published")
            isIn("class_id", classIds)
            if (range != null) {
                gte("deadline", range.start)
                lte("deadline", range.endInclusive)
            }
            if (ltDeadline != null) {
                lt("deadline", ltDeadline)
            }
        }
    }
    return result.decodeJsonArray().size
}
