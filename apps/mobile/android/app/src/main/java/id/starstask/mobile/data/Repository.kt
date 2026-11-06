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

/**
 * Read models for the native shell, mirroring the web dashboard queries.
 * Only public-safe columns are selected; eligibility/authorization stays
 * server-side via RLS + RPCs.
 */

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

data class DashboardAssignment(
    val id: String,
    val title: String,
    val deadline: String?,
    val subjectName: String?,
)

data class DashboardClass(val id: String, val name: String)

data class DashboardData(
    val displayName: String?,
    val totalTasks: Int,
    val dueSoon: Int,
    val pastDeadline: Int,
    val newThisWeek: Int = 0,
    val classes: List<DashboardClass>,
    val todaySessions: List<DashboardSession>,
    val upcomingAssignments: List<DashboardAssignment>,
)

data class Conversation(val id: String, val otherName: String, val unread: Boolean)

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
        DashboardClass(id, name)
    }.sortedBy { it.name }

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

    val allRows: List<kotlinx.serialization.json.JsonElement> = sessions + assignments
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

    val today = java.time.LocalDate.now(java.time.ZoneId.of("Asia/Jakarta")).toString()
    val todayRows = sessions.filter {
        it.jsonObject["starts_at"]?.jsonPrimitive?.content?.substring(0, 10) == today ||
            jakartaDate(it.jsonObject["starts_at"]!!.jsonPrimitive.content) == today
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
        classes = classRows,
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

fun jakartaDate(iso: String): String =
    try {
        java.time.OffsetDateTime.parse(iso)
            .atZoneSameInstant(java.time.ZoneId.of("Asia/Jakarta"))
            .toLocalDate().toString()
    } catch (_: Exception) {
        iso.substring(0, 10)
    }

fun formatTime(iso: String): String =
    try {
        java.time.OffsetDateTime.parse(iso)
            .atZoneSameInstant(java.time.ZoneId.of("Asia/Jakarta"))
            .toLocalTime().format(java.time.format.DateTimeFormatter.ofPattern("HH.mm"))
    } catch (_: Exception) {
        iso.take(16)
    }

private fun kotlinx.serialization.json.JsonPrimitive?.contentOrNull(): String? =
    this?.content?.takeIf { it != "null" }

suspend fun loadConversations(userId: String): List<Conversation> {
    val db = SupabaseProvider.client.postgrest
    val participants = db.from("dm_participants").select {
        filter { eq("user_id", userId) }
    }.decodeJsonArray()

    val conversationIds = participants.mapNotNull {
        it.jsonObject["conversation_id"]?.jsonPrimitive?.content
    }
    if (conversationIds.isEmpty()) return emptyList()

    val others = db.from("dm_participants").select {
        filter {
            isIn("conversation_id", conversationIds)
            neq("user_id", userId)
        }
    }.decodeJsonArray()

    val names = mutableMapOf<String, String>()
    val otherIds = others.mapNotNull { it.jsonObject["user_id"]?.jsonPrimitive?.content }.toSet()
    if (otherIds.isNotEmpty()) {
        val profiles = db.from("profiles").select {
            filter { isIn("id", otherIds.toList()) }
        }.decodeJsonArray()
        for (p in profiles) {
            val id = p.jsonObject["id"]?.jsonPrimitive?.content
            val name = p.jsonObject["display_name"]?.jsonPrimitive?.content
            if (id != null && name != null) names[id] = name
        }
    }

    return others.mapNotNull {
        val obj = it.jsonObject
        val convId = obj["conversation_id"]?.jsonPrimitive?.content ?: return@mapNotNull null
        val otherId = obj["user_id"]?.jsonPrimitive?.content ?: return@mapNotNull null
        Conversation(convId, names[otherId] ?: "Encrypted chat", unread = false)
    }
}


data class ScheduleEntry(val id: String, val title: String, val startsAt: String, val endsAt: String, val className: String?)

data class LeaveRequest(val id: String, val status: String, val leaveStart: String?, val leaveEnd: String?, val reason: String?)

data class OnboardingProfile(val fullName: String?, val nim: String?, val onboardedAt: String?)

suspend fun loadSchedule(userId: String): List<ScheduleEntry> {
    val db = SupabaseProvider.client.postgrest
    val memberships = db.from("class_members").select {
        filter { eq("user_id", userId) }
    }.decodeJsonArray().mapNotNull { it.jsonObject["class_id"]?.jsonPrimitive?.content }
    if (memberships.isEmpty()) return emptyList()

    val weekAgo = java.time.Instant.now().minusSeconds(7 * 24 * 3600).toString()
    val in30 = java.time.Instant.now().plusSeconds(30 * 24 * 3600).toString()
    val rows = db.from("discussion_sessions").select {
        filter {
            isIn("class_id", memberships)
            neq("status", "cancelled")
            gte("starts_at", weekAgo)
            lte("starts_at", in30)
        }
        order("starts_at", io.github.jan.supabase.postgrest.query.Order.ASCENDING)
        limit(100)
    }.decodeJsonArray()

    val classIds = rows.mapNotNull { it.jsonObject["class_id"]?.jsonPrimitive?.content }.toSet()
    val names = if (classIds.isEmpty()) emptyMap() else {
        db.from("classes").select {
            filter { isIn("id", classIds.toList()) }
        }.decodeJsonArray().associateBy(
            { it.jsonObject["id"]!!.jsonPrimitive.content },
            { it.jsonObject["name"]?.jsonPrimitive?.contentOrNull() },
        )
    }

    return rows.mapNotNull {
        val obj = it.jsonObject
        ScheduleEntry(
            id = obj["id"]?.jsonPrimitive?.content ?: return@mapNotNull null,
            title = obj["title"]?.jsonPrimitive?.contentOrNull() ?: "Session",
            startsAt = obj["starts_at"]?.jsonPrimitive?.contentOrNull() ?: "",
            endsAt = obj["ends_at"]?.jsonPrimitive?.contentOrNull() ?: "",
            className = obj["class_id"]?.jsonPrimitive?.contentOrNull()?.let(names::get),
        )
    }
}

suspend fun loadLeaveRequests(userId: String): List<LeaveRequest> {
    val db = SupabaseProvider.client.postgrest
    val rows = db.from("leave_requests").select {
        filter { eq("student_id", userId) }
        order("submitted_at", io.github.jan.supabase.postgrest.query.Order.DESCENDING)
        limit(30)
    }.decodeJsonArray()

    return rows.mapNotNull {
        val obj = it.jsonObject
        LeaveRequest(
            id = obj["id"]?.jsonPrimitive?.content ?: return@mapNotNull null,
            status = obj["status"]?.jsonPrimitive?.contentOrNull() ?: "",
            leaveStart = obj["leave_start_date"]?.jsonPrimitive?.contentOrNull(),
            leaveEnd = obj["leave_end_date"]?.jsonPrimitive?.contentOrNull(),
            reason = obj["reason_category"]?.jsonPrimitive?.contentOrNull(),
        )
    }
}

suspend fun loadOnboardingProfile(userId: String): OnboardingProfile? {
    val db = SupabaseProvider.client.postgrest
    val rows = db.from("profiles").select {
        filter { eq("id", userId) }
        limit(1)
    }.decodeJsonArray()
    val obj = rows.firstOrNull()?.jsonObject ?: return null
    return OnboardingProfile(
        fullName = obj["full_name"]?.jsonPrimitive?.contentOrNull(),
        nim = obj["nim"]?.jsonPrimitive?.contentOrNull(),
        onboardedAt = obj["onboarded_at"]?.jsonPrimitive?.contentOrNull(),
    )
}

suspend fun submitLeaveRequest(
    classId: String,
    leaveStart: String,
    leaveEnd: String,
    reason: String,
) {
    val db = SupabaseProvider.client.postgrest
    db.from("leave_requests").insert(
        kotlinx.serialization.json.buildJsonObject {
            put("class_id", kotlinx.serialization.json.JsonPrimitive(classId))
            put("leave_start_date", kotlinx.serialization.json.JsonPrimitive(leaveStart))
            put("leave_end_date", kotlinx.serialization.json.JsonPrimitive(leaveEnd))
            put("reason_category", kotlinx.serialization.json.JsonPrimitive(reason))
            put("status", kotlinx.serialization.json.JsonPrimitive("submitted"))
        },
    )
}

data class Assignment(val id: String, val title: String, val status: String, val deadline: String?, val className: String?)

data class ClassDetail(val id: String, val name: String, val slug: String, val semester: String, val academicYear: String, val memberCount: Int)

data class SessionRow(val id: String, val title: String, val startsAt: String, val endsAt: String, val status: String, val className: String?)

data class NotificationRow(val id: String, val title: String, val body: String, val url: String?, val createdAt: String, val readAt: String?)

data class Profile(val displayName: String?, val avatarUrl: String?)

suspend fun loadAssignments(userId: String): List<Assignment> {
    val db = SupabaseProvider.client.postgrest
    val memberships = db.from("class_members").select {
        filter { eq("user_id", userId) }
    }.decodeJsonArray().mapNotNull { it.jsonObject["class_id"]?.jsonPrimitive?.content }
    if (memberships.isEmpty()) return emptyList()

    val rows = db.from("assignments").select {
        filter {
            isIn("class_id", memberships)
            eq("status", "published")
        }
        order("deadline", io.github.jan.supabase.postgrest.query.Order.ASCENDING)
        limit(50)
    }.decodeJsonArray()

    val classIds = rows.mapNotNull { it.jsonObject["class_id"]?.jsonPrimitive?.content }.toSet()
    val names = if (classIds.isEmpty()) emptyMap() else {
        db.from("classes").select {
            filter { isIn("id", classIds.toList()) }
        }.decodeJsonArray().associateBy(
            { it.jsonObject["id"]!!.jsonPrimitive.content },
            { it.jsonObject["name"]?.jsonPrimitive?.contentOrNull() },
        )
    }

    return rows.mapNotNull {
        val obj = it.jsonObject
        Assignment(
            id = obj["id"]?.jsonPrimitive?.content ?: return@mapNotNull null,
            title = obj["title"]?.jsonPrimitive?.contentOrNull() ?: "Assignment",
            status = obj["status"]?.jsonPrimitive?.contentOrNull() ?: "",
            deadline = obj["deadline"]?.jsonPrimitive?.contentOrNull(),
            className = obj["class_id"]?.jsonPrimitive?.contentOrNull()?.let(names::get),
        )
    }
}

suspend fun loadClasses(userId: String): List<ClassDetail> {
    val db = SupabaseProvider.client.postgrest
    val memberships = db.from("class_members").select {
        filter { eq("user_id", userId) }
    }.decodeJsonArray().mapNotNull { it.jsonObject["class_id"]?.jsonPrimitive?.content }
    if (memberships.isEmpty()) return emptyList()

    val rows = db.from("classes").select {
        filter {
            isIn("id", memberships)
            eq("status", "active")
        }
        order("name", io.github.jan.supabase.postgrest.query.Order.ASCENDING)
    }.decodeJsonArray()

    return rows.mapNotNull {
        val obj = it.jsonObject
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

suspend fun loadSessions(userId: String): List<SessionRow> {
    val db = SupabaseProvider.client.postgrest
    val memberships = db.from("class_members").select {
        filter { eq("user_id", userId) }
    }.decodeJsonArray().mapNotNull { it.jsonObject["class_id"]?.jsonPrimitive?.content }
    if (memberships.isEmpty()) return emptyList()

    val rows = db.from("discussion_sessions").select {
        filter {
            isIn("class_id", memberships)
            neq("status", "cancelled")
        }
        order("starts_at", io.github.jan.supabase.postgrest.query.Order.DESCENDING)
        limit(50)
    }.decodeJsonArray()

    val classIds = rows.mapNotNull { it.jsonObject["class_id"]?.jsonPrimitive?.content }.toSet()
    val names = if (classIds.isEmpty()) emptyMap() else {
        db.from("classes").select {
            filter { isIn("id", classIds.toList()) }
        }.decodeJsonArray().associateBy(
            { it.jsonObject["id"]!!.jsonPrimitive.content },
            { it.jsonObject["name"]?.jsonPrimitive?.contentOrNull() },
        )
    }

    return rows.mapNotNull {
        val obj = it.jsonObject
        SessionRow(
            id = obj["id"]?.jsonPrimitive?.content ?: return@mapNotNull null,
            title = obj["title"]?.jsonPrimitive?.contentOrNull() ?: "Session",
            startsAt = obj["starts_at"]?.jsonPrimitive?.contentOrNull() ?: "",
            endsAt = obj["ends_at"]?.jsonPrimitive?.contentOrNull() ?: "",
            status = obj["status"]?.jsonPrimitive?.contentOrNull() ?: "",
            className = obj["class_id"]?.jsonPrimitive?.contentOrNull()?.let(names::get),
        )
    }
}

suspend fun loadNotifications(): List<NotificationRow> {
    val db = SupabaseProvider.client.postgrest
    val rows = db.from("notification_events").select {
        order("created_at", io.github.jan.supabase.postgrest.query.Order.DESCENDING)
        limit(30)
    }.decodeJsonArray()

    return rows.mapNotNull {
        val obj = it.jsonObject
        val payload = obj["payload"]?.jsonObject ?: return@mapNotNull null
        NotificationRow(
            id = obj["id"]?.jsonPrimitive?.content ?: return@mapNotNull null,
            title = payload["title"]?.jsonPrimitive?.contentOrNull() ?: "Notification",
            body = payload["body"]?.jsonPrimitive?.contentOrNull() ?: "",
            url = payload["url"]?.jsonPrimitive?.contentOrNull(),
            createdAt = obj["created_at"]?.jsonPrimitive?.contentOrNull() ?: "",
            readAt = obj["read_at"]?.jsonPrimitive?.contentOrNull(),
        )
    }
}

suspend fun markNotificationRead(id: String) {
    SupabaseProvider.client.postgrest.rpc(
        "mark_notification_events_read",
        kotlinx.serialization.json.buildJsonObject {
            put("p_ids", kotlinx.serialization.json.JsonArray(listOf(kotlinx.serialization.json.JsonPrimitive(id))))
        },
    )
}

suspend fun loadProfile(userId: String): Profile? {
    val db = SupabaseProvider.client.postgrest
    val rows = db.from("profiles").select {
        filter { eq("id", userId) }
        limit(1)
    }.decodeJsonArray()
    val obj = rows.firstOrNull()?.jsonObject ?: return null
    return Profile(
        displayName = obj["display_name"]?.jsonPrimitive?.contentOrNull(),
        avatarUrl = obj["avatar_url"]?.jsonPrimitive?.contentOrNull(),
    )
}

data class Invitation(val id: String, val classId: String, val className: String?, val expiresAt: String?)

data class AcademicContext(val semester: String, val academicYear: String)

/** Pending class invitations filtered by the user's email (web parity). */
suspend fun loadInvitations(userId: String, email: String?): List<Invitation> {
    if (email.isNullOrBlank()) return emptyList()

    val db = SupabaseProvider.client.postgrest
    val now = java.time.Instant.now().toString()
    val rows = db.from("class_invitations").select {
        filter {
            ilike("email_restriction", email.trim())
            filter("revoked_at", FilterOperator.IS, null)
            gt("expires_at", now)
        }
        limit(20)
    }.decodeJsonArray()

    val valid = rows.filter {
        val used = it.jsonObject["used_count"]?.jsonPrimitive?.content?.toIntOrNull() ?: 0
        val max = it.jsonObject["max_uses"]?.jsonPrimitive?.content?.toIntOrNull() ?: Int.MAX_VALUE
        used < max
    }

    val invitationIds = valid.mapNotNull { it.jsonObject["id"]?.jsonPrimitive?.content }
    if (invitationIds.isEmpty()) return emptyList()

    val classIds = valid.mapNotNull { it.jsonObject["class_id"]?.jsonPrimitive?.content }.toSet()
    val memberships = db.from("class_members").select {
        filter {
            eq("user_id", userId)
            isIn("class_id", classIds.toList())
        }
    }.decodeJsonArray()
    val memberClassIds = memberships.mapNotNull { it.jsonObject["class_id"]?.jsonPrimitive?.content }.toSet()

    val acceptances = db.from("class_invitation_acceptances").select {
        filter {
            eq("user_id", userId)
            isIn("invitation_id", invitationIds)
        }
    }.decodeJsonArray()
    val acceptedIds = acceptances.mapNotNull { it.jsonObject["invitation_id"]?.jsonPrimitive?.content }.toSet()

    val declines = db.from("class_invitation_declines").select {
        filter {
            eq("user_id", userId)
            isIn("invitation_id", invitationIds)
        }
    }.decodeJsonArray()
    val declinedIds = declines.mapNotNull { it.jsonObject["invitation_id"]?.jsonPrimitive?.content }.toSet()

    val classNames = if (classIds.isEmpty()) emptyMap() else {
        db.from("classes").select {
            filter { isIn("id", classIds.toList()) }
        }.decodeJsonArray().associateBy(
            { it.jsonObject["id"]!!.jsonPrimitive.content },
            { it.jsonObject["name"]?.jsonPrimitive?.contentOrNull() },
        )
    }

    return valid.mapNotNull {
        val obj = it.jsonObject
        val id = obj["id"]?.jsonPrimitive?.content ?: return@mapNotNull null
        val classId = obj["class_id"]?.jsonPrimitive?.content ?: return@mapNotNull null
        if (classId in memberClassIds || id in acceptedIds || id in declinedIds) return@mapNotNull null
        Invitation(
            id = id,
            classId = classId,
            className = classNames[classId],
            expiresAt = obj["expires_at"]?.jsonPrimitive?.contentOrNull(),
        )
    }
}

/** Most common semester/year across the user's active classes. */
suspend fun loadAcademicContext(userId: String): AcademicContext? {
    val db = SupabaseProvider.client.postgrest
    val memberships = db.from("class_members").select {
        filter { eq("user_id", userId) }
    }.decodeJsonArray().mapNotNull { it.jsonObject["class_id"]?.jsonPrimitive?.content }
    if (memberships.isEmpty()) return null

    val rows = db.from("classes").select {
        filter {
            isIn("id", memberships)
            eq("status", "active")
        }
    }.decodeJsonArray()

    val context = rows.groupBy {
        (it.jsonObject["semester"]?.jsonPrimitive?.contentOrNull() ?: "") to
            (it.jsonObject["academic_year"]?.jsonPrimitive?.contentOrNull() ?: "")
    }.maxByOrNull { it.value.size }?.key ?: return null

    return AcademicContext(semester = context.first, academicYear = context.second)
}

// ---------------------------------------------------------------------------
// Attendance: GPS check-in (full params), history, recap.
// Mirrors the web checkin module: the check_in_attendance_meeting RPC
// re-validates membership, session state, window, identity, accuracy
// and radius server-side; the client only captures position + identity.
// ---------------------------------------------------------------------------

// Check-in capture + RPC lives in CheckIn.kt (canonical). The offline
// queue retry below reuses it with stored positions.

/** Retry every queued check-in; returns how many the server accepted. */
suspend fun syncQueuedCheckIns(context: android.content.Context): Int {
    val (synced, _) = syncOfflineQueue(context) { item ->
        checkInToSession(
            item.userId,
            item.sessionId,
            item.latitude,
            item.longitude,
            item.accuracyM,
        ).ok
    }
    return synced
}

data class AttendanceHistoryEntry(
    val sessionId: String,
    val title: String,
    val startsAt: String,
    val className: String?,
    val status: String,
    val checkedInAt: String?,
)

suspend fun loadAttendanceHistory(userId: String): List<AttendanceHistoryEntry> {
    val db = SupabaseProvider.client.postgrest
    val checkIns = db.from("discussion_session_checkins").select {
        filter { eq("user_id", userId) }
        order("checked_in_at", io.github.jan.supabase.postgrest.query.Order.DESCENDING)
        limit(100)
    }.decodeJsonArray()

    if (checkIns.isEmpty()) return emptyList()

    val sessionIds = checkIns.mapNotNull { it.jsonObject["session_id"]?.jsonPrimitive?.content }.toSet()
    val sessions = db.from("discussion_sessions").select {
        filter { isIn("id", sessionIds.toList()) }
    }.decodeJsonArray().associateBy(
        { it.jsonObject["id"]!!.jsonPrimitive.content },
        { it.jsonObject },
    )

    val classIds = sessions.values.mapNotNull { it["class_id"]?.jsonPrimitive?.content }.toSet()
    val names = if (classIds.isEmpty()) emptyMap() else {
        db.from("classes").select {
            filter { isIn("id", classIds.toList()) }
        }.decodeJsonArray().associateBy(
            { it.jsonObject["id"]!!.jsonPrimitive.content },
            { it.jsonObject["name"]?.jsonPrimitive?.contentOrNull() },
        )
    }

    return checkIns.mapNotNull {
        val obj = it.jsonObject
        val sessionObj = sessions[obj["session_id"]?.jsonPrimitive?.content]
            ?: return@mapNotNull null
        AttendanceHistoryEntry(
            sessionId = sessionObj["id"]?.jsonPrimitive?.content ?: return@mapNotNull null,
            title = sessionObj["title"]?.jsonPrimitive?.contentOrNull() ?: "Session",
            startsAt = sessionObj["starts_at"]?.jsonPrimitive?.contentOrNull() ?: "",
            className = sessionObj["class_id"]?.jsonPrimitive?.contentOrNull()?.let(names::get),
            status = obj["status"]?.jsonPrimitive?.contentOrNull() ?: "present",
            checkedInAt = obj["checked_in_at"]?.jsonPrimitive?.contentOrNull(),
        )
    }
}

data class RecapSummary(
    val present: Int,
    val absent: Int,
    val excused: Int,
    val total: Int,
    val percentage: Int,
)

/**
 * Semester recap for the signed-in student, computed client-side from
 * their own check-ins (the class_attendance_recap RPC is class-manager
 * only, so students get their personal summary instead of the sheet).
 *
 * Attendance corrections (record_attendance_correction) and the correction
 * audit list are likewise organizer-only server-side — the web student UI
 * does not expose them either, so native does not either. Verification
 * attempts are recorded server-side by the check-in RPC itself.
 */
fun summarizeRecap(history: List<AttendanceHistoryEntry>): RecapSummary {
    val present = history.count { it.status == "present" }
    val excused = history.count { it.status == "excused" }
    val absent = history.count { it.status == "absent" }
    val total = history.size
    val percentage = if (total > 0) (present + excused) * 100 / total else 0
    return RecapSummary(present, absent, excused, total, percentage)
}
