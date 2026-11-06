package id.starstask.mobile.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import id.starstask.mobile.ui.theme.Foreground
import id.starstask.mobile.ui.theme.MutedForeground
import id.starstask.mobile.ui.theme.Surface

/** Hub for workspace surfaces that do not fit the bottom bar. */
@Composable
fun MoreScreen(
    onSchedule: () -> Unit,
    onLeave: () -> Unit,
    onNotifications: () -> Unit,
    onSettings: () -> Unit,
) {
    Column(modifier = Modifier.fillMaxSize().padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Text("More", style = MaterialTheme.typography.headlineSmall, color = Foreground)
        MoreRow("Schedule", "Class sessions this week", onSchedule)
        MoreRow("Absence Requests", "Your leave requests and status", onLeave)
        MoreRow("Notifications", "Inbox and unread alerts", onNotifications)
        MoreRow("Settings", "Profile, preferences, sign out", onSettings)
    }
}

@Composable
private fun MoreRow(title: String, subtitle: String, onClick: () -> Unit) {
    Card(
        colors = CardDefaults.cardColors(containerColor = Surface),
        shape = RoundedCornerShape(12.dp),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(title, color = Foreground)
            Text(subtitle, color = MutedForeground, style = MaterialTheme.typography.bodySmall)
            OutlinedButton(onClick = onClick, modifier = Modifier.padding(top = 4.dp)) {
                Text("Open")
            }
        }
    }
}
