package id.starstask.mobile.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import id.starstask.mobile.data.Assignment
import id.starstask.mobile.data.NotificationRow
import id.starstask.mobile.data.SessionRow
import id.starstask.mobile.data.loadAssignments
import id.starstask.mobile.data.loadNotifications
import id.starstask.mobile.data.loadSessions
import id.starstask.mobile.data.markNotificationRead
import id.starstask.mobile.ui.theme.Accent
import id.starstask.mobile.ui.theme.Foreground
import id.starstask.mobile.ui.theme.MutedForeground
import id.starstask.mobile.ui.theme.Surface

@Composable
internal fun ScreenTitle(text: String) {
    Text(text, style = MaterialTheme.typography.headlineSmall, color = Foreground)
}

@Composable
private fun LoadingOrEmpty(empty: Boolean, emptyText: String, content: @Composable () -> Unit) {
    Column(modifier = Modifier.fillMaxSize().padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        if (empty) Text(emptyText, color = MutedForeground) else content()
    }
}

@Composable
fun AssignmentsScreen(userId: String) {
    var rows by remember { mutableStateOf<List<Assignment>?>(null) }
    var error by remember { mutableStateOf<String?>(null) }
    var selected by remember { mutableStateOf<Assignment?>(null) }

    LaunchedEffect(userId) {
        try { rows = loadAssignments(userId) } catch (_: Exception) { error = "Could not load assignments."; rows = emptyList() }
    }

    if (selected != null) {
        AssignmentDetailScreen(userId = userId, assignment = selected!!, onBack = { selected = null })
        return
    }

    Column(modifier = Modifier.fillMaxSize().padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        ScreenTitle("Assignments")
        if (rows == null && error == null) {
            Text("Loading assignments…", color = MutedForeground)
        } else if (error != null) {
            Text(error!!, color = Foreground)
        } else if (rows.isNullOrEmpty()) {
            Text("No assignments found.", color = MutedForeground)
        }
        LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            items(rows.orEmpty(), key = { it.id }) { assignment ->
                Card(colors = CardDefaults.cardColors(containerColor = Surface), shape = RoundedCornerShape(12.dp), modifier = Modifier.fillMaxWidth()) {
                    Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                        Text(assignment.title, color = Foreground)
                        Text(
                            (assignment.className ?: "") + (assignment.deadline?.let { " · ${id.starstask.mobile.data.formatTime(it)}" } ?: ""),
                            color = MutedForeground,
                            style = MaterialTheme.typography.bodySmall,
                        )
                        OutlinedButton(onClick = { selected = assignment }) { Text("Open") }
                    }
                }
            }
        }
    }
}


@Composable
fun SessionsScreen(userId: String, onCheckIn: (String) -> Unit) {
    var rows by remember { mutableStateOf<List<SessionRow>>(emptyList()) }
    var error by remember { mutableStateOf<String?>(null) }

    LaunchedEffect(userId) {
        try { rows = loadSessions(userId) } catch (e: Exception) { error = "Could not load sessions." }
    }

    Column(modifier = Modifier.fillMaxSize().padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        ScreenTitle("Attendance")
        if (error != null) Text(error!!, color = Foreground)
        LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            items(rows, key = { it.id }) { session ->
                Card(colors = CardDefaults.cardColors(containerColor = Surface), shape = RoundedCornerShape(12.dp), modifier = Modifier.fillMaxWidth()) {
                    Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                        Text(session.title, color = Foreground)
                        Text(
                            "${session.className ?: ""} · ${id.starstask.mobile.data.formatTime(session.startsAt)} · ${session.status}",
                            color = MutedForeground,
                            style = MaterialTheme.typography.bodySmall,
                        )
                        androidx.compose.material3.Button(
                            onClick = { onCheckIn(session.id) },
                            colors = androidx.compose.material3.ButtonDefaults.buttonColors(containerColor = Accent),
                        ) { Text("Check in") }
                    }
                }
            }
        }
    }
}

@Composable
fun NotificationsScreen() {
    var rows by remember { mutableStateOf<List<NotificationRow>>(emptyList()) }
    var error by remember { mutableStateOf<String?>(null) }

    LaunchedEffect(Unit) {
        try { rows = loadNotifications() } catch (e: Exception) { error = "Could not load notifications." }
    }

    Column(modifier = Modifier.fillMaxSize().padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        ScreenTitle("Notifications")
        if (error != null) Text(error!!, color = Foreground)
        LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            items(rows, key = { it.id }) { notification ->
                Card(colors = CardDefaults.cardColors(containerColor = Surface), shape = RoundedCornerShape(12.dp), modifier = Modifier.fillMaxWidth()) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Text(notification.title, color = Foreground)
                        if (notification.body.isNotEmpty()) {
                            Text(notification.body, color = MutedForeground, style = MaterialTheme.typography.bodySmall)
                        }
                        if (notification.readAt == null) {
                            Text("Unread", color = Accent, style = MaterialTheme.typography.bodySmall)
                        }
                    }
                }
            }
        }
    }
}
