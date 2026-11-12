package id.starstask.mobile.data

import io.github.jan.supabase.postgrest.postgrest
import io.github.jan.supabase.postgrest.query.filter.FilterOperator
import io.github.jan.supabase.postgrest.query.Order
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.Serializable

/**
 * Leave requests read models, mirroring the web leave data layer
 * (apps/web/src/lib/db/leave.ts). The backend tables and status values keep
 * their original names; only the presentation layer calls them Leave.
 *
 * Status meanings (docs/LEAVE_REQUESTS.md, packages/contracts/src/leave.ts):
 * - draft: half-filled, private to the student.
 * - submitted: sent to the class admin (shown as Pending).
 * - approved: class admin approved; covered sessions become excused.
 * - rejected: class admin rejected; attendance unchanged.
 * - forwarded: included in a class admin's forwarding package. Not a decision.
 * - cancelled: withdrawn by the student or cancelled by the class admin.
 * - revision_requested: returned for edit and resubmit (editable again).
 *
 * There is no hard delete: cancelling is the withdrawal action.
 */

@Serializable
data class LeaveRequest(
    val id: String,
    val status: String,
    val leaveStart: String?,
    val leaveEnd: String?,
    val reason: String?,
    val reference: String = "",
    val studentId: String = "",
    val studentName: String = "",
    val classId: String = "",
    val className: String = "",
    val explanation: String? = null,
    val documentIssueDate: String? = null,
    val subjectIds: List<String> = emptyList(),
    val subjectNames: List<String> = emptyList(),
    val submittedAt: String? = null,
    val forwardedAt: String? = null,
    val cancelledAt: String? = null,
    val cancelledByName: String? = null,
    val cancellationNote: String? = null,
    val createdAt: String? = null,
    val updatedAt: String? = null,
    val evidenceCount: Int = 0,
    val ocrStatus: String = "not_run",
    val ocrResult: Map<String, String> = emptyMap(),
    val fieldSources: Map<String, String> = emptyMap(),
    val ocrConfirmedAt: String? = null,
)

data class LeaveEvidence(
    val id: String,
    val storagePath: String,
    val originalFilename: String,
    val mimeType: String,
    val fileSize: Long,
    val sortOrder: Int = 0,
)

data class LeaveHistoryEntry(
    val id: String,
    val actorName: String?,
    val action: String,
    val note: String?,
    val createdAt: String?,
)

data class LeaveForwardingItem(
    val requestId: String,
    val requestReference: String,
    val studentDisplayName: String,
    val leaveStartDate: String,
    val leaveEndDate: String,
)

/** One forwarding package, mirroring web listLeaveForwardings (newest first). */
data class LeaveForwardingRecord(
    val id: String,
    val reference: String,
    val forwardedByName: String?,
    val recipientName: String,
    val recipientEmail: String?,
    val reportReference: String,
    val reportFormat: String,
    val requestCount: Int,
    val createdAt: String?,
    val items: List<LeaveForwardingItem>,
)

data class LeaveClassChoice(
    val id: String,
    val name: String,
    val courses: List<CourseOption>,
    val isAdmin: Boolean = false,
)

fun leaveStatusLabel(status: String): String =
    when (status) {
        "draft" -> "Draft"
        "submitted", "needs_revision" -> "Pending"
        "approved" -> "Approved"
        "rejected" -> "Rejected"
        "forwarded" -> "Forwarded"
        "cancelled" -> "Cancelled"
        "revision_requested" -> "Revision Requested"
        else -> status.replaceFirstChar { it.uppercase() }
    }

fun leaveReasonLabel(reason: String?): String =
    when (reason) {
        "illness" -> "Illness"
        "family_matter" -> "Family matter"
        "other" -> "Other"
        null -> "Reason not set"
        else -> reason.replaceFirstChar { it.uppercase() }
    }

fun isLeaveRequestEditable(status: String): Boolean =
    status == "draft" || status == "revision_requested"

fun isLeaveRequestCancellable(status: String): Boolean =
    status == "draft" || status == "submitted" || status == "revision_requested"

fun formatLeaveDate(isoDate: String?): String {
    if (isoDate.isNullOrBlank()) return "—"
    return try {
        java.time.LocalDate.parse(isoDate.take(10))
            .format(java.time.format.DateTimeFormatter.ofPattern("d MMM yyyy", java.util.Locale.getDefault()))
    } catch (_: Exception) {
        isoDate.take(10)
    }
}

fun formatLeaveDateRange(start: String?, end: String?): String {
    if (start.isNullOrBlank() || end.isNullOrBlank()) return "Dates not set yet"
    return if (start.take(10) == end.take(10)) {
        formatLeaveDate(start)
    } else {
        "${formatLeaveDate(start)} → ${formatLeaveDate(end)}"
    }
}

fun leaveDayCount(start: String?, end: String?): Int {
    if (start.isNullOrBlank() || end.isNullOrBlank()) return 0
    return try {
        val days = java.time.temporal.ChronoUnit.DAYS.between(
            java.time.LocalDate.parse(start.take(10)),
            java.time.LocalDate.parse(end.take(10)),
        )
        (days + 1).toInt()
    } catch (_: Exception) {
        0
    }
}

private fun kotlinx.serialization.json.JsonObject?.toStringMap(): Map<String, String> {
    val obj = this ?: return emptyMap()
    return obj.entries.associate { (key, value) ->
        key to (value.jsonPrimitive.contentOrNull() ?: value.toString().trim('"'))
    }
}

private fun kotlinx.serialization.json.JsonObject.toLeaveRequest(
    classNames: Map<String, String>,
    evidenceCounts: Map<String, Int>,
    subjectNamesById: Map<String, String>,
    studentNames: Map<String, String> = emptyMap(),
): LeaveRequest? {
    val subjectIds = (this["subject_ids"] as? JsonArray)
        ?.mapNotNull { it.jsonPrimitive.contentOrNull() }
        ?: emptyList()
    val sid = this["student_id"]?.jsonPrimitive?.contentOrNull() ?: ""
    return LeaveRequest(
        id = this["id"]?.jsonPrimitive?.content ?: return null,
        status = this["status"]?.jsonPrimitive?.contentOrNull() ?: "",
        leaveStart = this["leave_start_date"]?.jsonPrimitive?.contentOrNull(),
        leaveEnd = this["leave_end_date"]?.jsonPrimitive?.contentOrNull(),
        reason = this["reason_category"]?.jsonPrimitive?.contentOrNull(),
        reference = this["reference"]?.jsonPrimitive?.contentOrNull() ?: "",
        studentId = sid,
        studentName = studentNames[sid] ?: "",
        classId = this["class_id"]?.jsonPrimitive?.contentOrNull() ?: "",
        className = classNames[this["class_id"]?.jsonPrimitive?.contentOrNull()] ?: "Class",
        explanation = this["explanation"]?.jsonPrimitive?.contentOrNull(),
        documentIssueDate = this["document_issue_date"]?.jsonPrimitive?.contentOrNull(),
        subjectIds = subjectIds,
        subjectNames = subjectIds.mapNotNull(subjectNamesById::get),
        submittedAt = this["submitted_at"]?.jsonPrimitive?.contentOrNull(),
        forwardedAt = this["forwarded_at"]?.jsonPrimitive?.contentOrNull(),
        cancelledAt = this["cancelled_at"]?.jsonPrimitive?.contentOrNull(),
        cancellationNote = this["cancellation_note"]?.jsonPrimitive?.contentOrNull(),
        createdAt = this["created_at"]?.jsonPrimitive?.contentOrNull(),
        updatedAt = this["updated_at"]?.jsonPrimitive?.contentOrNull(),
        evidenceCount = evidenceCounts[this["id"]?.jsonPrimitive?.content] ?: 0,
        ocrStatus = this["ocr_status"]?.jsonPrimitive?.contentOrNull() ?: "not_run",
        ocrResult = (this["ocr_result"] as? kotlinx.serialization.json.JsonObject).toStringMap(),
        fieldSources = (this["field_sources"] as? kotlinx.serialization.json.JsonObject).toStringMap(),
        ocrConfirmedAt = this["ocr_confirmed_at"]?.jsonPrimitive?.contentOrNull(),
    )
}

private suspend fun leaveClassNames(classIds: Collection<String>): Map<String, String> {
    if (classIds.isEmpty()) return emptyMap()
    val rows = SupabaseProvider.client.postgrest.from("classes").select {
        filter { isIn("id", classIds.toList()) }
    }.decodeJsonArray()
    return rows.associateBy(
        { it.jsonObject["id"]!!.jsonPrimitive.content },
        { it.jsonObject["name"]?.jsonPrimitive?.contentOrNull() ?: "Class" },
    )
}

private suspend fun leaveEvidenceCounts(requestIds: Collection<String>): Map<String, Int> {
    if (requestIds.isEmpty()) return emptyMap()
    val rows = SupabaseProvider.client.postgrest.from("leave_request_evidence").select {
        filter {
            isIn("request_id", requestIds.toList())
            filter("removed_at", FilterOperator.IS, null)
        }
    }.decodeJsonArray()
    return rows.groupingBy { it.jsonObject["request_id"]!!.jsonPrimitive.content }.eachCount()
}

private suspend fun leaveSubjectNames(subjectIds: Collection<String>): Map<String, String> {
    val unique = subjectIds.distinct()
    if (unique.isEmpty()) return emptyMap()
    val rows = SupabaseProvider.client.postgrest.from("class_subjects").select {
        filter { isIn("id", unique) }
    }.decodeJsonArray()
    return rows.associateBy(
        { it.jsonObject["id"]!!.jsonPrimitive.content },
        { it.jsonObject["name"]?.jsonPrimitive?.contentOrNull() ?: "Course" },
    )
}

private suspend fun cancelledByNames(rows: List<kotlinx.serialization.json.JsonElement>): Map<String, String> {
    val ids = rows.mapNotNull { it.jsonObject["cancelled_by"]?.jsonPrimitive?.contentOrNull() }.distinct()
    if (ids.isEmpty()) return emptyMap()
    val profiles = SupabaseProvider.client.postgrest.from("profiles").select {
        filter { isIn("id", ids) }
    }.decodeJsonArray()
    return profiles.associateBy(
        { it.jsonObject["id"]!!.jsonPrimitive.content },
        { it.jsonObject["display_name"]?.jsonPrimitive?.contentOrNull() ?: "Someone" },
    )
}

internal suspend fun profileDisplayNames(ids: Collection<String>): Map<String, String> {
    val unique = ids.distinct().filter { it.isNotBlank() }
    if (unique.isEmpty()) return emptyMap()
    val profiles = SupabaseProvider.client.postgrest.from("profiles").select {
        filter { isIn("id", unique) }
    }.decodeJsonArray()
    return profiles.associateBy(
        { it.jsonObject["id"]!!.jsonPrimitive.content },
        { it.jsonObject["display_name"]?.jsonPrimitive?.contentOrNull() ?: "Student" },
    )
}

private suspend fun enrichLeaveRows(
    rows: List<kotlinx.serialization.json.JsonElement>,
): List<LeaveRequest> {
    if (rows.isEmpty()) return emptyList()
    val classNames = leaveClassNames(rows.mapNotNull { it.jsonObject["class_id"]?.jsonPrimitive?.contentOrNull() })
    val evidenceCounts = leaveEvidenceCounts(rows.mapNotNull { it.jsonObject["id"]?.jsonPrimitive?.contentOrNull() })
    val subjectNames = leaveSubjectNames(
        rows.flatMap {
            (it.jsonObject["subject_ids"] as? JsonArray)?.mapNotNull { e -> e.jsonPrimitive.contentOrNull() } ?: emptyList()
        },
    )
    val cancelledBy = cancelledByNames(rows)
    val studentNames = profileDisplayNames(
        rows.mapNotNull { it.jsonObject["student_id"]?.jsonPrimitive?.contentOrNull() },
    )
    return rows.mapNotNull { row ->
        row.jsonObject.toLeaveRequest(classNames, evidenceCounts, subjectNames, studentNames)?.let { req ->
            val cancelledById = row.jsonObject["cancelled_by"]?.jsonPrimitive?.contentOrNull()
            req.copy(cancelledByName = cancelledById?.let(cancelledBy::get))
        }
    }
}

suspend fun loadLeaveRequests(userId: String): List<LeaveRequest> {
    val db = SupabaseProvider.client.postgrest
    val rows = db.from("leave_requests").select {
        filter { eq("student_id", userId) }
        order("created_at", Order.DESCENDING)
        limit(100)
    }.decodeJsonArray()
    return enrichLeaveRows(rows)
}

/**
 * Class reviewer queue: every non-draft request in the class (web
 * listLeaveRequestsForClass). Drafts stay private to their student.
 */

/** Client-side mirror of the web leave CSV export (docs/LEAVE_REQUESTS.md §8). */
fun leaveReportCsv(rows: List<LeaveRequest>): String {
    fun cell(value: String?): String {
        val raw = value ?: ""
        val guarded = if (raw.firstOrNull() in listOf('=', '+', '-', '@', '\t', '\r')) {
            "'$raw"
        } else {
            raw
        }
        return "\"" + guarded.replace("\"", "\"\"") + "\""
    }
    val header = "reference,student,absence_start,absence_end,day_count,document_issue_date,reason,submitted_at,status,cancellation_note"
    val lines = rows.joinToString("\n") { row ->
        listOf(
            row.reference,
            row.studentName,
            row.leaveStart ?: "",
            row.leaveEnd ?: "",
            leaveDayCount(row.leaveStart, row.leaveEnd).toString(),
            row.documentIssueDate ?: "",
            leaveReasonLabel(row.reason),
            row.submittedAt?.take(10) ?: "",
            leaveStatusLabel(row.status),
            row.cancellationNote ?: "",
        ).joinToString(",") { cell(it) }
    }
    return if (lines.isBlank()) header else "$header\n$lines"
}
suspend fun loadClassLeaveRequests(classId: String): List<LeaveRequest> {
    val db = SupabaseProvider.client.postgrest
    val rows = db.from("leave_requests").select {
        filter {
            eq("class_id", classId)
            neq("status", "draft")
        }
        order("created_at", Order.DESCENDING)
        limit(200)
    }.decodeJsonArray()
    return enrichLeaveRows(rows)
}

suspend fun loadLeaveRequestById(requestId: String): LeaveRequest? {
    val db = SupabaseProvider.client.postgrest
    val rows = db.from("leave_requests").select {
        filter { eq("id", requestId) }
        limit(1)
    }.decodeJsonArray()
    return enrichLeaveRows(rows).firstOrNull()
}

suspend fun listLeaveEvidence(requestId: String): List<LeaveEvidence> {
    val rows = SupabaseProvider.client.postgrest.from("leave_request_evidence").select {
        filter {
            eq("request_id", requestId)
            filter("removed_at", FilterOperator.IS, null)
        }
        order("sort_order", Order.ASCENDING)
    }.decodeJsonArray()
    return rows.mapNotNull {
        val obj = it.jsonObject
        LeaveEvidence(
            id = obj["id"]?.jsonPrimitive?.content ?: return@mapNotNull null,
            storagePath = obj["storage_path"]?.jsonPrimitive?.content ?: return@mapNotNull null,
            originalFilename = obj["original_filename"]?.jsonPrimitive?.contentOrNull() ?: "file",
            mimeType = obj["mime_type"]?.jsonPrimitive?.contentOrNull() ?: "",
            fileSize = obj["file_size"]?.jsonPrimitive?.content?.toLongOrNull() ?: 0,
            sortOrder = obj["sort_order"]?.jsonPrimitive?.content?.toIntOrNull() ?: 0,
        )
    }
}

suspend fun listLeaveHistory(requestId: String): List<LeaveHistoryEntry> {
    val db = SupabaseProvider.client.postgrest
    val rows = db.from("leave_request_history").select {
        filter { eq("request_id", requestId) }
        order("created_at", Order.ASCENDING)
    }.decodeJsonArray()
    val actorIds = rows.mapNotNull { it.jsonObject["actor_id"]?.jsonPrimitive?.contentOrNull() }.distinct()
    val names = if (actorIds.isEmpty()) {
        emptyMap()
    } else {
        db.from("profiles").select {
            filter { isIn("id", actorIds) }
        }.decodeJsonArray().associateBy(
            { it.jsonObject["id"]!!.jsonPrimitive.content },
            { it.jsonObject["display_name"]?.jsonPrimitive?.contentOrNull() ?: "Someone" },
        )
    }
    return rows.mapNotNull {
        val obj = it.jsonObject
        LeaveHistoryEntry(
            id = obj["id"]?.jsonPrimitive?.content ?: return@mapNotNull null,
            actorName = obj["actor_id"]?.jsonPrimitive?.contentOrNull()?.let(names::get),
            action = obj["action"]?.jsonPrimitive?.contentOrNull() ?: "",
            note = obj["note"]?.jsonPrimitive?.contentOrNull(),
            createdAt = obj["created_at"]?.jsonPrimitive?.contentOrNull(),
        )
    }
}

/** Forwarding history for a class, newest first, with the included requests. */
suspend fun listLeaveForwardings(classId: String): List<LeaveForwardingRecord> {
    val db = SupabaseProvider.client.postgrest
    val rows = db.from("leave_request_forwardings").select {
        filter { eq("class_id", classId) }
        order("created_at", Order.DESCENDING)
        limit(50)
    }.decodeJsonArray()
    if (rows.isEmpty()) return emptyList()
    val forwardingIds = rows.mapNotNull { it.jsonObject["id"]?.jsonPrimitive?.content }
    val items = db.from("leave_request_forwarding_items").select {
        filter { isIn("forwarding_id", forwardingIds) }
    }.decodeJsonArray()
    val requestIds = items.mapNotNull { it.jsonObject["request_id"]?.jsonPrimitive?.content }.distinct()
    val references = if (requestIds.isEmpty()) {
        emptyMap()
    } else {
        db.from("leave_requests").select {
            filter { isIn("id", requestIds) }
        }.decodeJsonArray().associateBy(
            { it.jsonObject["id"]!!.jsonPrimitive.content },
            { it.jsonObject["reference"]?.jsonPrimitive?.contentOrNull() ?: "" },
        )
    }
    val profiles = profileDisplayNames(rows.mapNotNull { it.jsonObject["forwarded_by"]?.jsonPrimitive?.contentOrNull() })
    val itemsByForwarding = items.groupBy { it.jsonObject["forwarding_id"]?.jsonPrimitive?.contentOrNull() }
    return rows.mapNotNull { row ->
        val obj = row.jsonObject
        val id = obj["id"]?.jsonPrimitive?.content ?: return@mapNotNull null
        LeaveForwardingRecord(
            id = id,
            reference = obj["reference"]?.jsonPrimitive?.contentOrNull() ?: "",
            forwardedByName = obj["forwarded_by"]?.jsonPrimitive?.contentOrNull()?.let(profiles::get),
            recipientName = obj["recipient_name"]?.jsonPrimitive?.contentOrNull() ?: "",
            recipientEmail = obj["recipient_email"]?.jsonPrimitive?.contentOrNull(),
            reportReference = obj["report_reference"]?.jsonPrimitive?.contentOrNull() ?: "",
            reportFormat = obj["report_format"]?.jsonPrimitive?.contentOrNull() ?: "",
            requestCount = obj["request_count"]?.jsonPrimitive?.content?.toIntOrNull() ?: 0,
            createdAt = obj["created_at"]?.jsonPrimitive?.contentOrNull(),
            items = (itemsByForwarding[id] ?: emptyList()).mapNotNull { item ->
                val itemObj = item.jsonObject
                val reqId = itemObj["request_id"]?.jsonPrimitive?.content ?: return@mapNotNull null
                LeaveForwardingItem(
                    requestId = reqId,
                    requestReference = references[reqId] ?: "",
                    studentDisplayName = itemObj["student_display_name"]?.jsonPrimitive?.contentOrNull() ?: "Student",
                    leaveStartDate = itemObj["leave_start_date"]?.jsonPrimitive?.contentOrNull() ?: "",
                    leaveEndDate = itemObj["leave_end_date"]?.jsonPrimitive?.contentOrNull() ?: "",
                )
            },
        )
    }
}

/** Classes the student belongs to, each with its active courses. */
suspend fun loadMyLeaveClasses(userId: String): List<LeaveClassChoice> {
    val db = SupabaseProvider.client.postgrest
    val memberships = db.from("class_members").select {
        filter { eq("user_id", userId) }
        order("joined_at", Order.DESCENDING)
        limit(100)
    }.decodeJsonArray()
    val classIds = memberships.mapNotNull { it.jsonObject["class_id"]?.jsonPrimitive?.content }.distinct()
    if (classIds.isEmpty()) return emptyList()
    val classRows = db.from("classes").select {
        filter { isIn("id", classIds) }
    }.decodeJsonArray()
    val coursesByClass = db.from("class_subjects").select {
        filter {
            isIn("class_id", classIds)
            eq("status", "active")
        }
        order("created_at", Order.ASCENDING)
    }.decodeJsonArray().groupBy { it.jsonObject["class_id"]?.jsonPrimitive?.contentOrNull() }
    val nameById = classRows.associateBy(
        { it.jsonObject["id"]!!.jsonPrimitive.content },
        { it.jsonObject["name"]?.jsonPrimitive?.contentOrNull() ?: "Class" },
    )
    val adminClassIds = db.from("class_admins").select {
        filter {
            eq("user_id", userId)
            isIn("class_id", classIds)
        }
    }.decodeJsonArray().mapNotNull { it.jsonObject["class_id"]?.jsonPrimitive?.content }.toSet()
    return classIds.mapNotNull { classId ->
        val name = nameById[classId] ?: return@mapNotNull null
        val courses = (coursesByClass[classId] ?: emptyList()).mapNotNull { row ->
            val obj = row.jsonObject
            val id = obj["id"]?.jsonPrimitive?.content ?: return@mapNotNull null
            val courseName = obj["name"]?.jsonPrimitive?.contentOrNull() ?: "Course"
            val code = obj["code"]?.jsonPrimitive?.contentOrNull()
            CourseOption(id = id, name = if (code != null) "$code · $courseName" else courseName, code = code)
        }
        LeaveClassChoice(id = classId, name = name, courses = courses, isAdmin = classId in adminClassIds)
    }
}
