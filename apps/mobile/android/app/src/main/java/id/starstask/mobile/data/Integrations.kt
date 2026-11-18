package id.starstask.mobile.data

import android.content.Context
import android.content.Intent
import id.starstask.mobile.BuildConfig
import io.github.jan.supabase.auth.auth
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

/**
 * Native entry point to the web Google integration flows.
 *
 * The consent + token storage live server-side (confidential OAuth client
 * with a client secret), so the native app cannot complete them on-device:
 * instead it opens the same server `start` route the web settings page
 * links to, in a Custom Tab (not a WebView). After the user signs in on
 * web and grants consent, the server stores the grant; the native screen
 * refreshes the same connection tables web reads.
 *
 * The web base URL comes from local.properties (`starstask.site.url`),
 * same pattern as the Supabase URL — never hardcoded.
 */
enum class IntegrationKind(val label: String, val startPath: String, val disconnectPath: String) {
    CALENDAR("Google Calendar", "/api/integrations/google-calendar/start", "/api/integrations/google-calendar/disconnect"),
    DRIVE("Google Drive", "/api/integrations/google-drive/start", "/api/integrations/google-drive/disconnect"),
}

sealed class IntegrationDisconnectResult {
    data object Disconnected : IntegrationDisconnectResult()
    data class Failed(val message: String) : IntegrationDisconnectResult()
}

fun openIntegrationConnect(context: Context, kind: IntegrationKind): Boolean =
    openWebFlow(context, kind.startPath)

suspend fun disconnectIntegration(kind: IntegrationKind): IntegrationDisconnectResult {
    val token = runCatching { SupabaseProvider.client.auth.currentSessionOrNull()?.accessToken }.getOrNull()
        ?: return IntegrationDisconnectResult.Failed("Sign in to disconnect ${kind.label}.")
    val baseUrl = BuildConfig.SITE_URL.trimEnd('/')
    if (baseUrl.isBlank() || baseUrl.contains("your-site-url")) {
        return IntegrationDisconnectResult.Failed("Web site URL is not configured — disconnect from web Settings instead.")
    }
    val url = java.net.URL(baseUrl + kind.disconnectPath)
    return withContext(Dispatchers.IO) {
        val conn = (url.openConnection() as java.net.HttpURLConnection).apply {
            connectTimeout = 15_000
            readTimeout = 30_000
            requestMethod = "POST"
            setRequestProperty("Authorization", "Bearer $token")
            setRequestProperty("Accept", "application/json")
            doOutput = true
            outputStream.close()
        }
        val status = try {
            conn.responseCode
        } catch (_: java.io.IOException) {
            conn.disconnect()
            return@withContext IntegrationDisconnectResult.Failed(
                "Could not reach server to disconnect ${kind.label}. Try again shortly.",
            )
        }
        try {
            when {
                status in 200..299 -> IntegrationDisconnectResult.Disconnected
                status == java.net.HttpURLConnection.HTTP_UNAUTHORIZED ->
                    IntegrationDisconnectResult.Failed("Session expired — sign in again to disconnect ${kind.label}.")
                else ->
                    IntegrationDisconnectResult.Failed("Failed to disconnect ${kind.label}. Try again.")
            }
        } finally {
            conn.disconnect()
        }
    }
}

private fun openWebFlow(context: Context, path: String): Boolean {
    val baseUrl = BuildConfig.SITE_URL.trimEnd('/')
    if (baseUrl.contains("your-site-url")) return false
    val url = baseUrl + path
    return try {
        context.startActivity(Intent(Intent.ACTION_VIEW, android.net.Uri.parse(url)).apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        })
        true
    } catch (_: Exception) {
        false
    }
}
