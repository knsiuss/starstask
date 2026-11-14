package id.starstask.mobile.data

// Class invitations for the Invites screen. Only the SHA-256 digest ever leaves
// this file; the raw token is generated locally, returned once for the admin
// to copy, and never logged or persisted.

import io.github.jan.supabase.postgrest.postgrest
import io.github.jan.supabase.postgrest.query.Order
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put
import java.security.MessageDigest
import java.security.SecureRandom

data class ManagedInvite(
    val id: String,
    val expiresAt: String,
    val maxUses: Int,
    val usedCount: Int,
    val revokedAt: String?,
    val createdAt: String,
    val emailRestriction: String?,
) {
    val isRevoked: Boolean get() = revokedAt != null
    val isExpired: Boolean get() = runCatching {
        java.time.Instant.parse(expiresAt).isBefore(java.time.Instant.now())
    }.getOrDefault(false)
    val isActive: Boolean get() = !isRevoked && !isExpired
}

data class CreatedInvite(
    val id: String,
    val token: String,
    val expiresAt: String,
    val maxUses: Int,
)

suspend fun listClassInvites(classId: String): List<ManagedInvite> {
    val rows = SupabaseProvider.client.postgrest.from("class_invitations").select {
        filter { eq("class_id", classId) }
        order("created_at", Order.DESCENDING)
        limit(100)
    }.decodeJsonArray()
    return rows.mapNotNull { element ->
        val o = element.jsonObject
        val id = o["id"]?.jsonPrimitive?.contentOrNull() ?: return@mapNotNull null
        ManagedInvite(
            id = id,
            expiresAt = o["expires_at"]?.jsonPrimitive?.contentOrNull() ?: "",
            maxUses = o["max_uses"]?.jsonPrimitive?.contentOrNull()?.toIntOrNull() ?: 1,
            usedCount = o["used_count"]?.jsonPrimitive?.contentOrNull()?.toIntOrNull() ?: 0,
            revokedAt = o["revoked_at"]?.jsonPrimitive?.contentOrNull(),
            createdAt = o["created_at"]?.jsonPrimitive?.contentOrNull() ?: "",
            emailRestriction = o["email_restriction"]?.jsonPrimitive?.contentOrNull(),
        )
    }
}

/**
 * Creates one invitation link. The raw token is shown to the admin exactly
 * once (in memory); only its SHA-256 digest is stored server-side.
 */
suspend fun createClassInvite(
    classId: String,
    expiresInDays: Int,
    maxUses: Int,
    emailRestriction: String?,
): CreatedInvite {
    val token = generateInviteToken()
    val tokenHash = sha256Hex(token)
    val expiresAt = java.time.Instant.now()
        .plusSeconds(expiresInDays.toLong() * 24 * 60 * 60)
        .toString()
    val result = SupabaseProvider.client.postgrest.rpc(
        "create_class_invitation",
        buildJsonObject {
            put("p_class_id", JsonPrimitive(classId))
            put("p_token_hash", JsonPrimitive(tokenHash))
            put("p_expires_at", JsonPrimitive(expiresAt))
            put("p_max_uses", JsonPrimitive(maxUses))
            put("p_email_restriction", emailRestriction?.let(::JsonPrimitive)
                ?: kotlinx.serialization.json.JsonNull)
        },
    )
    return CreatedInvite(
        id = result.decodeJsonPrimitive().content,
        token = token,
        expiresAt = expiresAt,
        maxUses = maxUses,
    )
}

suspend fun revokeClassInvite(invitationId: String) {
    SupabaseProvider.client.postgrest.rpc(
        "revoke_class_invitation",
        buildJsonObject { put("p_invitation_id", JsonPrimitive(invitationId)) },
    )
}

private fun generateInviteToken(): String {
    val bytes = ByteArray(32)
    SecureRandom().nextBytes(bytes)
    return android.util.Base64.encodeToString(bytes, android.util.Base64.URL_SAFE or android.util.Base64.NO_PADDING or android.util.Base64.NO_WRAP)
}

private fun sha256Hex(input: String): String =
    MessageDigest.getInstance("SHA-256")
        .digest(input.toByteArray(Charsets.UTF_8))
        .joinToString("") { "%02x".format(it) }
