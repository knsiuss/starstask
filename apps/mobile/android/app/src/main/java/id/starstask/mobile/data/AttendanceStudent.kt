package id.starstask.mobile.data

import io.github.jan.supabase.postgrest.postgrest
import io.github.jan.supabase.postgrest.query.Order
import io.github.jan.supabase.postgrest.query.filter.FilterOperator
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put

// ---------------------------------------------------------------------------
// Student attendance mirroring apps/web/src/lib/db/attendance.ts
// (getStudentAttendance) + attendance-meetings.ts (meeting view + legacy
// check-in view).
//
// Web policy (packages/shared/src/attendance.ts summarizeAttendance):
// - denominator: present + late + absent + unrecorded
// - excused/sick and pending sessions excluded
// - attended = present + late
// - percentage = round(attended / eligible * 1000) / 10, null when 0 eligible
//
// Kept in its own file (not Attendance.kt, which owns the legacy
// loadAttendanceHistory/recap used by cover screens) to avoid collisions.
// ---------------------------------------------------------------------------

private const val MAX_SESSIONS = 1_000L

private const val STUDENT_MEETING_LIMIT = 20

private const val SESSION_CHECKIN_LEAD_MS = 15 * 60 * 1_000L
private const val ATTENDANCE_UPCOMING_WINDOW_MS = 14 * 24 * 60 * 60 * 1_000L

// ---------------------------------------------------------------------------
// Counts (exact port of packages/shared/src/attendance.ts)
// ---------------------------------------------------------------------------

data class AttendanceCounts(
    val present: Int = 0,
    val late: Int = 0,
    val excused: Int = 0,
    val sick: Int = 0,
    val absent: Int = 0,
    val unrecorded: Int = 0,
    val pending: Int = 0,
    val eligible: Int = 0,
    val attended: Int = 0,
    val percentage: Double? = null,
)

fun summarizeAttendance(outcomes: List<String>): AttendanceCounts {
    var present = 0
    var late = 0
    var excused = 0
    var sick = 0
    var absent = 0
    var unrecorded = 0
    var pending = 0
    for (outcome in outcomes) {
        when (outcome) {
            "present" -> present++
            "late" -> late++
            "excused" -> excused++
            "sick" -> sick++
            "absent" -> absent++
            "unrecorded" -> unrecorded++
            "pending" -> pending++
        }
    }
    val attended = present + late
    val eligible = attended + absent + unrecorded
    return AttendanceCounts(
        present, late, excused, sick, absent, unrecorded, pending,
        eligible, attended,
        if (eligible == 0) null else Math.round(attended * 1000.0 / eligible) / 10.0,
    )
}

fun formatAttendancePercentage(percentage: Double?): String {
    if (percentage == null) return "—"
    return if (percentage % 1.0 == 0.0) "${percentage.toInt()}%"
    else "${percentage.toString().trimEnd('0').trimEnd('.')}%"
}

// Course status bands (exact port of lib/attendance/course-rows.ts).
enum class CourseAttendanceStatus { Excellent, Good, Fair, AtRisk, NoSessions }

fun courseAttendanceStatus(counts: AttendanceCounts): CourseAttendanceStatus {
    val p = counts.percentage ?: return CourseAttendanceStatus.NoSessions
    if (counts.eligible == 0) return CourseAttendanceStatus.NoSessions
    return when {
        p >= 90 -> CourseAttendanceStatus.Excellent
        p >= 75 -> CourseAttendanceStatus.Good
        p >= 60 -> CourseAttendanceStatus.Fair
        else -> CourseAttendanceStatus.AtRisk
    }
}

fun courseAttendanceStatusLabel(status: CourseAttendanceStatus): String = when (status) {
    CourseAttendanceStatus.Excellent -> "Excellent"
    CourseAttendanceStatus.Good -> "Good"
    CourseAttendanceStatus.Fair -> "Fair"
    CourseAttendanceStatus.AtRisk -> "At risk"
    CourseAttendanceStatus.NoSessions -> "No sessions"
}

// ---------------------------------------------------------------------------
// Entries / options
// ---------------------------------------------------------------------------

data class AttendanceEntry(
    val sessionId: String,
    val classId: String,
    val classSlug: String,
    val className: String,
    val subjectId: String?,
    val subjectName: String?,
    val title: String,
    val sessionType: String,
    val location: String?,
    val startsAt: String,
    val endsAt: String,
    val timeZone: String,
    val academicYear: String,
    val semester: String,
    val status: String,
    val checkedInAt: String?,
    val method: String?,
    val note: String?,
    val reviewedAt: String?,
    val recordedByName: String?,
)

data class AttendanceSubjectOption(
    val id: String,
    val name: String,
    val code: String?,
    val classId: String,
    val className: String,
)

data class AttendanceClassOption(
    val id: String,
    val name: String,
    val slug: String,
    val semester: String,
    val academicYear: String,
    val status: String,
)

data class ManagedAttendanceClass(val id: String, val slug: String, val name: String)

data class StudentAttendanceView(
    val summary: AttendanceCounts,
    val entries: List<AttendanceEntry>,
    val bySubject: Map<String, AttendanceCounts>,
    val byClass: Map<String, AttendanceCounts>,
    val subjects: List<AttendanceSubjectOption>,
    val classes: List<AttendanceClassOption>,
    val semesters: List<String>,
    val academicYears: List<String>,
    val ManagedAttendanceClasses: List<ManagedAttendanceClass>,
    val hasClasses: Boolean,
)

private data class Membership(
    val id: String,
    val slug: String,
    val name: String,
    val semester: String,
    val academicYear: String,
    val status: String,
    val joinedAt: String,
)

private suspend fun loadMyMemberships(userId: String): List<Membership> {
    val db = SupabaseProvider.client.postgrest
    val membershipRows = db.from("class_members").select {
        filter { eq("user_id", userId) }
    }.decodeJsonArray()
    if (membershipRows.isEmpty()) return emptyList()
    val joinedAtByClass = membershipRows.associateBy(
        { it.jsonObject["class_id"]!!.jsonPrimitive.content },
        { it.jsonObject["joined_at"]?.jsonPrimitive?.contentOrNull() ?: "" },
    )
    val classRows = db.from("classes").select {
        filter { isIn("id", joinedAtByClass.keys.toList()) }
    }.decodeJsonArray()
    return classRows.mapNotNull { row ->
        val obj = row.jsonObject
        val id = obj["id"]?.jsonPrimitive?.content ?: return@mapNotNull null
        Membership(
            id = id,
            slug = obj["slug"]?.jsonPrimitive?.contentOrNull() ?: "",
            name = obj["name"]?.jsonPrimitive?.contentOrNull() ?: "Class",
            semester = obj["semester"]?.jsonPrimitive?.contentOrNull() ?: "",
            academicYear = obj["academic_year"]?.jsonPrimitive?.contentOrNull() ?: "",
            status = obj["status"]?.jsonPrimitive?.contentOrNull() ?: "active",
            joinedAt = joinedAtByClass[id] ?: "",
        )
    }
}

private suspend fun loadManagedClasses(
    userId: String,
    memberships: List<Membership>,
): List<ManagedAttendanceClass> {
    if (memberships.isEmpty()) return emptyList()
    val db = SupabaseProvider.client.postgrest
    val adminRows = db.from("class_admins").select {
        filter {
            eq("user_id", userId)
            isIn("class_id", memberships.map { it.id })
        }
    }.decodeJsonArray()
    val adminIds = adminRows.mapNotNull {
        it.jsonObject["class_id"]?.jsonPrimitive?.content
    }.toSet()
    return memberships
        .filter { it.id in adminIds && it.status == "active" }
        .map { ManagedAttendanceClass(it.id, it.slug, it.name) }
}

private fun isFinished(status: String, endsAt: String, nowMs: Long): Boolean {
    if (status == "completed") return true
    val end = runCatching { java.time.OffsetDateTime.parse(endsAt).toInstant().toEpochMilli() }.getOrNull()
    return end != null && end <= nowMs
}

private fun resolveStatus(
    sessionStatus: String,
    endsAt: String,
    checkInStatus: String?,
    nowMs: Long,
): String =
    checkInStatus ?: if (isFinished(sessionStatus, endsAt, nowMs)) "unrecorded" else "pending"

private fun groupCounts(
    entries: List<AttendanceEntry>,
    keyOf: (AttendanceEntry) -> String?,
): Map<String, AttendanceCounts> =
    entries.groupBy { keyOf(it) ?: "none" }.mapValues { (_, group) ->
        summarizeAttendance(group.map { it.status })
    }

/**
 * Student attendance scoped server-side to the caller's classes, exactly like
 * web getStudentAttendance. Sessions before the student joined are excluded.
 */
suspend fun loadStudentAttendance(
    userId: String,
    subjectFilter: String? = null,
): StudentAttendanceView {
    val db = SupabaseProvider.client.postgrest
    val nowMs = System.currentTimeMillis()
    val nowIso = java.time.Instant.now().toString()
    val memberships = loadMyMemberships(userId)
    val membershipById = memberships.associateBy { it.id }
    val classOptions = memberships.map {
        AttendanceClassOption(it.id, it.name, it.slug, it.semester, it.academicYear, it.status)
    }
    val semesters = memberships.map { it.semester }.filter { it.isNotBlank() }.distinct().sorted()
    val academicYears = memberships.map { it.academicYear }.filter { it.isNotBlank() }.distinct().sortedDescending()
    val managed = loadManagedClasses(userId, memberships)

    if (memberships.isEmpty()) {
        return StudentAttendanceView(
            summary = summarizeAttendance(emptyList()),
            entries = emptyList(),
            bySubject = emptyMap(),
            byClass = emptyMap(),
            subjects = emptyList(),
            classes = classOptions,
            semesters = semesters,
            academicYears = academicYears,
            ManagedAttendanceClasses = managed,
            hasClasses = false,
        )
    }

    val classIds = memberships.map { it.id }
    val subjectRows = db.from("class_subjects").select {
        filter { isIn("class_id", classIds) }
        order("name", Order.ASCENDING)
        limit(1_000)
    }.decodeJsonArray()
    val subjects = subjectRows.mapNotNull { row ->
        val obj = row.jsonObject
        val id = obj["id"]?.jsonPrimitive?.content ?: return@mapNotNull null
        val classId = obj["class_id"]?.jsonPrimitive?.content ?: return@mapNotNull null
        AttendanceSubjectOption(
            id = id,
            name = obj["name"]?.jsonPrimitive?.contentOrNull() ?: "Course",
            code = obj["code"]?.jsonPrimitive?.contentOrNull(),
            classId = classId,
            className = membershipById[classId]?.name ?: "Unknown class",
        )
    }
    val subjectById = subjects.associateBy { it.id }

    val sessionRows = db.from("discussion_sessions").select {
        filter {
            isIn("class_id", classIds)
            neq("status", "cancelled")
            lte("starts_at", nowIso)
        }
        order("starts_at", Order.DESCENDING)
        limit(MAX_SESSIONS)
    }.decodeJsonArray()

    if (sessionRows.isEmpty()) {
        return StudentAttendanceView(
            summary = summarizeAttendance(emptyList()),
            entries = emptyList(),
            bySubject = emptyMap(),
            byClass = emptyMap(),
            subjects = subjects,
            classes = classOptions,
            semesters = semesters,
            academicYears = academicYears,
            ManagedAttendanceClasses = managed,
            hasClasses = true,
        )
    }

    val sessionIds = sessionRows.mapNotNull {
        it.jsonObject["id"]?.jsonPrimitive?.content
    }.toSet()
    val checkInRows = if (sessionIds.isEmpty()) {
        emptyList()
    } else {
        db.from("discussion_session_checkins").select {
            filter {
                eq("user_id", userId)
                isIn("session_id", sessionIds.toList())
            }
            limit(MAX_SESSIONS)
        }.decodeJsonArray()
    }
    val checkInBySession = checkInRows.associateBy(
        { it.jsonObject["session_id"]!!.jsonPrimitive.content },
        { it.jsonObject },
    )

    val assignmentIds = sessionRows.mapNotNull {
        it.jsonObject["assignment_id"]?.jsonPrimitive?.contentOrNull()
    }.toSet()
    val subjectIdByAssignment = if (assignmentIds.isEmpty()) {
        emptyMap<String, String>()
    } else {
        db.from("assignments").select {
            filter { isIn("id", assignmentIds.toList()) }
            limit(MAX_SESSIONS)
        }.decodeJsonArray().mapNotNull { row ->
            val obj = row.jsonObject
            val id = obj["id"]?.jsonPrimitive?.content ?: return@mapNotNull null
            val subj = obj["subject_id"]?.jsonPrimitive?.contentOrNull()
            if (subj != null) id to subj else null
        }.toMap()
    }

    val reviewerIds = checkInRows.mapNotNull {
        it.jsonObject["reviewed_by"]?.jsonPrimitive?.contentOrNull()
    }.distinct()
    val reviewerNames = if (reviewerIds.isEmpty()) {
        emptyMap<String, String?>()
    } else {
        db.from("profiles").select {
            filter { isIn("id", reviewerIds) }
        }.decodeJsonArray().associateBy(
            { it.jsonObject["id"]!!.jsonPrimitive.content },
            { it.jsonObject["display_name"]?.jsonPrimitive?.contentOrNull() },
        )
    }

    val entries = sessionRows.mapNotNull { row ->
        val obj = row.jsonObject
        val membership = obj["class_id"]?.jsonPrimitive?.content?.let(membershipById::get)
            ?: return@mapNotNull null
        val startsAt = obj["starts_at"]?.jsonPrimitive?.content ?: return@mapNotNull null
        if (membership.joinedAt.isNotBlank()) {
            val joined = runCatching {
                java.time.OffsetDateTime.parse(membership.joinedAt).toInstant().toEpochMilli()
            }.getOrNull()
            val startMs = runCatching {
                java.time.OffsetDateTime.parse(startsAt).toInstant().toEpochMilli()
            }.getOrNull()
            if (joined != null && startMs != null && startMs < joined) {
                return@mapNotNull null
            }
        }
        val sessionId = obj["id"]?.jsonPrimitive?.content ?: return@mapNotNull null
        val checkIn = checkInBySession[sessionId]
        val subjectId = obj["subject_id"]?.jsonPrimitive?.contentOrNull()
            ?: obj["assignment_id"]?.jsonPrimitive?.contentOrNull()
                ?.let(subjectIdByAssignment::get)
        AttendanceEntry(
            sessionId = sessionId,
            classId = membership.id,
            classSlug = membership.slug,
            className = membership.name,
            subjectId = subjectId,
            subjectName = subjectId?.let { subjectById[it]?.name },
            title = obj["title"]?.jsonPrimitive?.contentOrNull() ?: "Session",
            sessionType = obj["session_type"]?.jsonPrimitive?.contentOrNull() ?: "in_person",
            location = obj["location"]?.jsonPrimitive?.contentOrNull(),
            startsAt = startsAt,
            endsAt = obj["ends_at"]?.jsonPrimitive?.contentOrNull() ?: startsAt,
            timeZone = obj["time_zone"]?.jsonPrimitive?.contentOrNull() ?: DEVICE_ZONE.id,
            academicYear = membership.academicYear,
            semester = membership.semester,
            status = resolveStatus(
                obj["status"]?.jsonPrimitive?.contentOrNull() ?: "",
                obj["ends_at"]?.jsonPrimitive?.contentOrNull() ?: startsAt,
                checkIn?.get("status")?.jsonPrimitive?.contentOrNull(),
                nowMs,
            ),
            checkedInAt = checkIn?.get("checked_in_at")?.jsonPrimitive?.contentOrNull(),
            method = checkIn?.get("method")?.jsonPrimitive?.contentOrNull(),
            note = checkIn?.get("note")?.jsonPrimitive?.contentOrNull(),
            reviewedAt = checkIn?.get("reviewed_at")?.jsonPrimitive?.contentOrNull(),
            recordedByName = checkIn?.get("reviewed_by")?.jsonPrimitive?.contentOrNull()
                ?.let(reviewerNames::get),
        )
    }

    val scoped = if (subjectFilter == null) {
        entries
    } else {
        entries.filter { it.subjectId == subjectFilter }
    }

    return StudentAttendanceView(
        summary = summarizeAttendance(scoped.map { it.status }),
        entries = scoped,
        bySubject = groupCounts(scoped) { it.subjectId ?: "${it.classId}:none" },
        byClass = groupCounts(scoped) { it.classId },
        subjects = subjects,
        classes = classOptions,
        semesters = semesters,
        academicYears = academicYears,
        ManagedAttendanceClasses = managed,
        hasClasses = true,
    )
}

// Course rows (exact port of lib/attendance/course-rows.ts buildCourseRows).
data class CourseAttendanceRow(
    val key: String,
    val subjectId: String?,
    val code: String?,
    val name: String,
    val className: String,
    val counts: AttendanceCounts,
    val status: CourseAttendanceStatus,
)

private val emptyCounts = summarizeAttendance(emptyList())

fun buildCourseRows(view: StudentAttendanceView): List<CourseAttendanceRow> {
    if (view.subjects.isNotEmpty()) {
        return view.subjects.map { subject ->
            val counts = view.bySubject[subject.id] ?: emptyCounts
            CourseAttendanceRow(
                key = subject.id,
                subjectId = subject.id,
                code = subject.code,
                name = subject.name,
                className = subject.className,
                counts = counts,
                status = courseAttendanceStatus(counts),
            )
        }.sortedWith(compareBy({ it.code ?: it.name }, { it.name }))
    }
    return view.byClass.entries.map { (classId, counts) ->
        val className = view.classes.find { it.id == classId }?.name ?: "Class"
        CourseAttendanceRow(
            key = classId,
            subjectId = null,
            code = null,
            name = className,
            className = className,
            counts = counts,
            status = courseAttendanceStatus(counts),
        )
    }.sortedBy { it.name }
}

// Period badge (exact port of attendance/page.tsx periodLabel).
fun attendancePeriodLabel(view: StudentAttendanceView): String? {
    if (view.semesters.size != 1) return null
    val semester = view.semesters.first()
    return if (view.academicYears.size == 1) {
        "Semester $semester · ${view.academicYears.first()}"
    } else {
        "Semester $semester"
    }
}

// ---------------------------------------------------------------------------
// Active attendance (meetings + legacy sessions merged)
// ---------------------------------------------------------------------------

data class ActiveMeeting(
    val sessionId: String,
    val subjectName: String,
    val meetingNumber: Int?,
    val className: String,
    val startsAt: String,
    val endsAt: String,
    val closesAt: String?,
    val location: String?,
    val timeZone: String?,
    val radiusM: Int,
    val phase: String, // open | scheduled
    val isMeeting: Boolean,
    val checkInStatus: String?,
    val checkedInAt: String?,
    val distanceM: Double?,
)

data class AttendanceIdentity(val fullName: String?, val nim: String?)

private fun parseInstantMs(iso: String?): Long? {
    if (iso == null) return null
    return runCatching {
        java.time.OffsetDateTime.parse(iso).toInstant().toEpochMilli()
    }.getOrNull()
}

private fun meetingPhase(
    openedAt: String?, closedAt: String?, finalizedAt: String?,
    closesAt: String?, endsAt: String?, nowMs: Long,
): String {
    if (finalizedAt != null) return "finalized"
    if (closedAt != null) return "closed"
    if (openedAt == null) return "scheduled"
    val closes = parseInstantMs(closesAt ?: endsAt)
    if (closes != null && nowMs > closes) return "closed"
    return "open"
}

private fun legacyWindowState(startsAt: String, endsAt: String, nowMs: Long): String {
    val start = parseInstantMs(startsAt) ?: return "closed"
    val end = parseInstantMs(endsAt) ?: return "closed"
    if (nowMs < start - SESSION_CHECKIN_LEAD_MS) return "before"
    return if (nowMs > end) "closed" else "open"
}

private suspend fun loadCheckInSettings(
    db: io.github.jan.supabase.postgrest.Postgrest,
    sessionIds: List<String>,
): Map<String, Pair<Int, Boolean>> {
    if (sessionIds.isEmpty()) return emptyMap()
    return runCatching {
        db.rpc(
            "session_checkin_summary_many",
            buildJsonObject {
                put("p_session_ids", JsonArray(sessionIds.map { JsonPrimitive(it) }))
            },
        ).decodeJsonArray().mapNotNull { row ->
            val obj = row.jsonObject
            val id = obj["session_id"]?.jsonPrimitive?.content ?: return@mapNotNull null
            val radius = obj["radius_m"]?.jsonPrimitive?.content?.toIntOrNull() ?: 150
            val hasLoc = obj["has_location"]?.jsonPrimitive?.content == "true"
            id to (radius to hasLoc)
        }.toMap()
    }.getOrDefault(emptyMap())
}

/**
 * Open + upcoming meetings and legacy sessions, mirroring web
 * getStudentAttendanceMeetingView + getAttendanceCheckInView.
 */
suspend fun loadActiveAttendance(userId: String): List<ActiveMeeting> {
    val db = SupabaseProvider.client.postgrest
    val nowMs = System.currentTimeMillis()
    val memberships = loadMyMemberships(userId).filter { it.status == "active" }
    if (memberships.isEmpty()) return emptyList()
    val membershipById = memberships.associateBy { it.id }
    val classIds = memberships.map { it.id }

    val dayAgo = java.time.Instant.now()
        .minusSeconds(24 * 60 * 60).toString()

    // --- Meetings ---
    val meetingRows = db.from("discussion_sessions").select {
        filter {
            isIn("class_id", classIds)
            eq("status", "scheduled")
            filterNot("meeting_number", FilterOperator.IS, null)
            gte("ends_at", dayAgo)
        }
        order("starts_at", Order.ASCENDING)
        limit(100)
    }.decodeJsonArray()

    val meetingMap = meetingRows.mapNotNull { row ->
        val obj = row.jsonObject
        val membership = obj["class_id"]?.jsonPrimitive?.content?.let(membershipById::get)
            ?: return@mapNotNull null
        val startsAt = obj["starts_at"]?.jsonPrimitive?.content ?: return@mapNotNull null
        val joinedMs = parseInstantMs(membership.joinedAt)
        val startMs = parseInstantMs(startsAt)
        if (joinedMs != null && startMs != null && startMs < joinedMs) return@mapNotNull null
        val phase = meetingPhase(
            obj["attendance_opened_at"]?.jsonPrimitive?.contentOrNull(),
            obj["attendance_closed_at"]?.jsonPrimitive?.contentOrNull(),
            obj["attendance_finalized_at"]?.jsonPrimitive?.contentOrNull(),
            obj["attendance_closes_at"]?.jsonPrimitive?.contentOrNull(),
            obj["ends_at"]?.jsonPrimitive?.contentOrNull(),
            nowMs,
        )
        val visible = phase == "open" ||
            (phase == "scheduled" && startMs != null &&
                startMs >= nowMs && startMs <= nowMs + ATTENDANCE_UPCOMING_WINDOW_MS)
        if (!visible) return@mapNotNull null
        val id = obj["id"]?.jsonPrimitive?.content ?: return@mapNotNull null
        Triple(
            id to obj,
            membership,
            phase,
        )
    }

    // --- Legacy sessions (in_person, no meeting number) ---
    val leadEnd = java.time.Instant.now()
        .plusSeconds(SESSION_CHECKIN_LEAD_MS / 1000).toString()
    val legacyRows = db.from("discussion_sessions").select {
        filter {
            isIn("class_id", classIds)
            eq("status", "scheduled")
            eq("session_type", "in_person")
            filter("meeting_number", FilterOperator.IS, null)
            gte("ends_at", java.time.Instant.now().toString())
            lte("starts_at", leadEnd)
        }
        order("starts_at", Order.ASCENDING)
        limit(50)
    }.decodeJsonArray()

    val ordered: List<String> = (meetingMap.map { it.first.first } + legacyRows.mapNotNull {
        it.jsonObject["id"]?.jsonPrimitive?.content
    }).distinct()

    if (ordered.isEmpty()) return emptyList()

    val settings = loadCheckInSettings(db, ordered)
    val subjectIds = (meetingRows + legacyRows).mapNotNull {
        it.jsonObject["subject_id"]?.jsonPrimitive?.contentOrNull()
    }.distinct()
    val subjectById = if (subjectIds.isEmpty()) {
        emptyMap<String, String>()
    } else {
        db.from("class_subjects").select {
            filter { isIn("id", subjectIds) }
            limit(1000)
        }.decodeJsonArray().associateBy(
            { it.jsonObject["id"]!!.jsonPrimitive.content },
            { it.jsonObject["name"]?.jsonPrimitive?.contentOrNull() ?: "Course" },
        )
    }
    val checkInRows = db.from("discussion_session_checkins").select {
        filter {
            eq("user_id", userId)
            isIn("session_id", ordered)
        }
        limit(1000)
    }.decodeJsonArray()
    val checkInBySession = checkInRows.associateBy(
        { it.jsonObject["session_id"]!!.jsonPrimitive.content },
        { it.jsonObject },
    )

    val result = mutableListOf<ActiveMeeting>()
    // Meetings first (sorted by start), then legacy.
    val meetingsSorted = meetingMap.sortedBy {
        parseInstantMs(it.first.second["starts_at"]?.jsonPrimitive?.content) ?: Long.MAX_VALUE
    }.take(STUDENT_MEETING_LIMIT)
    for ((pair, membership, phase) in meetingsSorted) {
        val (id, obj) = pair
        val checkIn = checkInBySession[id]
        result += ActiveMeeting(
            sessionId = id,
            subjectName = obj["subject_id"]?.jsonPrimitive?.contentOrNull()
                ?.let { subjectById[it] } ?: "Course",
            meetingNumber = obj["meeting_number"]?.jsonPrimitive?.content?.toIntOrNull(),
            className = membership.name,
            startsAt = obj["starts_at"]?.jsonPrimitive?.content ?: "",
            endsAt = obj["ends_at"]?.jsonPrimitive?.content ?: "",
            closesAt = obj["attendance_closes_at"]?.jsonPrimitive?.contentOrNull(),
            location = obj["location"]?.jsonPrimitive?.contentOrNull(),
            timeZone = obj["time_zone"]?.jsonPrimitive?.contentOrNull(),
            radiusM = settings[id]?.first ?: 150,
            phase = phase,
            isMeeting = true,
            checkInStatus = checkIn?.get("status")?.jsonPrimitive?.contentOrNull(),
            checkedInAt = checkIn?.get("checked_in_at")?.jsonPrimitive?.contentOrNull(),
            distanceM = checkIn?.get("distance_m")?.jsonPrimitive?.content?.toDoubleOrNull(),
        )
    }
    for (row in legacyRows) {
        val obj = row.jsonObject
        val id = obj["id"]?.jsonPrimitive?.content ?: continue
        val membership = obj["class_id"]?.jsonPrimitive?.content?.let(membershipById::get) ?: continue
        val startsAt = obj["starts_at"]?.jsonPrimitive?.content ?: continue
        val joinedMs = parseInstantMs(membership.joinedAt)
        val startMs = parseInstantMs(startsAt)
        if (joinedMs != null && startMs != null && startMs < joinedMs) continue
        val hasLoc = settings[id]?.second ?: false
        if (!hasLoc) continue
        val checkIn = checkInBySession[id]
        result += ActiveMeeting(
            sessionId = id,
            subjectName = obj["subject_id"]?.jsonPrimitive?.contentOrNull()
                ?.let { subjectById[it] }
                ?: obj["title"]?.jsonPrimitive?.contentOrNull()
                ?: "Session",
            meetingNumber = null,
            className = membership.name,
            startsAt = startsAt,
            endsAt = obj["ends_at"]?.jsonPrimitive?.content ?: startsAt,
            closesAt = null,
            location = obj["location"]?.jsonPrimitive?.contentOrNull(),
            timeZone = obj["time_zone"]?.jsonPrimitive?.contentOrNull(),
            radiusM = settings[id]?.first ?: 150,
            phase = legacyWindowState(startsAt, obj["ends_at"]?.jsonPrimitive?.content ?: startsAt, nowMs),
            isMeeting = false,
            checkInStatus = checkIn?.get("status")?.jsonPrimitive?.contentOrNull(),
            checkedInAt = checkIn?.get("checked_in_at")?.jsonPrimitive?.contentOrNull(),
            distanceM = checkIn?.get("distance_m")?.jsonPrimitive?.content?.toDoubleOrNull(),
        )
    }
    return result
}

// Legacy discussion sessions use the legacy check-in RPC
// (check_in_discussion_session, web /api/sessions/{id}/checkin); the meeting
// flow (checkInToSession) uses check_in_attendance_meeting with identity.
suspend fun checkInLegacySession(
    sessionId: String,
    latitude: Double,
    longitude: Double,
    accuracyM: Double,
    capturedAtIso: String,
): CheckInResult {
    val db = SupabaseProvider.client.postgrest
    val data = db.rpc(
        "check_in_discussion_session",
        buildJsonObject {
            put("p_session_id", JsonPrimitive(sessionId))
            put("p_latitude", JsonPrimitive(latitude))
            put("p_longitude", JsonPrimitive(longitude))
            put("p_accuracy_m", JsonPrimitive(accuracyM))
            put("p_captured_at", JsonPrimitive(capturedAtIso))
        },
    ).decodeAs<kotlinx.serialization.json.JsonObject>()
    // Legacy RPC returns a check-in row (status/checked_in_at/distance_m), not
    // the meeting ok/message envelope — success means a row came back.
    val status = data?.get("status")?.jsonPrimitive?.content
    val ok = status == "present" || status == "late" || status == "excused" || status == "sick"
    return CheckInResult(
        ok = ok,
        status = status,
        message = data?.get("message")?.jsonPrimitive?.content,
    )
}

suspend fun loadAttendanceIdentity(userId: String): AttendanceIdentity {
    val db = SupabaseProvider.client.postgrest
    val row = db.from("profiles").select {
        filter { eq("id", userId) }
        limit(1)
    }.decodeJsonArray().firstOrNull()?.jsonObject
    return AttendanceIdentity(
        fullName = row?.get("full_name")?.jsonPrimitive?.content?.trim()?.takeIf { it.isNotEmpty() },
        nim = row?.get("nim")?.jsonPrimitive?.content?.trim()?.takeIf { it.isNotEmpty() },
    )
}
