package id.starstask.mobile.data

import io.github.jan.supabase.postgrest.postgrest
import io.github.jan.supabase.postgrest.query.Order
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive

// Native mirror of Web action center (apps/web/src/lib/db/class-actions.ts,
// lib/classes/action-center.ts, lib/db/leave.ts listManagedLeaveRequests,
// lib/db/attendance-meetings.ts listClassAttendanceMeetings).

data class ActionCenterCounts(
    val pendingSubmissions: Int,
    val pendingLeave: Int,
    val todaysSessions: Int,
    val openReports: Int,
)

data class ActionCenterRow(
    val classId: String,
    val classSlug: String,
    val className: String,
    val semester: String,
    val academicYear: String,
    val counts: ActionCenterCounts,
) {
    val total: Int
        get() = counts.pendingSubmissions + counts.pendingLeave + counts.todaysSessions + counts.openReports
}

data class ActionCenterTotals(
    val pendingSubmissions: Int,
    val pendingLeave: Int,
    val todaysSessions: Int,
    val openReports: Int,
    val classes: Int,
    val actions: Int,
)

data class ActionCenter(
    val rows: List<ActionCenterRow>,
    val totals: ActionCenterTotals,
)

fun summarizeActionCenter(rows: List<ActionCenterRow>): ActionCenterTotals {
    val pendingSubmissions = rows.sumOf { it.counts.pendingSubmissions }
    val pendingLeave = rows.sumOf { it.counts.pendingLeave }
    val todaysSessions = rows.sumOf { it.counts.todaysSessions }
    val openReports = rows.sumOf { it.counts.openReports }
    return ActionCenterTotals(
        pendingSubmissions = pendingSubmissions,
        pendingLeave = pendingLeave,
        todaysSessions = todaysSessions,
        openReports = openReports,
        classes = rows.size,
        actions = pendingSubmissions + pendingLeave + todaysSessions + openReports,
    )
}

fun sortActionCenterRows(rows: List<ActionCenterRow>): List<ActionCenterRow> =
    rows.sortedWith(compareByDescending<ActionCenterRow> { it.total }.thenBy { it.className })

fun buildActionSummary(totals: ActionCenterTotals): String {
    if (totals.actions == 0) return "Nothing is waiting on you right now."
    val classLabel = if (totals.classes == 1) "class" else "classes"
    val actionLabel = if (totals.actions == 1) "action" else "actions"
    return "$totals.actions $actionLabel across ${totals.classes} $classLabel."
}

data class ManagedLeaveRequest(
    val id: String,
    val reference: String,
    val studentId: String,
    val studentName: String,
    val classId: String,
    val className: String,
    val subjectNames: List<String>,
    val subjectIds: List<String>,
    val leaveStartDate: String?,
    val leaveEndDate: String?,
    val reasonCategory: String?,
    val status: String,
    val submittedAt: String?,
    val createdAt: String,
    val evidenceCount: Int,
)

data class ActionAttendanceMeeting(
    val sessionId: String,
    val subjectId: String?,
    val subjectName: String,
    val subjectCode: String?,
    val meetingNumber: Int?,
    val startsAt: String,
    val phase: String,
)

data class ActionAttendanceCourse(
    val id: String,
    val name: String,
    val code: String?,
    val lecturerName: String?,
    val meetings: List<ActionAttendanceMeeting>,
)

suspend fun getClassActionCenter(scope: WorkspaceScope): ActionCenter? {
    val managed = scope.classes.filter { it.isAdmin }
    if (managed.isEmpty()) return null
    val classIds = managed.map { it.id }
    val db = SupabaseProvider.client.postgrest
    val now = java.time.Instant.now()
    val zone = java.time.ZoneId.of("Asia/Jakarta")
    val today = now.atZone(zone).toLocalDate()
    val fromIso = today.atStartOfDay(zone).toInstant().toString()
    val toIso = today.plusDays(1).atStartOfDay(zone).toInstant().toString()

    val rows: List<ActionCenterRow> = try {
        val rpc = db.rpc(
            "get_class_action_counts",
            kotlinx.serialization.json.buildJsonObject {
                put("p_class_ids", kotlinx.serialization.json.JsonArray(classIds.map { kotlinx.serialization.json.JsonPrimitive(it) }))
                put("p_from", kotlinx.serialization.json.JsonPrimitive(fromIso))
                put("p_to", kotlinx.serialization.json.JsonPrimitive(toIso))
            },
        ).decodeJsonArray()
        val countsById = rpc.associate {
            val o = it.jsonObject
            val cid = o["class_id"]?.jsonPrimitive?.contentOrNull() ?: ""
            cid to ActionCenterCounts(
                pendingSubmissions = o["pending_submissions"]?.jsonPrimitive?.contentOrNull()?.toIntOrNull() ?: 0,
                pendingLeave = o["pending_leave"]?.jsonPrimitive?.contentOrNull()?.toIntOrNull() ?: 0,
                todaysSessions = o["todays_sessions"]?.jsonPrimitive?.contentOrNull()?.toIntOrNull() ?: 0,
                openReports = o["open_reports"]?.jsonPrimitive?.contentOrNull()?.toIntOrNull() ?: 0,
            )
        }
        managed.map { cls ->
            ActionCenterRow(
                classId = cls.id,
                classSlug = cls.slug,
                className = cls.name,
                semester = cls.semester ?: "",
                academicYear = cls.academicYear ?: "",
                counts = countsById[cls.id] ?: ActionCenterCounts(0, 0, 0, 0),
            )
        }
    } catch (_: Exception) {
        // Legacy fallback: per-class head counts via row fetches (mirrors web).
        managed.map { cls ->
            val cid = cls.id
            val pendingSubmissions = try {
                db.from("assignments").select {
                    filter { eq("class_id", cid); eq("status", "pending_review") }
                }.decodeJsonArray().size
            } catch (_: Exception) { 0 }
            val pendingLeave = try {
                db.from("leave_requests").select {
                    filter { eq("class_id", cid); eq("status", "submitted") }
                }.decodeJsonArray().size
            } catch (_: Exception) { 0 }
            val todaysSessions = try {
                db.from("discussion_sessions").select {
                    filter {
                        eq("class_id", cid)
                        eq("status", "scheduled")
                        gte("starts_at", fromIso)
                        lt("starts_at", toIso)
                    }
                }.decodeJsonArray().size
            } catch (_: Exception) { 0 }
            val openReports = try {
                db.from("assignment_reports").select {
                    filter { eq("class_id", cid); eq("status", "open") }
                }.decodeJsonArray().size
            } catch (_: Exception) { 0 }
            ActionCenterRow(
                classId = cls.id,
                classSlug = cls.slug,
                className = cls.name,
                semester = cls.semester ?: "",
                academicYear = cls.academicYear ?: "",
                counts = ActionCenterCounts(pendingSubmissions, pendingLeave, todaysSessions, openReports),
            )
        }
    }
    val sorted = sortActionCenterRows(rows)
    return ActionCenter(rows = sorted, totals = summarizeActionCenter(sorted))
}

suspend fun countRevisionLeaveRequests(classIds: List<String>): Int {
    if (classIds.isEmpty()) return 0
    return try {
        SupabaseProvider.client.postgrest.from("leave_requests").select {
            filter {
                isIn("class_id", classIds)
                eq("status", "revision_requested")
            }
        }.decodeJsonArray().size
    } catch (_: Exception) { 0 }
}

suspend fun listManagedLeaveRequests(
    scope: WorkspaceScope,
    search: String? = null,
    classId: String? = null,
    courseId: String? = null,
    status: String? = null,
    from: String? = null,
    to: String? = null,
    sort: String = "newest",
    page: Int = 1,
    pageSize: Int = 20,
): List<ManagedLeaveRequest> {
    val classIds = if (classId != null && scope.managedClassIds.contains(classId)) listOf(classId) else scope.managedClassIds
    if (classIds.isEmpty()) return emptyList()
    val db = SupabaseProvider.client.postgrest
    val term = search?.trim()?.lowercase().orEmpty()
    var studentIds: List<String>? = null
    if (term.isNotEmpty()) {
        // Search matches student nickname (mirrors web findStudentIds).
        // PostgREST ilike via DSL is not available here; filter in memory over fetched rows.
    }
    val raw = try {
        db.from("leave_requests").select {
            filter {
                isIn("class_id", classIds)
                neq("status", "draft")
                if (status != null && status != "all") eq("status", status)
                if (from != null) gte("leave_start_date", from)
                if (to != null) lte("leave_end_date", to)
            }
            order("created_at", Order.DESCENDING)
            limit(100L)
        }.decodeJsonArray()
    } catch (_: Exception) {
        return emptyList()
    }
    var rows: List<kotlinx.serialization.json.JsonElement> = raw.toList()
    if (courseId != null) {
        rows = rows.filter { row ->
            val ids = (row.jsonObject["subject_ids"] as? kotlinx.serialization.json.JsonArray)?.mapNotNull { it.jsonPrimitive.contentOrNull() } ?: emptyList()
            ids.contains(courseId)
        }
    }
    val studentIdsAll = rows.mapNotNull { it.jsonObject["student_id"]?.jsonPrimitive?.contentOrNull() }.distinct()
    val profiles = if (studentIdsAll.isEmpty()) emptyMap() else try {
        db.from("profiles").select { filter { isIn("id", studentIdsAll) } }.decodeJsonArray().associate {
            (it.jsonObject["id"]?.jsonPrimitive?.contentOrNull() ?: "") to (it.jsonObject["display_name"]?.jsonPrimitive?.contentOrNull() ?: "Student")
        }
    } catch (_: Exception) { emptyMap() }
    if (term.isNotEmpty()) {
        rows = rows.filter { row ->
            val sid = row.jsonObject["student_id"]?.jsonPrimitive?.contentOrNull()
            val name = profiles[sid]?.lowercase() ?: ""
            val ref = row.jsonObject["reference"]?.jsonPrimitive?.contentOrNull()?.lowercase() ?: ""
            name.contains(term) || ref.contains(term)
        }
    }
    val subjectIdsAll = rows.flatMap { row ->
        (row.jsonObject["subject_ids"] as? kotlinx.serialization.json.JsonArray)?.mapNotNull { it.jsonPrimitive.contentOrNull() } ?: emptyList()
    }.distinct()
    val subjectNames = if (subjectIdsAll.isEmpty()) emptyMap() else try {
        db.from("class_subjects").select { filter { isIn("id", subjectIdsAll) } }.decodeJsonArray().associate {
            (it.jsonObject["id"]?.jsonPrimitive?.contentOrNull() ?: "") to (it.jsonObject["name"]?.jsonPrimitive?.contentOrNull() ?: "")
        }
    } catch (_: Exception) { emptyMap() }
    val requestIds = rows.mapNotNull { it.jsonObject["id"]?.jsonPrimitive?.content }
    val evidenceCounts = if (requestIds.isEmpty()) emptyMap<String, Int>() else try {
        db.from("leave_request_evidence").select {
            filter { isIn("request_id", requestIds) }
        }.decodeJsonArray().groupBy { it.jsonObject["request_id"]?.jsonPrimitive?.contentOrNull() }.mapValues { it.value.size }.filterKeys { it != null } as Map<String, Int>
    } catch (_: Exception) { emptyMap<String, Int>() }
    val classNames = scope.classes.associate { it.id to it.name }
    val items = rows.mapNotNull { row ->
        val o = row.jsonObject
        val id = o["id"]?.jsonPrimitive?.content ?: return@mapNotNull null
        val sid = o["student_id"]?.jsonPrimitive?.contentOrNull()
        val classIdVal = o["class_id"]?.jsonPrimitive?.contentOrNull()
        val subjectIds = (o["subject_ids"] as? kotlinx.serialization.json.JsonArray)?.mapNotNull { it.jsonPrimitive.contentOrNull() } ?: emptyList()
        ManagedLeaveRequest(
            id = id,
            reference = o["reference"]?.jsonPrimitive?.contentOrNull() ?: "",
            studentId = sid ?: "",
            studentName = profiles[sid] ?: "Student",
            classId = classIdVal ?: "",
            className = classNames[classIdVal] ?: "Class",
            subjectNames = subjectIds.mapNotNull { subjectNames[it] },
            subjectIds = subjectIds,
            leaveStartDate = o["leave_start_date"]?.jsonPrimitive?.contentOrNull(),
            leaveEndDate = o["leave_end_date"]?.jsonPrimitive?.contentOrNull(),
            reasonCategory = o["reason_category"]?.jsonPrimitive?.contentOrNull(),
            status = o["status"]?.jsonPrimitive?.contentOrNull() ?: "",
            submittedAt = o["submitted_at"]?.jsonPrimitive?.contentOrNull(),
            createdAt = o["created_at"]?.jsonPrimitive?.contentOrNull() ?: "",
            evidenceCount = evidenceCounts[id] ?: 0,
        )
    }
    val sorted = when (sort) {
        "oldest" -> items.sortedBy { it.createdAt }
        "upcoming" -> items.sortedBy { it.leaveStartDate ?: it.createdAt }
        else -> items.sortedByDescending { it.createdAt }
    }
    val fromIndex = ((page - 1) * pageSize).coerceAtLeast(0)
    return sorted.drop(fromIndex).take(pageSize)
}

suspend fun listClassAttendanceMeetings(classId: String): List<ActionAttendanceMeeting> {
    val db = SupabaseProvider.client.postgrest
    val data = try {
        db.rpc("class_attendance_meeting_list", kotlinx.serialization.json.buildJsonObject {
            put("p_class_id", kotlinx.serialization.json.JsonPrimitive(classId))
        }).decodeJsonArray()
    } catch (_: Exception) {
        return emptyList()
    }
    val nowMs = System.currentTimeMillis()
    return data.mapNotNull { el ->
        val o = el.jsonObject
        val sessionId = o["session_id"]?.jsonPrimitive?.contentOrNull() ?: return@mapNotNull null
        val phase = resolveAttendancePhase(
            openedAt = o["attendance_opened_at"]?.jsonPrimitive?.contentOrNull(),
            closedAt = o["attendance_closed_at"]?.jsonPrimitive?.contentOrNull(),
            finalizedAt = o["attendance_finalized_at"]?.jsonPrimitive?.contentOrNull(),
            closesAt = o["attendance_closes_at"]?.jsonPrimitive?.contentOrNull(),
            endsAt = o["ends_at"]?.jsonPrimitive?.contentOrNull(),
            nowMs = nowMs,
        )
        ActionAttendanceMeeting(
            sessionId = sessionId,
            subjectId = o["subject_id"]?.jsonPrimitive?.contentOrNull(),
            subjectName = o["subject_name"]?.jsonPrimitive?.contentOrNull() ?: "",
            subjectCode = o["subject_code"]?.jsonPrimitive?.contentOrNull(),
            meetingNumber = o["meeting_number"]?.jsonPrimitive?.contentOrNull()?.toIntOrNull(),
            startsAt = o["starts_at"]?.jsonPrimitive?.contentOrNull() ?: "",
            phase = phase,
        )
    }
}

private fun resolveAttendancePhase(
    openedAt: String?,
    closedAt: String?,
    finalizedAt: String?,
    closesAt: String?,
    endsAt: String?,
    nowMs: Long,
): String {
    if (finalizedAt != null) return "finalized"
    if (closedAt != null) return "closed"
    if (openedAt != null) return "open"
    // Scheduled until opened; time-based close matches resolveAttendanceMeetingPhase.
    val closeMs = parseTimeMsOrNull(closesAt) ?: parseTimeMsOrNull(endsAt)
    if (closeMs != null && nowMs > closeMs) return "closed"
    return "scheduled"
}

private fun parseTimeMsOrNull(iso: String?): Long? {
    if (iso.isNullOrBlank()) return null
    return try {
        java.time.Instant.parse(iso).toEpochMilli()
    } catch (_: Exception) {
        try {
            java.time.OffsetDateTime.parse(iso).toInstant().toEpochMilli()
        } catch (_: Exception) { null }
    }
}

suspend fun listClassMembersCount(classId: String): Int {
    return try {
        SupabaseProvider.client.postgrest.from("class_members").select {
            filter { eq("class_id", classId); eq("status", "active") }
        }.decodeJsonArray().size
    } catch (_: Exception) { 0 }
}

suspend fun listClassSubjectsForAttendance(classId: String): List<ActionAttendanceCourse> {
    val db = SupabaseProvider.client.postgrest
    val subjects = try {
        db.from("class_subjects").select {
            filter { eq("class_id", classId) }
            order("created_at", Order.ASCENDING)
        }.decodeJsonArray().mapNotNull { el ->
            val o = el.jsonObject
            val id = o["id"]?.jsonPrimitive?.content ?: return@mapNotNull null
            Triple(id, o["name"]?.jsonPrimitive?.contentOrNull() ?: "Course", o)
        }
    } catch (_: Exception) { emptyList() }
    if (subjects.isEmpty()) return emptyList()
    val meetings = listClassAttendanceMeetings(classId)
    return subjects.map { (id, name, o) ->
        ActionAttendanceCourse(
            id = id,
            name = name,
            code = o["code"]?.jsonPrimitive?.contentOrNull(),
            lecturerName = o["lecturer_name"]?.jsonPrimitive?.contentOrNull(),
            meetings = meetings.filter { it.subjectId == id },
        )
    }
}
