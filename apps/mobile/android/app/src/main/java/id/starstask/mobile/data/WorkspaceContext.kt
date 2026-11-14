package id.starstask.mobile.data

import io.github.jan.supabase.postgrest.postgrest
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive

/**
 * Single call for the small workspace layout fields (profile + unread
 * count + admin flags) so the dashboard shell does not pay "6 roundtrips"
 * before rendering. RPC is SECURITY DEFINER and reads auth.uid() itself;
 * no caller identity is sent. Failure returns null so callers can degrade
 * gracefully (the badge hides instead of blocking the screen).
 */
data class WorkspaceContext(
    val unreadNotifications: Int,
    val platformAdmin: Boolean = false,
    val classAdminAnywhere: Boolean = false,
    val betaTester: Boolean = false,
    val lecturerAnywhere: Boolean = false,
)

suspend fun loadWorkspaceContext(): WorkspaceContext? {
    return try {
        val data = SupabaseProvider.client.postgrest.rpc(
            "get_workspace_context",
            buildJsonObject { },
        ).decodeAs<kotlinx.serialization.json.JsonObject>()
        WorkspaceContext(
            unreadNotifications = data["unread_notifications"]?.jsonPrimitive?.contentOrNull()?.toIntOrNull() ?: 0,
            platformAdmin = data["platform_admin"]?.jsonPrimitive?.contentOrNull() == "true",
            classAdminAnywhere = data["class_admin_anywhere"]?.jsonPrimitive?.contentOrNull() == "true",
            betaTester = data["beta_tester"]?.jsonPrimitive?.contentOrNull() == "true",
            lecturerAnywhere = data["lecturer_anywhere"]?.jsonPrimitive?.contentOrNull() == "true",
        )
    } catch (_: Exception) {
        null
    }
}
