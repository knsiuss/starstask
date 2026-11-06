package id.starstask.mobile.data

import io.github.jan.supabase.postgrest.postgrest
import io.github.jan.supabase.postgrest.query.Columns
import io.github.jan.supabase.postgrest.query.filter.FilterOperator
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put


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

