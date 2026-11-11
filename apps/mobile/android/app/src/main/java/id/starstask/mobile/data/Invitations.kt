package id.starstask.mobile.data

import io.github.jan.supabase.postgrest.postgrest
import io.github.jan.supabase.postgrest.query.Columns
import io.github.jan.supabase.postgrest.query.filter.FilterOperator
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put
import kotlinx.serialization.Serializable


@Serializable
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
