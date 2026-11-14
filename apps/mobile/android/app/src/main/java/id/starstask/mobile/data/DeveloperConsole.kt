package id.starstask.mobile.data

import io.github.jan.supabase.postgrest.postgrest
import io.github.jan.supabase.postgrest.query.Columns
import io.github.jan.supabase.postgrest.query.Order
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put

// Developer console data (web developer routes). All access is via SECURITY
// DEFINER RPCs that re-check is_platform_admin server-side.

data class DashboardMetrics(
    val activeUsers7: Long, val activeUsers30: Long, val signIns7: Long, val signIns30: Long,
    val registrations7: Long, val registrations30: Long, val totalUsers: Long, val totalAssignments: Long,
)

suspend fun loadDashboardMetrics(): DashboardMetrics? {
    val since7 = java.time.Instant.now().minusSeconds(7 * 86400).toString()
    val since30 = java.time.Instant.now().minusSeconds(30 * 86400).toString()
    val row = SupabaseProvider.client.postgrest.rpc(
        "developer_dashboard_metrics",
        buildJsonObject {
            put("p_since_7", JsonPrimitive(since7))
            put("p_since_30", JsonPrimitive(since30))
        },
    ).decodeJsonArray().firstOrNull()?.jsonObject ?: return null
    fun n(k: String) = row[k]?.jsonPrimitive?.contentOrNull()?.toLongOrNull() ?: 0L
    return DashboardMetrics(n("active_users_7"), n("active_users_30"), n("sign_ins_7"), n("sign_ins_30"), n("registrations_7"), n("registrations_30"), n("total_users"), n("total_assignments"))
}

data class ClassMetric(
    val classId: String, val name: String, val academicYear: String?, val semester: String?,
    val status: String, val memberCount: Long, val publishedCount: Long, val pendingReviewCount: Long,
    val lastActivityAt: String?,
)

suspend fun loadClassMetrics(limit: Int = 30): List<ClassMetric> {
    val rows = SupabaseProvider.client.postgrest.rpc(
        "developer_class_metrics",
        buildJsonObject { put("p_limit", JsonPrimitive(limit)) },
    ).decodeJsonArray()
    return rows.mapNotNull {
        val o = it.jsonObject
        val id = o["class_id"]?.jsonPrimitive?.contentOrNull() ?: return@mapNotNull null
        ClassMetric(
            classId = id, name = o["name"]?.jsonPrimitive?.contentOrNull() ?: "Class",
            academicYear = o["academic_year"]?.jsonPrimitive?.contentOrNull(),
            semester = o["semester"]?.jsonPrimitive?.contentOrNull(),
            status = o["status"]?.jsonPrimitive?.contentOrNull() ?: "",
            memberCount = o["member_count"]?.jsonPrimitive?.contentOrNull()?.toLongOrNull() ?: 0L,
            publishedCount = o["published_count"]?.jsonPrimitive?.contentOrNull()?.toLongOrNull() ?: 0L,
            pendingReviewCount = o["pending_review_count"]?.jsonPrimitive?.contentOrNull()?.toLongOrNull() ?: 0L,
            lastActivityAt = o["last_activity_at"]?.jsonPrimitive?.contentOrNull(),
        )
    }
}

data class PlatformUserRow(val id: String, val displayName: String?, val createdAt: String?, val lastSignInAt: String?)

suspend fun loadDeveloperUsers(limit: Int = 30): List<PlatformUserRow> {
    val rows = SupabaseProvider.client.postgrest.rpc(
        "developer_list_users",
        buildJsonObject {
            put("p_page", JsonPrimitive(1)); put("p_page_size", JsonPrimitive(limit))
            put("p_search", JsonNull); put("p_sort", JsonPrimitive("created_at")); put("p_direction", JsonPrimitive("desc"))
        },
    ).decodeJsonArray()
    return rows.mapNotNull {
        val o = it.jsonObject
        val id = o["id"]?.jsonPrimitive?.contentOrNull() ?: return@mapNotNull null
        PlatformUserRow(id, o["display_name"]?.jsonPrimitive?.contentOrNull(), o["created_at"]?.jsonPrimitive?.contentOrNull(), o["last_sign_in_at"]?.jsonPrimitive?.contentOrNull())
    }
}

data class IncidentRow(val id: String, val title: String?, val status: String?, val createdAt: String?)

/** Best-effort incidents list (RLS-gated to platform admins). */
suspend fun listDeveloperIncidents(): List<IncidentRow> {
    val rows = runCatching {
        SupabaseProvider.client.postgrest.from("developer_incidents")
            .select(Columns.list("id", "title", "status", "created_at")) {
                order("created_at", Order.DESCENDING); limit(30)
            }.decodeJsonArray()
    }.getOrDefault(kotlinx.serialization.json.JsonArray(emptyList()))
    return rows.mapNotNull {
        val o = it.jsonObject
        val id = o["id"]?.jsonPrimitive?.contentOrNull() ?: return@mapNotNull null
        IncidentRow(id, o["title"]?.jsonPrimitive?.contentOrNull(), o["status"]?.jsonPrimitive?.contentOrNull(), o["created_at"]?.jsonPrimitive?.contentOrNull())
    }
}
