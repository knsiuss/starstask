package id.starstask.mobile.data

import android.content.Context
import io.github.jan.supabase.auth.auth
import io.github.jan.supabase.postgrest.postgrest
import io.github.jan.supabase.postgrest.query.Order
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put

/**
 * Native E2EE DM data layer mirroring web direct-messages.ts + e2ee.ts.
 * Ciphertext only in the server; decryption happens on-device with the
 * device keypair from DmKeys.
 */

data class DmMessage(
    val id: String,
    val senderId: String,
    val plaintext: String?,
    val createdAt: String,
    val editedAt: String?,
)

data class DmConversation(
    val id: String,
    val otherUserId: String,
    val otherName: String,
    val lastPlaintext: String?,
    val lastAt: String?,
    val unreadCount: Int,
)

data class DmUser(val id: String, val displayName: String, val avatarUrl: String?)

suspend fun listDmConversations(context: Context, userId: String): List<DmConversation> {
    val db = SupabaseProvider.client.postgrest
    ensurePublishedDeviceKey(context, userId)
    val self = getOrCreateDeviceKeyPair(context)

    val participants = db.from("dm_participants").select {
        filter { eq("user_id", userId) }
        order("last_read_at", Order.DESCENDING)
    }.decodeJsonArray()

    val conversationIds = participants.mapNotNull {
        it.jsonObject["conversation_id"]?.jsonPrimitive?.content
    }.distinct()
    if (conversationIds.isEmpty()) return emptyList()

    val others = db.from("dm_participants").select {
        filter {
            isIn("conversation_id", conversationIds)
            neq("user_id", userId)
        }
    }.decodeJsonArray()

    val byConversation = others.groupBy {
        it.jsonObject["conversation_id"]?.jsonPrimitive?.content ?: ""
    }
    val otherIds = others.mapNotNull {
        it.jsonObject["user_id"]?.jsonPrimitive?.content
    }.distinct()

    val names = if (otherIds.isEmpty()) emptyMap<String, String>() else {
        db.from("profiles").select {
            filter { isIn("id", otherIds) }
        }.decodeJsonArray().associateBy(
            { it.jsonObject["id"]!!.jsonPrimitive.content },
            { it.jsonObject["display_name"]?.jsonPrimitive?.contentOrNull() ?: "User" },
        )
    }
    val keys = if (otherIds.isEmpty()) emptyMap<String, String>() else {
        db.from("dm_keys").select {
            filter { isIn("user_id", otherIds) }
        }.decodeJsonArray().associateBy(
            { it.jsonObject["user_id"]!!.jsonPrimitive.content },
            { it.jsonObject["public_key"]?.jsonPrimitive?.contentOrNull() ?: "" },
        )
    }
    val lastRows = db.from("dm_messages").select {
        filter {
            isIn("conversation_id", conversationIds)
            filter("deleted_at", io.github.jan.supabase.postgrest.query.filter.FilterOperator.IS, JsonNull)
        }
        order("created_at", Order.DESCENDING)
        limit(500)
    }.decodeJsonArray()
    val lastByConversation = mutableMapOf<String, kotlinx.serialization.json.JsonObject>()
    for (row in lastRows) {
        val cid = row.jsonObject["conversation_id"]?.jsonPrimitive?.content ?: continue
        if (cid !in lastByConversation) lastByConversation[cid] = row.jsonObject
    }
    val unreadByConversation: Map<String, Int> = lastRows.groupingBy {
        it.jsonObject["conversation_id"]?.jsonPrimitive?.content ?: ""
    }.eachCount()

    return conversationIds.mapNotNull { conversationId ->
        val otherRow = byConversation[conversationId]?.firstOrNull() ?: return@mapNotNull null
        val otherId = otherRow.jsonObject["user_id"]?.jsonPrimitive?.content ?: return@mapNotNull null
        val last = lastByConversation[conversationId]
        val plaintext = try {
            val peerKey = keys[otherId]
            val body = last?.get("body")?.jsonPrimitive?.content
            if (peerKey != null && body != null) {
                decryptDmMessage(self, peerKey, body, conversationId, last.get("sender_id")!!.jsonPrimitive.content)
            } else null
        } catch (_: Exception) {
            null
        }
        DmConversation(
            id = conversationId,
            otherUserId = otherId,
            otherName = names[otherId] ?: "User",
            lastPlaintext = plaintext,
            lastAt = last?.get("created_at")?.jsonPrimitive?.contentOrNull(),
            unreadCount = unreadByConversation[conversationId] ?: 0,
        )
    }
}

suspend fun loadDmMessages(
    context: Context,
    conversationId: String,
    senderNameFor: (String) -> String = { it },
): List<DmMessage> {
    val db = SupabaseProvider.client.postgrest
    val rows = db.from("dm_messages").select {
        filter {
            eq("conversation_id", conversationId)
            filter("deleted_at", io.github.jan.supabase.postgrest.query.filter.FilterOperator.IS, JsonNull)
        }
        order("created_at", Order.DESCENDING)
        limit(100)
    }.decodeJsonArray().reversed()

    val senderIds = rows.mapNotNull {
        it.jsonObject["sender_id"]?.jsonPrimitive?.content
    }.distinct()
    // Peer key = the other participant's key (1:1 conversations).
    val myId = SupabaseProvider.client.auth.currentUserOrNull()?.id ?: ""
    val peerId = senderIds.firstOrNull { it != myId } ?: senderIds.firstOrNull() ?: ""
    val peerKey = if (peerId.isNotEmpty()) {
        db.from("dm_keys").select {
            filter { eq("user_id", peerId) }
            limit(1)
        }.decodeJsonArray().firstOrNull()?.jsonObject?.get("public_key")?.jsonPrimitive?.contentOrNull()
    } else null
    val self = getOrCreateDeviceKeyPair(context)

    return rows.map { row ->
        val obj = row.jsonObject
        val senderId = obj["sender_id"]?.jsonPrimitive?.content ?: ""
        val body = obj["body"]?.jsonPrimitive?.content ?: ""
        val plaintext = try {
            if (peerKey != null) decryptDmMessage(self, peerKey, body, conversationId, senderId) else null
        } catch (_: Exception) {
            null
        }
        DmMessage(
            id = obj["id"]?.jsonPrimitive?.content ?: "",
            senderId = senderId,
            plaintext = plaintext,
            createdAt = obj["created_at"]?.jsonPrimitive?.contentOrNull() ?: "",
            editedAt = obj["edited_at"]?.jsonPrimitive?.contentOrNull(),
        )
    }
}

suspend fun sendDmMessage(context: Context, userId: String, conversationId: String, plaintext: String): String {
    val db = SupabaseProvider.client.postgrest
    ensurePublishedDeviceKey(context, userId)
    val peerId = db.from("dm_participants").select {
        filter {
            eq("conversation_id", conversationId)
            neq("user_id", userId)
        }
        limit(1)
    }.decodeJsonArray().firstOrNull()?.jsonObject?.get("user_id")?.jsonPrimitive?.content
        ?: throw IllegalStateException("Could not resolve peer")
    val peerKey = db.from("dm_keys").select {
        filter { eq("user_id", peerId) }
        limit(1)
    }.decodeJsonArray().firstOrNull()?.jsonObject?.get("public_key")?.jsonPrimitive?.contentOrNull()
        ?: throw IllegalStateException("Peer has no device key yet")
    val self = getOrCreateDeviceKeyPair(context)
    val ciphertext = encryptDmMessage(self, peerKey, plaintext, conversationId, userId)
    val inserted = db.from("dm_messages").insert(
        buildJsonObject {
            put("conversation_id", JsonPrimitive(conversationId))
            put("sender_id", JsonPrimitive(userId))
            put("body", JsonPrimitive(ciphertext))
        },
        request = { select() },
    ).decodeJsonArray().firstOrNull()?.jsonObject
    return inserted?.get("id")?.jsonPrimitive?.content ?: ""
}

suspend fun getOrCreateDmConversation(otherUserId: String): String {
    val result = SupabaseProvider.client.postgrest.rpc(
        "dm_get_or_create_conversation",
        buildJsonObject { put("p_other", JsonPrimitive(otherUserId)) },
    )
    return result.decodeJsonPrimitive().content
        ?: throw IllegalStateException("Could not open chat")
}

suspend fun searchDmUsers(userId: String, query: String): List<DmUser> {
    val normalized = query.trim().take(100)
    if (normalized.length < 2) return emptyList()
    val escaped = normalized.replace("%", "\\%").replace("_", "\\_")
    val rows = SupabaseProvider.client.postgrest.from("profiles").select {
        filter {
            ilike("display_name", "%$escaped%")
            neq("id", userId)
        }
        limit(10)
    }.decodeJsonArray()
    return rows.mapNotNull { row ->
        val obj = row.jsonObject
        val id = obj["id"]?.jsonPrimitive?.content ?: return@mapNotNull null
        DmUser(
            id = id,
            displayName = obj["display_name"]?.jsonPrimitive?.contentOrNull() ?: "User",
            avatarUrl = obj["avatar_url"]?.jsonPrimitive?.contentOrNull(),
        )
    }
}

/**
 * DM extras mirroring web lib/db/dm-v2.ts + direct-messages.ts
 * blockUser (dm_blocks insert; DB refuses chat if blocked).
 */

data class DmPrefs(val pinned: Boolean? = null, val muted: Boolean? = null, val archived: Boolean? = null)

suspend fun blockDmUser(blockedId: String, blockerId: String): String? {
    val err = runCatching {
        SupabaseProvider.client.postgrest.from("dm_blocks").insert(
            buildJsonObject {
                put("blocker_id", JsonPrimitive(blockerId))
                put("blocked_id", JsonPrimitive(blockedId))
            },
        )
    }.exceptionOrNull()
    return err?.message
}

suspend fun setDmConversationPrefs(conversationId: String, prefs: DmPrefs): String? {
    val err = runCatching {
        SupabaseProvider.client.postgrest.rpc(
            "dm_set_conversation_pref",
            buildJsonObject {
                put("p_conversation", JsonPrimitive(conversationId))
                prefs.pinned?.let { put("p_pinned", JsonPrimitive(it)) } ?: put("p_pinned", JsonNull)
                prefs.muted?.let { put("p_muted", JsonPrimitive(it)) } ?: put("p_muted", JsonNull)
                prefs.archived?.let { put("p_archived", JsonPrimitive(it)) } ?: put("p_archived", JsonNull)
            },
        )
    }.exceptionOrNull()
    return err?.message
}

suspend fun markDmUnread(conversationId: String): String? {
    val err = runCatching {
        SupabaseProvider.client.postgrest.rpc(
            "dm_mark_unread",
            buildJsonObject { put("p_conversation", JsonPrimitive(conversationId)) },
        )
    }.exceptionOrNull()
    return err?.message
}

suspend fun markDmRead(conversationId: String, userId: String) {
    SupabaseProvider.client.postgrest.from("dm_participants").update(
        buildJsonObject {
            put("last_read_at", JsonPrimitive(java.time.Instant.now().toString()))
        },
    ) {
        filter {
            eq("conversation_id", conversationId)
            eq("user_id", userId)
        }
    }
}
