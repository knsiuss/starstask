package id.starstask.mobile

import android.app.PendingIntent
import android.content.Intent
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import id.starstask.mobile.data.REMINDER_CHANNEL_ID
import id.starstask.mobile.data.cachedPushEnabled
import id.starstask.mobile.data.ensureReminderChannel
import id.starstask.mobile.data.registerCurrentToken
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

/**
 * Native FCM receive path. Web push dispatch writes notification_events
 * server-side; this service only surfaces them on-device (title/body are
 * never DM plaintext — DM push carries no message content).
 */
class StarsTaskMessagingService : FirebaseMessagingService() {

    override fun onNewToken(token: String) {
        super.onNewToken(token)
        // Token rotation: only registered while the user has opted in.
        if (!cachedPushEnabledBlocking()) return
        CoroutineScope(Dispatchers.IO).launch {
            runCatching { registerCurrentToken(applicationContext) }
        }
    }

    private fun cachedPushEnabledBlocking(): Boolean {
        var enabled = false
        kotlinx.coroutines.runBlocking { enabled = cachedPushEnabled(applicationContext) }
        return enabled
    }

    override fun onMessageReceived(message: RemoteMessage) {
        super.onMessageReceived(message)
        val title = message.notification?.title ?: message.data["title"] ?: "StarsTask"
        val body = message.notification?.body ?: message.data["body"] ?: ""
        val url = message.data["url"]
        showNotification(title, body, url)
    }

    private fun showNotification(title: String, body: String, url: String?) {
        val channelId = REMINDER_CHANNEL_ID
        ensureReminderChannel(this)
        val intent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            if (!url.isNullOrBlank()) putExtra(EXTRA_PUSH_URL, url)
        }
        val notificationId = (url ?: title + body).hashCode()
        val pending = PendingIntent.getActivity(
            this, notificationId, intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        val notification = NotificationCompat.Builder(this, channelId)
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setContentTitle(title)
            .setContentText(body)
            .setAutoCancel(true)
            .setContentIntent(pending)
            .build()
        try {
            NotificationManagerCompat.from(this).notify(notificationId, notification)
        } catch (_: SecurityException) {
            // POST_NOTIFICATIONS not granted (Android 13+): push still lands in
            // notification_events and shows in the in-app list.
        }
    }

    companion object {
        const val EXTRA_PUSH_URL = "push_url"
    }
}
