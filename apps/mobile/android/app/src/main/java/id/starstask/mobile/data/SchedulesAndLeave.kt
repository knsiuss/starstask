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

// LeaveRequest canonical model lives in LeaveRequests.kt (full web mirror).
// This alias kept for ScheduleLeaveScreens compat; use LeaveRequests.kt's
// data class for new code.

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

// loadLeaveRequests now lives in LeaveRequests.kt (web mirror with enrich).
// This duplicate was causing a redeclaration — removed.

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

