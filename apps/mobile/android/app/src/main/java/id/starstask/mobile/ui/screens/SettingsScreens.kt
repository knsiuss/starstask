package id.starstask.mobile.ui.screens

import id.starstask.mobile.ui.theme.Spacing

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import android.Manifest
import android.os.Build
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import id.starstask.mobile.data.IntegrationKind
import id.starstask.mobile.data.openIntegrationConnect
import id.starstask.mobile.data.IntegrationStatus
import id.starstask.mobile.data.NotificationPrefs
import id.starstask.mobile.data.loadCalendarStatus
import id.starstask.mobile.data.loadDriveStatus
import id.starstask.mobile.data.loadNotificationPrefs
import id.starstask.mobile.data.notificationsGranted
import id.starstask.mobile.data.registerCurrentToken
import id.starstask.mobile.data.saveNotificationPrefs
import id.starstask.mobile.data.setCachedPushEnabled
import id.starstask.mobile.data.unregisterAllPush
import id.starstask.mobile.ui.components.WebBadge
import id.starstask.mobile.ui.components.WebButton
import id.starstask.mobile.ui.components.WebButtonVariant
import id.starstask.mobile.ui.components.WebCard
import id.starstask.mobile.ui.components.WebCardDescription
import id.starstask.mobile.ui.components.WebCardTitle
import id.starstask.mobile.ui.components.WebSecondaryButton
import id.starstask.mobile.ui.theme.Foreground
import id.starstask.mobile.ui.theme.MutedForeground
import id.starstask.mobile.ui.theme.Surface
import kotlinx.coroutines.launch

/**
 * Settings hub mirroring the web settings structure
 * (apps/web/src/app/(workspace)/settings/): the drawer "Settings" entry
 * maps to web /settings/notifications, with Calendar/Drive connection
 * status shown here. OAuth connect flows start on web (server-side
 * Google consent + token storage); this screen shows the real
 * connection state from the same tables, no WebView.
 */
@Composable
fun SettingsHubScreen(
    userId: String,
    onOpenNotifications: () -> Unit,
    onSignOut: () -> Unit,
) {
    val context = LocalContext.current
    var calendar by remember { mutableStateOf<IntegrationStatus?>(null) }
    var drive by remember { mutableStateOf<IntegrationStatus?>(null) }
    var refreshTick by remember { mutableStateOf(0) }
    var notice by remember { mutableStateOf<String?>(null) }

    suspend fun reload() {
        calendar = runCatching { loadCalendarStatus(userId) }.getOrNull()
        drive = runCatching { loadDriveStatus(userId) }.getOrNull()
    }

    LaunchedEffect(userId, refreshTick) { reload() }

    fun connect(kind: IntegrationKind) {
        val launched = openIntegrationConnect(context, kind)
        notice = if (launched) {
            "Browser opened — sign in on web and grant access, then come back " +
                "here and tap Refresh."
        } else {
            "Web site URL is not configured (set starstask.site.url in " +
                "local.properties) — connect from web Settings instead."
        }
    }

    Column(
        modifier = Modifier.fillMaxSize().padding(Spacing.Section).verticalScroll(rememberScrollState()),
        verticalArrangement = Arrangement.spacedBy(Spacing.Xl),
    ) {
        Text("Settings", style = MaterialTheme.typography.headlineSmall, color = Foreground)
        Text(
            "Secure sign-in via Google · No password stored",
            color = MutedForeground,
            style = MaterialTheme.typography.bodySmall,
        )
        HubRow(
            title = "Notifications",
            subtitle = "Deadline reminders and push devices",
            onClick = onOpenNotifications,
        )
        HubRow(
            title = "Calendar",
            subtitle = if (calendar?.connected == true) {
                "Connected · ${calendar?.calendarId ?: ""}"
            } else {
                "Not connected"
            },
            actionLabel = if (calendar?.connected == true) null else "Connect",
            onAction = { connect(IntegrationKind.CALENDAR) },
            onClick = {},
        )
        HubRow(
            title = "Drive",
            subtitle = if (drive?.connected == true) {
                "Connected"
            } else {
                "Not connected"
            },
            actionLabel = if (drive?.connected == true) null else "Connect",
            onAction = { connect(IntegrationKind.DRIVE) },
            onClick = {},
        )
        if (notice != null) {
            Text(notice!!, color = MutedForeground, style = MaterialTheme.typography.bodySmall)
        }
        WebButton(label = "Refresh connection status", onClick = { refreshTick++ }, variant = WebButtonVariant.SECONDARY)
        WebButton(label = "Sign out", onClick = onSignOut, variant = WebButtonVariant.SECONDARY)
    }
}

@Composable
private fun HubRow(
    title: String,
    subtitle: String,
    actionLabel: String? = null,
    onAction: () -> Unit = {},
    onClick: () -> Unit,
) {
    WebCard(modifier = Modifier.fillMaxWidth().clickable(onClick = onClick)) {
        WebCardTitle(title)
        WebCardDescription(subtitle)
        if (actionLabel != null) {
            WebSecondaryButton(actionLabel, onClick = onAction)
        }
    }
}

private val timezoneOptions = listOf("Asia/Jakarta", "Asia/Makassar", "Asia/Jayapura", "UTC")

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun NotificationSettingsScreen(userId: String) {
    val scope = rememberCoroutineScope()
    val context = LocalContext.current
    var prefs by remember { mutableStateOf<NotificationPrefs?>(null) }
    var notice by remember { mutableStateOf<String?>(null) }
    var saving by remember { mutableStateOf(false) }

    LaunchedEffect(userId) {
        prefs = runCatching { loadNotificationPrefs(userId) }.getOrNull()
            ?: NotificationPrefs().also { notice = "Could not load preferences." }
    }

    fun enablePush(next: NotificationPrefs) {
        scope.launch {
            saving = true
            runCatching {
                saveNotificationPrefs(userId, next)
                registerCurrentToken(context)
                setCachedPushEnabled(context, true)
            }.onSuccess {
                prefs = next
                notice = "Saved."
            }
                .onFailure { notice = "Could not save: ${it.message}" }
            saving = false
        }
    }

    fun save(next: NotificationPrefs) {
        if (!next.pushEnabled) {
            scope.launch {
                saving = true
                runCatching {
                    saveNotificationPrefs(userId, next)
                    unregisterAllPush(context)
                }.onSuccess {
                    prefs = next
                    notice = "Saved."
                }
                    .onFailure { notice = "Could not save: ${it.message}" }
                saving = false
            }
            return
        }
        // Android 13+ needs runtime POST_NOTIFICATIONS. Saved only after
        // the user grants it; denying leaves push off rather than silently
        // enabled-with-no-delivery.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU && !notificationsGranted(context)) {
            notice = "Izinkan notifikasi dulu — baru bisa dinyalakan."
            return
        }
        enablePush(next)
    }

    val permissionLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestPermission(),
    ) { granted ->
        val pending = prefs?.copy(pushEnabled = true)
        if (granted && pending != null) {
            enablePush(pending)
        } else {
            notice = "Notifikasi tidak diizinkan — push tetap mati."
        }
    }

    fun onPushToggle(enabled: Boolean) {
        val current = prefs ?: return
        val next = current.copy(pushEnabled = enabled)
        if (enabled && Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU && !notificationsGranted(context)) {
            permissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
            return
        }
        save(next)
    }

    Column(
        modifier = Modifier.fillMaxSize().padding(Spacing.Section).verticalScroll(rememberScrollState()),
        verticalArrangement = Arrangement.spacedBy(Spacing.Xl),
    ) {
        Text("Notification settings", style = MaterialTheme.typography.headlineSmall, color = Foreground)
        Text(
            "Get a reminder about 24 hours and 3 hours before an assignment you own " +
                "or save is due. Notifications are optional and never change what is public.",
            color = MutedForeground,
            style = MaterialTheme.typography.bodyMedium,
        )
        val current = prefs
        if (current == null) {
            Text("Loading preferences…", color = MutedForeground)
            return
        }
        PrefToggle(
            label = "Push notifications",
            checked = current.pushEnabled,
            onChange = { onPushToggle(it) },
        )
        PrefToggle(
            label = "Assignment reminder — 24h before deadline",
            checked = current.reminder24h,
            onChange = { save(current.copy(reminder24h = it)) },
        )
        PrefToggle(
            label = "Assignment reminder — 3h before deadline",
            checked = current.reminder3h,
            onChange = { save(current.copy(reminder3h = it)) },
        )
        PrefToggle(
            label = "Session reminder — 24h before start",
            checked = current.sessionReminder24h,
            onChange = { save(current.copy(sessionReminder24h = it)) },
        )
        PrefToggle(
            label = "Session reminder — 3h before start",
            checked = current.sessionReminder3h,
            onChange = { save(current.copy(sessionReminder3h = it)) },
        )
        Text("Timezone (reminder lead times follow this zone):", color = Foreground)
        Row(horizontalArrangement = Arrangement.spacedBy(Spacing.Md)) {
            timezoneOptions.forEach { zone ->
                WebButton(
                    label = (if (zone == current.timezone) "✓ " else "") + zone,
                    onClick = { save(current.copy(timezone = zone)) },
                    variant = if (zone == current.timezone) WebButtonVariant.PRIMARY else WebButtonVariant.SECONDARY,
                )
            }
        }
        if (saving) Text("Saving…", color = MutedForeground)
        if (notice != null) Text(notice!!, color = Foreground)
        Text(
            "Deadline reminders follow the timezone and lead time saved above. " +
                "They are delivered to your registered Android device.",
            color = MutedForeground,
            style = MaterialTheme.typography.bodySmall,
        )
    }
}

@Composable
private fun PrefToggle(label: String, checked: Boolean, onChange: (Boolean) -> Unit) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween,
    ) {
        Text(label, color = Foreground, modifier = Modifier.weight(1f))
        Switch(checked = checked, onCheckedChange = onChange)
    }
}
