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

data class DashboardClass(
    val id: String,
    val name: String,
    val slug: String = "",
    val semester: String = "",
    val academicYear: String = "",
    val subjectCount: Int = 0,
    val taskCount: Int = 0,
    val isAdmin: Boolean = false,
    val adminName: String? = null,
)

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
        DashboardClass(
            id = id,
            name = name,
            slug = obj["slug"]?.jsonPrimitive?.contentOrNull() ?: "",
            semester = obj["semester"]?.jsonPrimitive?.contentOrNull() ?: "",
            academicYear = obj["academic_year"]?.jsonPrimitive?.contentOrNull() ?: "",
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

data class Invitation(
    val id: String,
    val classId: String,
    val className: String?,
    val expiresAt: String?,
    val adminName: String? = null,
    val classSlug: String? = null,
)

/** Same SECURITY DEFINER RPCs the web invitation API calls. */
suspend fun acceptPendingInvitation(invitationId: String) {
    SupabaseProvider.client.postgrest.rpc(
        "accept_pending_invitation",
        kotlinx.serialization.json.buildJsonObject {
            put("p_invitation_id", kotlinx.serialization.json.JsonPrimitive(invitationId))
        },
    )
}

suspend fun declineInvitation(invitationId: String) {
    SupabaseProvider.client.postgrest.rpc(
        "decline_class_invitation",
        kotlinx.serialization.json.buildJsonObject {
            put("p_invitation_id", kotlinx.serialization.json.JsonPrimitive(invitationId))
        },
    )
}

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

    val classNames: List<kotlinx.serialization.json.JsonElement> = if (classIds.isEmpty()) {
        emptyList()
    } else {
        db.from("classes").select(Columns.raw("id,name,slug,created_by")) {
            filter { isIn("id", classIds.toList()) }
        }.decodeJsonArray()
    }
    val classNameById = classNames.associateBy(
        { it.jsonObject["id"]!!.jsonPrimitive.content },
        { it.jsonObject["name"]?.jsonPrimitive?.contentOrNull() },
    )
    val classSlugById = classNames.associateBy(
        { it.jsonObject["id"]!!.jsonPrimitive.content },
        { it.jsonObject["slug"]?.jsonPrimitive?.contentOrNull() },
    )
    val creatorNames = run {
        val byClass = classNames.mapNotNull {
            val cid = it.jsonObject["id"]?.jsonPrimitive?.content
            val uid = it.jsonObject["created_by"]?.jsonPrimitive?.contentOrNull()
            if (cid != null && uid != null) cid to uid else null
        }.toMap()
        if (byClass.isEmpty()) {
            emptyMap<String, String>()
        } else {
            db.from("profiles").select(Columns.raw("id,display_name")) {
                filter { isIn("id", byClass.values.toList()) }
            }.decodeJsonArray().associateBy(
                { row -> row.jsonObject["id"]!!.jsonPrimitive.content },
                { row -> row.jsonObject["display_name"]?.jsonPrimitive?.contentOrNull() },
            ).let { names -> byClass.mapValues { (_, uid) -> names[uid] } }
        }
    }

    return valid.mapNotNull {
        val obj = it.jsonObject
        val id = obj["id"]?.jsonPrimitive?.content ?: return@mapNotNull null
        val classId = obj["class_id"]?.jsonPrimitive?.content ?: return@mapNotNull null
        if (classId in memberClassIds || id in acceptedIds || id in declinedIds) return@mapNotNull null
        Invitation(
            id = id,
            classId = classId,
            className = classNameById[classId],
            expiresAt = obj["expires_at"]?.jsonPrimitive?.contentOrNull(),
            adminName = creatorNames[classId] ?: "Class Admin",
            classSlug = classSlugById[classId],
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
// Next schedule: nearest upcoming deadline-or-session (web getNextSchedule).
// ---------------------------------------------------------------------------

data class NextScheduleItem(
    val kind: String, // "assignment" | "session"
    val title: String,
    val className: String,
    val at: String,
    val endsAt: String?,
    val detail: String,
)

suspend fun loadNextSchedule(userId: String): NextScheduleItem? {
    val db = SupabaseProvider.client.postgrest
    val memberships = db.from("class_members").select {
        filter { eq("user_id", userId) }
    }.decodeJsonArray().mapNotNull { it.jsonObject["class_id"]?.jsonPrimitive?.content }
    if (memberships.isEmpty()) return null

    val activeClasses = db.from("classes").select {
        filter {
            isIn("id", memberships)
            eq("status", "active")
        }
    }.decodeJsonArray()
    val classIds = activeClasses.mapNotNull { it.jsonObject["id"]?.jsonPrimitive?.content }
    if (classIds.isEmpty()) return null
    val classNames = activeClasses.associateBy(
        { it.jsonObject["id"]!!.jsonPrimitive.content },
        { it.jsonObject["name"]?.jsonPrimitive?.contentOrNull() },
    )

    val nowIso = java.time.Instant.now().toString()

    val subjectCourseRows = db.from("class_subjects").select(Columns.raw("course_id")) {
        filter { isIn("class_id", classIds) }
    }.decodeJsonArray()
    val courseIds = subjectCourseRows.mapNotNull {
        it.jsonObject["course_id"]?.jsonPrimitive?.contentOrNull()
    }.distinct()

    val scopedTasks = db.from("assignments").select {
        filter {
            isIn("class_id", classIds)
            eq("status", "published")
            filter("deadline", FilterOperator.IS, null)
            gte("deadline", nowIso)
        }
        order("deadline", io.github.jan.supabase.postgrest.query.Order.ASCENDING)
        limit(5)
    }.decodeJsonArray()

    val publicTasks = if (courseIds.isEmpty()) {
        emptyList()
    } else {
        db.from("assignments").select {
            filter {
                filter("class_id", FilterOperator.IS, null)
                filter("subject_id", FilterOperator.IS, null)
                isIn("course_id", courseIds)
                eq("status", "published")
                filter("deadline", FilterOperator.IS, null)
                gte("deadline", nowIso)
            }
            order("deadline", io.github.jan.supabase.postgrest.query.Order.ASCENDING)
            limit(5)
        }.decodeJsonArray()
    }

    val sessions = db.from("discussion_sessions").select {
        filter {
            isIn("class_id", classIds)
            eq("status", "scheduled")
            gte("starts_at", nowIso)
        }
        order("starts_at", io.github.jan.supabase.postgrest.query.Order.ASCENDING)
        limit(5)
    }.decodeJsonArray()

    val courseNames = if (publicTasks.isEmpty()) {
        emptyMap<String, String?>()
    } else {
        db.from("courses").select(Columns.raw("id,name")) {
            filter {
                isIn(
                    "id",
                    publicTasks.mapNotNull {
                        it.jsonObject["course_id"]?.jsonPrimitive?.contentOrNull()
                    }.distinct(),
                )
            }
        }.decodeJsonArray().associateBy(
            { row -> row.jsonObject["id"]!!.jsonPrimitive.content },
            { row -> row.jsonObject["name"]?.jsonPrimitive?.contentOrNull() },
        )
    }

    val candidates = buildList {
        scopedTasks.forEach { row ->
            val obj = row.jsonObject
            val deadline = obj["deadline"]?.jsonPrimitive?.contentOrNull() ?: return@forEach
            add(
                NextScheduleItem(
                    kind = "assignment",
                    title = obj["title"]?.jsonPrimitive?.contentOrNull() ?: "Assignment",
                    className = classNames[obj["class_id"]?.jsonPrimitive?.contentOrNull()] ?: "Class",
                    at = deadline,
                    endsAt = null,
                    detail = "Deadline",
                ),
            )
        }
        publicTasks.forEach { row ->
            val obj = row.jsonObject
            val deadline = obj["deadline"]?.jsonPrimitive?.contentOrNull() ?: return@forEach
            add(
                NextScheduleItem(
                    kind = "assignment",
                    title = obj["title"]?.jsonPrimitive?.contentOrNull() ?: "Assignment",
                    className = courseNames[obj["course_id"]?.jsonPrimitive?.contentOrNull()] ?: "Course",
                    at = deadline,
                    endsAt = null,
                    detail = "Deadline",
                ),
            )
        }
        sessions.forEach { row ->
            val obj = row.jsonObject
            val startsAt = obj["starts_at"]?.jsonPrimitive?.contentOrNull() ?: return@forEach
            add(
                NextScheduleItem(
                    kind = "session",
                    title = obj["title"]?.jsonPrimitive?.contentOrNull() ?: "Session",
                    className = classNames[obj["class_id"]?.jsonPrimitive?.contentOrNull()] ?: "Class",
                    at = startsAt,
                    endsAt = obj["ends_at"]?.jsonPrimitive?.contentOrNull(),
                    detail = if (obj["session_type"]?.jsonPrimitive?.contentOrNull() == "online") "Online session" else "Session",
                ),
            )
        }
    }

    fun instantOf(iso: String): java.time.Instant = try {
        java.time.Instant.parse(iso)
    } catch (_: Exception) {
        try {
            java.time.OffsetDateTime.parse(iso).toInstant()
        } catch (_: Exception) {
            java.time.Instant.MAX
        }
    }

    return candidates.sortedBy { instantOf(it.at) }.firstOrNull()
}

// ---------------------------------------------------------------------------
// Academic identity card (web AcademicContextCard): university + student id
// + home class, with the "not linked" state. Semester/year stays on each
// class row in My classes.
// ---------------------------------------------------------------------------

data class AcademicCard(
    val linked: Boolean,
    val universityName: String? = null,
    val studentId: String? = null,
    val homeClassName: String? = null,
)

suspend fun loadAcademicCard(userId: String): AcademicCard? {
    val db = SupabaseProvider.client.postgrest
    val memberships = try {
        db.from("university_memberships").select {
            order("created_at", io.github.jan.supabase.postgrest.query.Order.ASCENDING)
        }.decodeJsonArray()
    } catch (_: Exception) {
        return null
    }

    val active = memberships.filter {
        it.jsonObject["status"]?.jsonPrimitive?.contentOrNull() == "active"
    }
    // Web resolves identity only when exactly one active membership exists.
    if (active.size != 1) return AcademicCard(linked = false)

    val onlyActive = active.single()
    val universityId = onlyActive.jsonObject["university_id"]?.jsonPrimitive?.contentOrNull()
        ?: return AcademicCard(linked = false)

    val university = try {
        db.from("universities").select {
            filter { eq("id", universityId) }
            limit(1)
        }.decodeJsonArray().firstOrNull()?.jsonObject
    } catch (_: Exception) {
        null
    }
    if (university == null || university["status"]?.jsonPrimitive?.contentOrNull() != "active") {
        return AcademicCard(linked = false)
    }
    val universityName = university["short_name"]?.jsonPrimitive?.contentOrNull()
        ?: university["name"]?.jsonPrimitive?.contentOrNull()
        ?: return AcademicCard(linked = false)

    val identities = try {
        db.from("student_identities").select {
            filter { eq("university_membership_id", onlyActive.jsonObject["id"]!!.jsonPrimitive.content) }
        }.decodeJsonArray()
    } catch (_: Exception) {
        emptyList()
    }
    val studentId = identities.firstOrNull()?.jsonObject?.get("student_id")?.jsonPrimitive?.contentOrNull()

    val homeClassName = run {
        val identityIds = identities.mapNotNull { it.jsonObject["id"]?.jsonPrimitive?.content }
        if (identityIds.isEmpty()) {
            null
        } else {
            try {
                val home = db.from("class_memberships").select(Columns.raw("class_id")) {
                    filter {
                        isIn("student_identity_id", identityIds)
                        eq("is_home", true)
                        filter("left_at", FilterOperator.IS, null)
                    }
                    limit(1)
                }.decodeJsonArray().firstOrNull()
                val homeClassId = home?.jsonObject?.get("class_id")?.jsonPrimitive?.contentOrNull()
                if (homeClassId == null) {
                    null
                } else {
                    db.from("classes").select(Columns.raw("name")) {
                        filter { eq("id", homeClassId) }
                        limit(1)
                    }.decodeJsonArray().firstOrNull()?.jsonObject?.get("name")?.jsonPrimitive?.contentOrNull()
                }
            } catch (_: Exception) {
                null
            }
        }
    }

    return AcademicCard(
        linked = true,
        universityName = universityName,
        studentId = studentId,
        homeClassName = homeClassName,
    )
}

fun formatDateShort(iso: String): String =
    try {
        java.time.OffsetDateTime.parse(iso)
            .atZoneSameInstant(java.time.ZoneId.of("Asia/Jakarta"))
            .format(java.time.format.DateTimeFormatter.ofPattern("EEE, d MMM yyyy"))
    } catch (_: Exception) {
        iso.take(10)
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
