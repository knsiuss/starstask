package id.starstask.mobile.data

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.content.ContextCompat

// Must match the channelId the server-side FCM sender sets on Android
// (apps/web/src/lib/push/fcm-sender.ts: NATIVE_CHANNEL_ID).
const val REMINDER_CHANNEL_ID = "starstask-reminders"
const val REMINDER_CHANNEL_NAME = "Reminders"
const val REMINDER_CHANNEL_DESCRIPTION = "Deadline and class session reminders"

fun ensureReminderChannel(context: Context) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val manager = context.getSystemService(NotificationManager::class.java) ?: return
    if (manager.getNotificationChannel(REMINDER_CHANNEL_ID) != null) return
    // IMPORTANCE_LOW: no sound, no heads-up — notification sits silently in the
    // shade. This is intentional; the feature exists to inform, not to pull
    // people out of meetings.
    manager.createNotificationChannel(
        NotificationChannel(
            REMINDER_CHANNEL_ID,
            REMINDER_CHANNEL_NAME,
            NotificationManager.IMPORTANCE_LOW,
        ).apply {
            description = REMINDER_CHANNEL_DESCRIPTION
            enableVibration(false)
            setSound(null, null)
        },
    )
}

fun notificationsGranted(context: Context): Boolean {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) return true
    return ContextCompat.checkSelfPermission(
        context,
        Manifest.permission.POST_NOTIFICATIONS,
    ) == PackageManager.PERMISSION_GRANTED
}

/**
 * True when the OS will actually show a notification from our channel.
 * Channel importance is user-controllable, so permission alone is not enough.
 */
fun notificationsVisible(context: Context): Boolean {
    if (!notificationsGranted(context)) return false
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return true
    val manager = context.getSystemService(NotificationManager::class.java) ?: return false
    return manager.importance != NotificationManager.IMPORTANCE_NONE &&
        manager.getNotificationChannel(REMINDER_CHANNEL_ID)?.importance != NotificationManager.IMPORTANCE_NONE
}

/**
 * Fetches the current FCM token and registers it server-side. Returns the
 * token, or null when Firebase is unavailable or the RPC refuses the token
 * (another account owns it).
 */
suspend fun registerCurrentToken(context: Context): String? {
    val token = runCatching { currentFcmToken() }.getOrNull()?.takeIf { it.isNotBlank() } ?: return null
    val id = runCatching { registerNativePushToken(token, "Android") }.getOrNull()
    // A null id means another account owns the token; keep the cached copy in
    // sync either way so unregister can still attempt deletion with the same token.
    setCachedFcmToken(context, token)
    return if (id == null) null else token
}

/**
 * Single entry point for enabling push end-to-end: server preference row,
 * device FCM token, and the local opt-in cache used for reconciliation on
 * app start. Shared by Settings (toggle) and the first-launch onboarding.
 * Registration refusal (token owned by another account) is non-fatal, so a
 * flaky network will not trap the caller; Settings stays the retry point.
 */
suspend fun enablePushForUser(context: Context, userId: String) {
    val prefs = runCatching { loadNotificationPrefs(userId) }.getOrDefault(NotificationPrefs())
    saveNotificationPrefs(userId, prefs.copy(pushEnabled = true))
    registerCurrentToken(context)
    setCachedPushEnabled(context, true)
}

/**
 * Reconciles FCM state with the cached opt-in. Called on app start and on
 * FCM rotation. When the server rejected the token (null RPC result) we keep
 * the cache so we don't spam re-registrations every launch.
 */
suspend fun syncPushRegistration(context: Context) {
    if (!cachedPushEnabled(context)) return
    runCatching { registerCurrentToken(context) }
}

suspend fun unregisterAllPush(context: Context, userId: String) {
    currentFcmTokenSafely()?.let { token ->
        runCatching { deleteNativePushToken(token) }
    }
    cachedFcmToken(context)?.takeIf { it.isNotBlank() }?.let { cached ->
        runCatching { deleteNativePushToken(cached) }
    }
    setCachedFcmToken(context, null)
    // Clear the local opt-in flag too, otherwise syncPushRegistration() would
    // re-register the token on the next app start.
    setCachedPushEnabled(context, false)
    // And the server-side preference — otherwise the web settings toggle
    // still shows push enabled for this account on other surfaces.
    runCatching {
        val prefs = loadNotificationPrefs(userId)
        if (prefs.pushEnabled) saveNotificationPrefs(userId, prefs.copy(pushEnabled = false))
    }
}

private suspend fun currentFcmTokenSafely(): String? =
    runCatching { currentFcmToken() }.getOrNull()?.takeIf { it.isNotBlank() }

