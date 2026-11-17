package id.starstask.mobile.data

import io.github.jan.supabase.postgrest.postgrest
import io.github.jan.supabase.postgrest.query.Columns
import io.github.jan.supabase.postgrest.query.Order
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put

// Platform-admin console data (web admin routes). All writes go through
// SECURITY DEFINER RPCs that re-check is_platform_admin server-side.

data class PlatformOverview(
    val activeClasses: Long, val archivedClasses: Long, val totalUsers: Long,
    val pendingApplications: Long, val approvedApplications: Long, val rejectedApplications: Long,
    val pendingReviews: Long, val pendingVerifications: Long, val platformAdmins: Long,
    val publishedAssignments: Long, val unpublishedAssignments: Long, val onboardedUsers: Long,
)

suspend fun loadPlatformOverview(): PlatformOverview? {
    val row = SupabaseProvider.client.postgrest.rpc("get_platform_admin_overview", buildJsonObject {})
        .decodeJsonArray().firstOrNull()?.jsonObject ?: return null
    fun n(k: String) = row[k]?.jsonPrimitive?.contentOrNull()?.toLongOrNull() ?: 0L
    return PlatformOverview(
        activeClasses = n("active_classes"), archivedClasses = n("archived_classes"),
        totalUsers = n("total_users"), pendingApplications = n("pending_applications"),
        approvedApplications = n("approved_applications"), rejectedApplications = n("rejected_applications"),
        pendingReviews = n("pending_reviews"), pendingVerifications = n("pending_verifications"),
        platformAdmins = n("platform_admins"), publishedAssignments = n("published_assignments"),
        unpublishedAssignments = n("unpublished_assignments"), onboardedUsers = n("onboarded_users"),
    )
}

data class PlatformClass(
    val id: String, val name: String, val slug: String, val status: String,
    val academicYear: String?, val semester: String?, val memberCount: Long, val adminCount: Long,
)

suspend fun listPlatformClasses(search: String = "", limit: Int = 50): List<PlatformClass> {
    val rows = SupabaseProvider.client.postgrest.rpc(
        "list_platform_classes",
        buildJsonObject {
            put("p_limit", JsonPrimitive(limit))
            put("p_offset", JsonPrimitive(0))
            if (search.isNotBlank()) put("p_search", JsonPrimitive(search.trim())) else put("p_search", JsonNull)
            put("p_academic_year", JsonNull); put("p_semester", JsonNull); put("p_status", JsonNull)
        },
    ).decodeJsonArray()
    return rows.mapNotNull {
        val o = it.jsonObject
        val id = o["id"]?.jsonPrimitive?.contentOrNull() ?: return@mapNotNull null
        PlatformClass(
            id = id, name = o["name"]?.jsonPrimitive?.contentOrNull() ?: "Class",
            slug = o["slug"]?.jsonPrimitive?.contentOrNull() ?: "",
            status = o["status"]?.jsonPrimitive?.contentOrNull() ?: "",
            academicYear = o["academic_year"]?.jsonPrimitive?.contentOrNull(),
            semester = o["semester"]?.jsonPrimitive?.contentOrNull(),
            memberCount = o["member_count"]?.jsonPrimitive?.contentOrNull()?.toLongOrNull() ?: 0L,
            adminCount = o["admin_count"]?.jsonPrimitive?.contentOrNull()?.toLongOrNull() ?: 0L,
        )
    }
}

data class PlatformUser(
    val id: String, val displayName: String?, val isPlatformAdmin: Boolean,
    val classCount: Long, val adminClassCount: Long, val createdAt: String?,
)

suspend fun listPlatformUsers(search: String = "", limit: Int = 50): List<PlatformUser> {
    val rows = SupabaseProvider.client.postgrest.rpc(
        "list_platform_users",
        buildJsonObject {
            put("p_limit", JsonPrimitive(limit))
            put("p_offset", JsonPrimitive(0))
            if (search.isNotBlank()) put("p_search", JsonPrimitive(search.trim())) else put("p_search", JsonNull)
            put("p_onboarding", JsonNull); put("p_role", JsonNull)
        },
    ).decodeJsonArray()
    return rows.mapNotNull {
        val o = it.jsonObject
        val id = o["id"]?.jsonPrimitive?.contentOrNull() ?: return@mapNotNull null
        PlatformUser(
            id = id, displayName = o["display_name"]?.jsonPrimitive?.contentOrNull(),
            isPlatformAdmin = o["is_platform_admin"]?.jsonPrimitive?.content == "true",
            classCount = o["class_count"]?.jsonPrimitive?.contentOrNull()?.toLongOrNull() ?: 0L,
            adminClassCount = o["admin_class_count"]?.jsonPrimitive?.contentOrNull()?.toLongOrNull() ?: 0L,
            createdAt = o["created_at"]?.jsonPrimitive?.contentOrNull(),
        )
    }
}

data class ClassApplicationRow(
    val id: String, val slug: String, val name: String, val courseName: String?,
    val status: String, val createdAt: String?,
)

/** Best-effort: applications table is RLS-gated to platform admins. */
suspend fun listClassApplications(status: String? = null): List<ClassApplicationRow> {
    val rows = SupabaseProvider.client.postgrest.from("class_applications")
        .select(Columns.list("id", "proposed_slug", "proposed_name", "course_name", "status", "created_at")) {
            if (status != null) filter { eq("status", status) }
            order("created_at", Order.DESCENDING); limit(50)
        }.decodeJsonArray()
    return rows.mapNotNull {
        val o = it.jsonObject
        val id = o["id"]?.jsonPrimitive?.contentOrNull() ?: return@mapNotNull null
        ClassApplicationRow(
            id = id, slug = o["proposed_slug"]?.jsonPrimitive?.contentOrNull() ?: "",
            name = o["proposed_name"]?.jsonPrimitive?.contentOrNull() ?: "",
            courseName = o["course_name"]?.jsonPrimitive?.contentOrNull(),
            status = o["status"]?.jsonPrimitive?.contentOrNull() ?: "",
            createdAt = o["created_at"]?.jsonPrimitive?.contentOrNull(),
        )
    }
}

suspend fun decideClassApplication(applicationId: String, decision: String, note: String? = null): String? {
    val err = runCatching {
        SupabaseProvider.client.postgrest.rpc(
            "decide_class_application",
            buildJsonObject {
                put("p_application_id", JsonPrimitive(applicationId))
                put("p_decision", JsonPrimitive(decision))
                if (note.isNullOrBlank()) put("p_note", JsonNull) else put("p_note", JsonPrimitive(note))
                put("p_grant_class_admin", JsonPrimitive(true))
            },
        )
    }.exceptionOrNull()
    return err?.let { userFacingMessage(it) }
}

data class VerificationRow(val id: String, val classId: String?, val status: String, val createdAt: String?)

/** Best-effort list of verification requests (RLS-gated to platform admins). */
suspend fun listVerificationRequests(status: String? = null): List<VerificationRow> {
    val rows = runCatching {
        SupabaseProvider.client.postgrest.from("class_verification_requests")
            .select(Columns.list("id", "class_id", "status", "created_at")) {
                if (status != null) filter { eq("status", status) }
                order("created_at", Order.DESCENDING); limit(50)
            }.decodeJsonArray()
    }.getOrDefault(kotlinx.serialization.json.JsonArray(emptyList()))
    return rows.mapNotNull {
        val o = it.jsonObject
        val id = o["id"]?.jsonPrimitive?.contentOrNull() ?: return@mapNotNull null
        VerificationRow(id, o["class_id"]?.jsonPrimitive?.contentOrNull(), o["status"]?.jsonPrimitive?.contentOrNull() ?: "", o["created_at"]?.jsonPrimitive?.contentOrNull())
    }
}

suspend fun decideVerification(requestId: String, decision: String, note: String? = null): String? {
    val err = runCatching {
        SupabaseProvider.client.postgrest.rpc(
            "decide_class_verification",
            buildJsonObject {
                put("p_request_id", JsonPrimitive(requestId))
                put("p_decision", JsonPrimitive(decision))
                if (note.isNullOrBlank()) put("p_note", JsonNull) else put("p_note", JsonPrimitive(note))
            },
        )
    }.exceptionOrNull()
    return err?.let { userFacingMessage(it) }
}

suspend fun revokeCourseInvite(tokenId: String): String? {
    // Mirrors web admin/course-invites/[tokenId]/revoke — table invite_tokens/courses.
    val err = runCatching {
        SupabaseProvider.client.postgrest.from("course_invite_tokens")
            .update(buildJsonObject { put("revoked_at", JsonPrimitive(java.time.Instant.now().toString())) }) {
                filter { eq("id", tokenId) }
            }
    }.exceptionOrNull()
    return err?.let { userFacingMessage(it) }
}
