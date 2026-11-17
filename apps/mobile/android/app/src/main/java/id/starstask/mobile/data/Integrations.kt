package id.starstask.mobile.data

import android.content.Context
import android.content.Intent
import id.starstask.mobile.BuildConfig

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

fun openIntegrationConnect(context: Context, kind: IntegrationKind): Boolean =
    openWebFlow(context, kind.startPath)

fun openIntegrationDisconnect(context: Context, kind: IntegrationKind): Boolean =
    openWebFlow(context, kind.disconnectPath)

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
