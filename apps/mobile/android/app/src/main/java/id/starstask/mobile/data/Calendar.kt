package id.starstask.mobile.data

import id.starstask.mobile.BuildConfig
import io.github.jan.supabase.auth.auth
import io.github.jan.supabase.postgrest.postgrest
import io.github.jan.supabase.postgrest.query.Order
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive

// Native mirror of apps/web/src/lib/db/calendar.ts (listCalendarEvents).
// Assignments, sessions, official events, personal events, absences and the
// weekly timetable are read from their own tables — never copied — so an
// edit upstream is reflected here immediately. Calendar keys are
// Device-zone dates; UTC instants are only compared, never rendered, in
// the device zone.

private val LEAVE_REASON_LABELS = mapOf(
    "illness" to "Illness",
    "family_matter" to "Family matter",
    "other" to "Other",
)

data class CalendarTimelineItem(
    val id: String,
    val kind: String,
    val title: String,
    val startKey: String,
    val endKey: String,
    val courseKey: String? = null,
    val courseName: String? = null,
    val courseCode: String? = null,
    val isMine: Boolean = false,
    val isCompleted: Boolean = false,
    val isOverdue: Boolean = false,
    val assignmentId: String? = null,
    val sourceId: String = "",
    val startsAtIso: String = "",
    val endsAtIso: String? = null,
    val description: String? = null,
    val location: String? = null,
    val owner: String = "",
    val status: String = "published",
    val classId: String? = null,
    val className: String? = null,
    val subjectId: String? = null,
    val subjectName: String? = null,
    val editable: Boolean = false,
    val managedInClass: Boolean = false,
)

data class CalendarAssignmentBar(
    val id: String,
    val title: String,
    val startKey: String,
    val endKey: String,
    val classId: String? = null,
    val className: String? = null,
    val courseKey: String? = null,
    val courseName: String? = null,
    val courseCode: String? = null,
    val isMine: Boolean = false,
    val isCompleted: Boolean = false,
)

data class CalendarLoaded(
    val items: List<CalendarTimelineItem>,
    /** Deadline-sorted bars after the lifecycle filter (Upcoming source). */
    val assignments: List<CalendarAssignmentBar>,
    val upcoming: List<CalendarAssignmentBar>,
    val scope: WorkspaceScope,
    val storageReady: Boolean,
    val todayKey: String,
)

private fun missingTable(error: Throwable): Boolean {
    val text = error.toString()
    return text.contains("42P01") || text.contains("PGRST205")
}

private fun matchesType(typeFilter: String, kind: String): Boolean =
    typeFilter == "all" || typeFilter == kind

/**
 * Web page-level filters: `mine` narrows assignments to the caller's own
 * uploads; `courseKeys` (null = all courses) keeps only matching course
 * bars. Events are not course-filtered, matching schedule/page.tsx.
 */
suspend fun listCalendar(
    userId: String,
    view: CalendarView,
    anchorKey: String,
    showHistory: Boolean,
    typeFilter: String = "all",
    mineOnly: Boolean = false,
    courseKeys: Set<String>? = null,
    /** Web `class` filter: narrows every source to one of the caller's classes. */
    classFilter: String? = null,
): CalendarLoaded {
    val range = buildCalendarRange(view, anchorKey)
    val scope = getWorkspaceScope(userId)
    val today = deviceTodayKey()
    val db = SupabaseProvider.client.postgrest

    val classLookup = scope.classes.associateBy { it.id }
    val classIds = scope.classIds.filter { classFilter == null || it == classFilter }
    val subjectRows = if (classIds.isEmpty()) {
        emptyList()
    } else {
        db.from("class_subjects").select {
            filter { isIn("class_id", classIds); eq("status", "active") }
            order("name", Order.ASCENDING)
            limit(EVENT_LIMIT.toLong())
        }.decodeJsonArray()
    }
    val subjectCourseIds = subjectRows.mapNotNull { it.jsonObject["course_id"]?.jsonPrimitive?.contentOrNull() }.distinct()
    val subjectById = mutableMapOf<String, Triple<String?, String?, String?>>()
    for (row in subjectRows) {
        val obj = row.jsonObject
        val id = obj["id"]?.jsonPrimitive?.contentOrNull() ?: continue
        subjectById[id] = Triple(
            obj["name"]?.jsonPrimitive?.contentOrNull(),
            obj["code"]?.jsonPrimitive?.contentOrNull(),
            obj["course_id"]?.jsonPrimitive?.contentOrNull(),
        )
    }
    val courseCatalog = mutableMapOf<String, Pair<String?, String?>>()
    val courseIdsToLoad = subjectCourseIds.toMutableSet()
    if (courseIdsToLoad.isNotEmpty()) {
        db.from("courses").select {
            filter { isIn("id", courseIdsToLoad.toList()) }
            limit(EVENT_LIMIT.toLong())
        }.decodeJsonArray().forEach { row ->
            val obj = row.jsonObject
            val id = obj["id"]?.jsonPrimitive?.contentOrNull() ?: return@forEach
            courseCatalog[id] = obj["name"]?.jsonPrimitive?.contentOrNull() to obj["code"]?.jsonPrimitive?.contentOrNull()
        }
    }

    val includeAssignments = matchesType(typeFilter, "assignment")
    val includeSessions = matchesType(typeFilter, "class_schedule") && classIds.isNotEmpty()
    val includeOfficial = typeFilter in listOf("all", "class_schedule", "exam", "academic_event") && classIds.isNotEmpty()
    val includePersonal = matchesType(typeFilter, "personal")
    val includeAbsence = matchesType(typeFilter, "absence") && classIds.isNotEmpty()

    suspend fun loadRows(table: String, windowStart: String, windowEnd: String): List<kotlinx.serialization.json.JsonElement> {
        val result: Result<kotlinx.serialization.json.JsonArray> = runCatching {
            if (classIds.isEmpty()) {
                kotlinx.serialization.json.JsonArray(emptyList())
            } else {
                db.from(table).select {
                    filter {
                        isIn("class_id", classIds)
                        gte("starts_at", windowStart)
                        lt("starts_at", windowEnd)
                    }
                    order("starts_at", Order.ASCENDING)
                    limit(EVENT_LIMIT.toLong())
                }.decodeJsonArray()
            }
        }
        if (result.isFailure) {
            val error = result.exceptionOrNull()!!
            if (missingTable(error)) return emptyList()
            throw error
        }
        return result.getOrNull() ?: emptyList()
    }

    val assignmentRows = mutableListOf<kotlinx.serialization.json.JsonObject>()
    if (includeAssignments && classIds.isNotEmpty()) {
        val scoped = db.from("assignments").select {
            filter {
                isIn("class_id", classIds)
                eq("status", "published")
                gte("deadline", range.fromIso)
                lt("created_at", range.toIso)
            }
            order("deadline", Order.ASCENDING)
            limit(EVENT_LIMIT.toLong())
        }.decodeJsonArray()
        assignmentRows += scoped.map { it.jsonObject }
        if (subjectCourseIds.isNotEmpty()) {
            val publicRows = db.from("assignments").select {
                filter {
                    isIn("course_id", subjectCourseIds)
                    eq("status", "published")
                    gte("deadline", range.fromIso)
                    lt("created_at", range.toIso)
                }
                order("deadline", Order.ASCENDING)
                limit(EVENT_LIMIT.toLong())
            }.decodeJsonArray()
            assignmentRows += publicRows.map { it.jsonObject }
                .filter { it["class_id"].toString() == "null" && it["subject_id"].toString() == "null" }
        }
    }
    val deduped = assignmentRows.distinctBy { it["id"]?.jsonPrimitive?.contentOrNull() }
    val completions = loadCompletionIds(userId, deduped.mapNotNull { it["id"]?.jsonPrimitive?.contentOrNull() })

    val bars = deduped.mapNotNull { row ->
        val id = row["id"]?.jsonPrimitive?.contentOrNull() ?: return@mapNotNull null
        val deadline = row["deadline"]?.jsonPrimitive?.contentOrNull() ?: return@mapNotNull null
        val createdAt = row["created_at"]?.jsonPrimitive?.contentOrNull() ?: return@mapNotNull null
        val subjectId = row["subject_id"]?.jsonPrimitive?.contentOrNull()
        val subject = subjectId?.let { subjectById[it] }
        val catalog = subject?.third?.let { courseCatalog[it] } ?: courseCatalog[row["course_id"]?.jsonPrimitive?.contentOrNull()]
        CalendarAssignmentBar(
            id = id,
            title = row["title"]?.jsonPrimitive?.contentOrNull() ?: "Assignment",
            startKey = toDeviceDateKey(createdAt),
            endKey = toDeviceDateKey(deadline),
            classId = row["class_id"]?.jsonPrimitive?.contentOrNull(),
            className = row["class_id"]?.jsonPrimitive?.contentOrNull()?.let { classLookup[it]?.name },
            courseKey = subject?.third ?: row["course_id"]?.jsonPrimitive?.contentOrNull() ?: subjectId,
            courseName = subject?.first ?: catalog?.first,
            courseCode = subject?.second ?: catalog?.second,
            isMine = row["user_id"]?.jsonPrimitive?.contentOrNull() == userId,
            isCompleted = completions.contains(id),
        )
    }.sortedWith(compareBy<CalendarAssignmentBar> { it.endKey }.thenBy { it.title })
        .filter { bar ->
            (!mineOnly || bar.isMine) && (courseKeys == null || (bar.courseKey != null && courseKeys.contains(bar.courseKey)))
        }

    val displayAssignments = if (showHistory) bars
        else bars.filter { it.isCompleted || it.endKey >= today }

    val items = mutableListOf<CalendarTimelineItem>()
    for (bar in bars) {
        items += CalendarTimelineItem(
            id = "assignment:${bar.id}",
            kind = "assignment",
            title = bar.title,
            startKey = bar.startKey,
            endKey = bar.endKey,
            courseKey = bar.courseKey ?: "unassigned",
            courseName = bar.courseName,
            courseCode = bar.courseCode,
            isMine = bar.isMine,
            isCompleted = bar.isCompleted,
            isOverdue = !bar.isCompleted && bar.endKey < today,
            assignmentId = bar.id,
            sourceId = bar.id,
            classId = bar.classId,
            className = bar.className,
        )
    }

    if (includeSessions) {
        for (row in loadRows("discussion_sessions", range.fromIso, range.toIso)) {
            val obj = row.jsonObject
            val id = obj["id"]?.jsonPrimitive?.contentOrNull() ?: continue
            val classId = obj["class_id"]?.jsonPrimitive?.contentOrNull() ?: continue
            val status = obj["status"]?.jsonPrimitive?.contentOrNull()
            if (status !in listOf("scheduled", "cancelled")) continue
            val startsAt = obj["starts_at"]?.jsonPrimitive?.contentOrNull() ?: continue
            val endsAt = obj["ends_at"]?.jsonPrimitive?.contentOrNull()
            items += CalendarTimelineItem(
                id = "session:$id",
                kind = "class_schedule",
                title = obj["title"]?.jsonPrimitive?.contentOrNull() ?: "Session",
                startKey = toDeviceDateKey(startsAt),
                endKey = endsAt?.let { toDeviceDateKey(it) } ?: toDeviceDateKey(startsAt),
                startsAtIso = startsAt,
                endsAtIso = endsAt,
                location = obj["location"]?.jsonPrimitive?.contentOrNull(),
                owner = "official",
                status = if (status == "cancelled") "cancelled" else "published",
                classId = classId,
                className = classLookup[classId]?.name,
                sourceId = id,
            )
        }
    }

    var storageReady = true
    val officialRows = if (includeOfficial && classIds.isNotEmpty()) {
        runCatching {
            db.from("class_calendar_events").select {
                filter {
                    isIn("class_id", classIds)
                    isIn("status", listOf("published", "cancelled"))
                    gte("ends_at", range.fromIso)
                    lt("starts_at", range.toIso)
                }
                order("starts_at", Order.ASCENDING)
                limit(EVENT_LIMIT.toLong())
            }.decodeJsonArray()
        }
    } else {
        Result.success(emptyList<kotlinx.serialization.json.JsonElement>())
    }
    if (officialRows.isFailure) {
        val error = officialRows.exceptionOrNull()!!
        if (missingTable(error)) storageReady = false else throw error
    }
    for (row in officialRows.getOrNull().orEmpty()) {
        val obj = row.jsonObject
        val eventType = obj["event_type"]?.jsonPrimitive?.contentOrNull() ?: continue
        if (eventType !in OFFICIAL_EVENT_TYPES) continue
        val id = obj["id"]?.jsonPrimitive?.contentOrNull() ?: continue
        val classId = obj["class_id"]?.jsonPrimitive?.contentOrNull() ?: continue
        val startsAt = obj["starts_at"]?.jsonPrimitive?.contentOrNull() ?: continue
        val endsAt = obj["ends_at"]?.jsonPrimitive?.contentOrNull()
        val subjectId = obj["subject_id"]?.jsonPrimitive?.contentOrNull()
        items += CalendarTimelineItem(
            id = "official:$id",
            kind = eventType,
            title = obj["title"]?.jsonPrimitive?.contentOrNull() ?: "Event",
            startKey = toDeviceDateKey(startsAt),
            endKey = endsAt?.let { toDeviceDateKey(it) } ?: toDeviceDateKey(startsAt),
            startsAtIso = startsAt,
            endsAtIso = endsAt,
            description = obj["description"]?.jsonPrimitive?.contentOrNull(),
            location = obj["location"]?.jsonPrimitive?.contentOrNull(),
            owner = "official",
            status = if (obj["status"]?.jsonPrimitive?.contentOrNull() == "cancelled") "cancelled" else "published",
            classId = classId,
            className = classLookup[classId]?.name,
            subjectId = subjectId,
            subjectName = subjectId?.let { subjectById[it]?.first },
            editable = classLookup[classId]?.isAdmin == true,
            sourceId = id,
        )
    }

    val personalRows = if (includePersonal) {
        runCatching {
            db.from("personal_calendar_events").select {
                filter {
                    eq("user_id", userId)
                    isIn("status", listOf("published", "cancelled"))
                    gte("ends_at", range.fromIso)
                    lt("starts_at", range.toIso)
                }
                order("starts_at", Order.ASCENDING)
                limit(EVENT_LIMIT.toLong())
            }.decodeJsonArray()
        }
    } else {
        Result.success(emptyList<kotlinx.serialization.json.JsonElement>())
    }
    if (personalRows.isFailure) {
        val error = personalRows.exceptionOrNull()!!
        if (missingTable(error)) storageReady = false else throw error
    }
    for (row in personalRows.getOrNull().orEmpty()) {
        val obj = row.jsonObject
        val id = obj["id"]?.jsonPrimitive?.contentOrNull() ?: continue
        val startsAt = obj["starts_at"]?.jsonPrimitive?.contentOrNull() ?: continue
        val endsAt = obj["ends_at"]?.jsonPrimitive?.contentOrNull()
        items += CalendarTimelineItem(
            id = "personal:$id",
            kind = "personal",
            title = obj["title"]?.jsonPrimitive?.contentOrNull() ?: "Personal event",
            startKey = toDeviceDateKey(startsAt),
            endKey = endsAt?.let { toDeviceDateKey(it) } ?: toDeviceDateKey(startsAt),
            startsAtIso = startsAt,
            endsAtIso = endsAt,
            description = obj["description"]?.jsonPrimitive?.contentOrNull(),
            location = obj["location"]?.jsonPrimitive?.contentOrNull(),
            owner = "personal",
            status = if (obj["status"]?.jsonPrimitive?.contentOrNull() == "cancelled") "cancelled" else "published",
            editable = true,
            sourceId = id,
        )
    }

    if (includeAbsence) {
        val absenceRows = db.from("leave_requests").select {
            filter {
                eq("student_id", userId)
                isIn("status", listOf("submitted", "approved", "forwarded", "cancelled"))
                isIn("class_id", classIds)
            }
            order("leave_start_date", Order.DESCENDING)
            limit(EVENT_LIMIT.toLong())
        }.decodeJsonArray()
        for (row in absenceRows) {
            val obj = row.jsonObject
            val id = obj["id"]?.jsonPrimitive?.contentOrNull() ?: continue
            val startDate = obj["leave_start_date"]?.jsonPrimitive?.contentOrNull() ?: continue
            val endDate = obj["leave_end_date"]?.jsonPrimitive?.contentOrNull()
            if (!dateSpanOverlapsWindow(startDate, endDate, range.startKey, range.endKey)) continue
            val classId = obj["class_id"]?.jsonPrimitive?.contentOrNull() ?: continue
            val reason = obj["reason_category"]?.jsonPrimitive?.contentOrNull()?.let { LEAVE_REASON_LABELS[it] }
            val spanEnd = endDate ?: startDate
            items += CalendarTimelineItem(
                id = "absence:$id",
                kind = "absence",
                title = reason?.let { "Absence · $it" } ?: "Absence",
                startKey = startDate,
                endKey = spanEnd,
                startsAtIso = dayBoundaryIso(startDate),
                endsAtIso = dayBoundaryIso(spanEnd, inclusiveEndOfDay = true),
                description = obj["reference"]?.jsonPrimitive?.contentOrNull(),
                owner = "absence",
                status = if (obj["status"]?.jsonPrimitive?.contentOrNull() == "cancelled") "cancelled" else "published",
                classId = classId,
                className = classLookup[classId]?.name,
                sourceId = id,
            )
        }
    }

    if (matchesType(typeFilter, "class_schedule") && classIds.isNotEmpty()) {
        val timetableRows = db.from("class_course_schedules").select {
            filter { isIn("class_id", classIds) }
            limit(EVENT_LIMIT.toLong())
        }.decodeJsonArray()
        class Slot(val classId: String, val subjectId: String?, override val dayOfWeek: Int, override val startTime: String, override val endTime: String, val room: String?) : WeeklySlotEntry(dayOfWeek, startTime, endTime)
        val slots = timetableRows.mapNotNull { row ->
            val obj = row.jsonObject
            val classId = obj["class_id"]?.jsonPrimitive?.contentOrNull() ?: return@mapNotNull null
            val start = obj["start_time"]?.jsonPrimitive?.contentOrNull() ?: return@mapNotNull null
            val end = obj["end_time"]?.jsonPrimitive?.contentOrNull() ?: return@mapNotNull null
            val dow = obj["day_of_week"]?.jsonPrimitive?.contentOrNull()?.toIntOrNull() ?: return@mapNotNull null
            Slot(classId, obj["subject_id"]?.jsonPrimitive?.contentOrNull(), dow, start, end, obj["room"]?.jsonPrimitive?.contentOrNull())
        }
        val occurrences = expandWeeklyScheduleForDays(slots, range.days.map { it.dateKey })
        for (occ in occurrences) {
            val slot = occ.entry
            val subject = slot.subjectId?.let { subjectById[it] }
            items += CalendarTimelineItem(
                id = "timetable:${slot.classId}:${slot.subjectId}:${occ.dateKey}",
                kind = "class_schedule",
                title = subject?.first ?: "Class",
                startKey = occ.dateKey,
                endKey = occ.dateKey,
                startsAtIso = occ.startsAt,
                endsAtIso = occ.endsAt,
                location = slot.room,
                owner = "official",
                classId = slot.classId,
                className = classLookup[slot.classId]?.name,
                subjectName = subject?.first,
                managedInClass = classLookup[slot.classId]?.isAdmin == true,
                sourceId = slot.classId,
            )
        }
    }

    val visible = if (showHistory) items else items.filter { item ->
        if (item.kind == "assignment") item.isCompleted || item.endKey >= today
        else item.endKey >= today
    }
    return CalendarLoaded(
        items = visible.sortedWith(compareBy<CalendarTimelineItem> { it.startsAtIso }.thenBy { it.title }),
        assignments = displayAssignments,
        upcoming = displayAssignments.take(8),
        scope = scope,
        storageReady = storageReady,
        todayKey = today,
    )
}

/**
 * Pushes one discussion session into the caller's Google Calendar via the web
 * API (`POST /api/sessions/{id}/calendar-sync`, bearer auth). Server-side it
 * validates the session is viewable by the caller, refreshes the stored
 * access token if needed, inserts/updates the event and records the mapping.
 * Native never sees refresh/access tokens.
 */
sealed class CalendarSyncResult {
    data class Synced(val eventId: String?) : CalendarSyncResult()
    data object Removed : CalendarSyncResult()
    data class Failed(val message: String) : CalendarSyncResult()
}

suspend fun syncSessionToGoogleCalendar(sessionId: String): CalendarSyncResult {
    val token = runCatching { SupabaseProvider.client.auth.currentSessionOrNull()?.accessToken }.getOrNull()
        ?: return CalendarSyncResult.Failed("Sign in to sync.")
    val baseUrl = BuildConfig.SITE_URL.trimEnd('/')
    if (baseUrl.isBlank() || baseUrl.contains("localhost") || baseUrl.contains("your-site-url")) {
        return CalendarSyncResult.Failed("Site URL not configured — set starstask.site.url in local.properties.")
    }
    val url = java.net.URL("$baseUrl/api/sessions/$sessionId/calendar-sync")
    val conn = (url.openConnection() as java.net.HttpURLConnection).apply {
        connectTimeout = 15_000
        readTimeout = 60_000
        requestMethod = "POST"
        setRequestProperty("Authorization", "Bearer $token")
        setRequestProperty("Accept", "application/json")
        doOutput = true
        outputStream.close()
    }
    val status = try {
        conn.responseCode
    } catch (_: java.io.IOException) {
        conn.disconnect()
        return CalendarSyncResult.Failed("Calendar is not reachable. Try again shortly.")
    }
    return try {
        if (status == java.net.HttpURLConnection.HTTP_OK) {
            val body = conn.inputStream.bufferedReader().use { it.readText() }
            val eventId = runCatching { kotlinx.serialization.json.Json.parseToJsonElement(body).jsonObject["eventId"]?.jsonPrimitive?.content }.getOrNull()
            CalendarSyncResult.Synced(eventId)
        } else {
            val body = runCatching { conn.errorStream?.bufferedReader()?.use { it.readText() } }.getOrNull().orEmpty()
            val message = when {
                "not_connected" in body || "calendar_not_connected" in body -> "Connect Google Calendar first in Settings."
                "reconnect" in body || "revoked" in body -> "Google Calendar access was revoked — reconnect in Settings."
                else -> "Google Calendar sync failed. Try again."
            }
            CalendarSyncResult.Failed(message)
        }
    } finally {
        conn.disconnect()
    }
}
