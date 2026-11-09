package id.starstask.mobile.ui.screens

import id.starstask.mobile.ui.theme.Spacing

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import id.starstask.mobile.data.loadDeveloperOverview
import id.starstask.mobile.ui.components.WebAlert
import id.starstask.mobile.ui.components.WebButton
import id.starstask.mobile.ui.components.WebButtonVariant
import id.starstask.mobile.ui.components.WebCard
import id.starstask.mobile.ui.components.WebCardHeader
import id.starstask.mobile.ui.components.WebInput
import id.starstask.mobile.ui.components.WebScreenHeader
import id.starstask.mobile.ui.theme.Foreground
import id.starstask.mobile.ui.theme.MutedForeground

// One mobile screen per web settings section (calendar/drive/feedback/notifications/plugins/security)
// + developer observability. Values are local until server sync is wired.

@Composable
fun SettingsScreens() {
    var calendarOn by remember { mutableStateOf(false) }
    var notificationsOn by remember { mutableStateOf(true) }
    var driveOn by remember { mutableStateOf(false) }
    var feedback by remember { mutableStateOf("") }
    var feedbackSent by remember { mutableStateOf(false) }
    var pluginDone by remember { mutableStateOf(false) }

    Column(modifier = Modifier.fillMaxSize().padding(Spacing.Section), verticalArrangement = Arrangement.spacedBy(Spacing.Xl)) {
        WebScreenHeader(title = "Settings", subtitle = "Calendar, Drive, notifications and security")

        SettingsCard(title = "Calendar", description = "Sync class schedule to Google Calendar") {
            Row(horizontalArrangement = Arrangement.SpaceBetween, modifier = Modifier.fillMaxWidth()) {
                Text(if (calendarOn) "Synced to Google Calendar." else "Calendar sync off.")
                WebButton(label = if (calendarOn) "Disconnect" else "Connect", onClick = { calendarOn = !calendarOn }, variant = WebButtonVariant.SECONDARY)
            }
        }

        SettingsCard(title = "Drive", description = "Attach evidence from Google Drive") {
            Row(horizontalArrangement = Arrangement.SpaceBetween, modifier = Modifier.fillMaxWidth()) {
                Text(if (driveOn) "Google Drive connected." else "Drive not connected.")
                WebButton(label = if (driveOn) "Disconnect" else "Connect", onClick = { driveOn = !driveOn }, variant = WebButtonVariant.SECONDARY)
            }
        }

        SettingsCard(title = "Feedback", description = "Tell us what to improve") {
            WebInput(value = feedback, onValueChange = { feedback = it }, label = "Feedback", singleLine = false)
            if (feedbackSent) Text("Thanks — feedback recorded on this device.", color = MutedForeground)
            WebButton(label = "Send feedback", onClick = { feedbackSent = true })
        }

        SettingsCard(title = "Notifications", description = "Push notifications for deadlines and attendance") {
            Row(horizontalArrangement = Arrangement.SpaceBetween, modifier = Modifier.fillMaxWidth()) {
                Text(if (notificationsOn) "Push enabled." else "Push disabled.")
                WebButton(label = if (notificationsOn) "Disable" else "Enable", onClick = { notificationsOn = !notificationsOn }, variant = WebButtonVariant.SECONDARY)
            }
        }

        SettingsCard(title = "Plugins", description = "Optional integrations") {
            Text(if (pluginDone) "Plugins sync queued." else "No plugins installed.")
            WebButton(label = "Refresh plugins", onClick = { pluginDone = true }, variant = WebButtonVariant.SECONDARY)
        }

        SettingsCard(title = "Security", description = "Session and sign-out") {
            Text("Signed-in session is managed by Supabase Auth. Use Sign out in Profile to end the session.")
        }
    }
}

@Composable
private fun SettingsCard(title: String, description: String, content: @Composable () -> Unit) {
    WebCard {
        WebCardHeader(title = title, description = description)
        content()
    }
}

@Composable
fun DeveloperConsoleScreen() {
    var overview by remember { mutableStateOf<id.starstask.mobile.data.DeveloperOverview?>(null) }
    var error by remember { mutableStateOf<String?>(null) }
    var loading by remember { mutableStateOf(false) }

    Column(modifier = Modifier.fillMaxSize().padding(Spacing.Section), verticalArrangement = Arrangement.spacedBy(Spacing.Xl)) {
        WebScreenHeader(title = "Developer observability", subtitle = "Platform-wide counts (admin only)")
        WebButton(
            label = "Refresh",
            onClick = { loading = true; error = null },
        )
        androidx.compose.runtime.LaunchedEffect(Unit) {
            loading = true
            runCatching { overview = loadDeveloperOverview() }
                .onFailure { error = "Could not load overview (platform admin only): ${it.message}" }
            loading = false
        }
        if (loading) Text("Loading…", color = MutedForeground)
        if (error != null) WebAlert(message = error!!)
        overview?.let { current ->
            WebCard {
                WebCardHeader(title = "Overview")
                Text("Active classes: ${current.activeClasses}", color = Foreground)
                Text("Archived classes: ${current.archivedClasses}", color = Foreground)
                Text("Total users: ${current.totalUsers}", color = Foreground)
            }
        }
        if (!loading && overview == null && error == null) {
            Text("Overview will appear here after load. Incidents list is managed in the web console.", color = MutedForeground)
        }
    }
}
