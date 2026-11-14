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

data class Conversation(val id: String, val otherName: String, val unread: Boolean)

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



data class Assignment(val id: String, val title: String, val status: String, val deadline: String?, val className: String?)

data class ClassDetail(
    val id: String,
    val name: String,
    val slug: String,
    val semester: String,
    val academicYear: String,
    val memberCount: Int,
    val classCode: String = "",
    val isAdmin: Boolean = false,
    val status: String = "active",
    val courseName: String = "",
    val lecturerName: String = "",
)

data class SessionRow(val id: String, val title: String, val startsAt: String, val endsAt: String, val status: String, val className: String?)

@Serializable
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

suspend fun markAllNotificationsRead() {
    SupabaseProvider.client.postgrest.rpc(
        "mark_notification_events_read",
        kotlinx.serialization.json.buildJsonObject {},
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
