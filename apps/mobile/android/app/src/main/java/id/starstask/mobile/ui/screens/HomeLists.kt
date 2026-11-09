package id.starstask.mobile.ui.screens

import id.starstask.mobile.ui.theme.Spacing

import id.starstask.mobile.ui.components.WebSectionTitle
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.lazy.LazyListScope
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import id.starstask.mobile.data.DashboardAssignment
import id.starstask.mobile.data.DashboardSession
import id.starstask.mobile.data.LeaveRequest
import id.starstask.mobile.data.NotificationRow
import id.starstask.mobile.data.ScheduleEntry
import id.starstask.mobile.data.formatTime
import id.starstask.mobile.ui.components.WebButton
import id.starstask.mobile.ui.components.WebCompactCard
import id.starstask.mobile.ui.theme.Accent
import id.starstask.mobile.ui.theme.Foreground
import id.starstask.mobile.ui.theme.MutedForeground

fun LazyListScope.todaySessionsSection(
    sessions: List<DashboardSession>,
    onCheckIn: (String) -> Unit,
) {
    item { WebSectionTitle("Today") }
    if (sessions.isEmpty()) {
        item { Text("No sessions today.", color = MutedForeground) }
    } else {
        items(sessions, key = { it.id }) { session ->
            WebCompactCard(modifier = Modifier.fillMaxWidth()) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(Spacing.Section),
                ) {
                    Column(modifier = Modifier.weight(1f)) {
                        Text(session.subjectName ?: session.title, color = Foreground)
                        Text(
                            "${formatTime(session.startsAt)}-${formatTime(session.endsAt)}" +
                                (session.checkInStatus?.let { " · $it" } ?: ""),
                            color = MutedForeground,
                            style = MaterialTheme.typography.bodySmall,
                        )
                    }
                    if (session.checkInStatus == null &&
                        session.checkInLatitude != null &&
                        session.checkInLongitude != null
                    ) {
                        WebButton(label = "Check in", onClick = { onCheckIn(session.id) })
                    }
                }
            }
        }
    }
}

fun LazyListScope.upcomingAssignmentsSection(
    assignments: List<DashboardAssignment>,
    onAssignmentClick: (DashboardAssignment) -> Unit = {},
) {
    item { WebSectionTitle("Upcoming assignments") }
    if (assignments.isEmpty()) {
        item { Text("No upcoming assignments.", color = MutedForeground) }
    } else {
        items(assignments, key = { it.id }) { assignment ->
            WebCompactCard(
                modifier = Modifier.fillMaxWidth(),
                onClick = { onAssignmentClick(assignment) },
            ) {
                Column {
                    Text(assignment.title, color = Foreground)
                    Text(
                        (assignment.subjectName ?: "") +
                            (assignment.deadline?.let { " · ${formatTime(it)}" } ?: ""),
                        color = MutedForeground,
                        style = MaterialTheme.typography.bodySmall,
                    )
                }
            }
        }
    }
}

fun LazyListScope.scheduleSection(
    entries: List<ScheduleEntry>,
    onEntryClick: (ScheduleEntry) -> Unit = {},
) {
    item { WebSectionTitle("Schedule") }
    if (entries.isEmpty()) {
        item { Text("No sessions this week.", color = MutedForeground) }
    } else {
        items(entries, key = { it.id }) { entry ->
            WebCompactCard(
                modifier = Modifier.fillMaxWidth(),
                onClick = { onEntryClick(entry) },
            ) {
                Column {
                    Text(entry.title, color = Foreground)
                    Text(
                        "${entry.className ?: ""} · ${formatTime(entry.startsAt)}-${formatTime(entry.endsAt)}",
                        color = MutedForeground,
                        style = MaterialTheme.typography.bodySmall,
                    )
                }
            }
        }
    }
}

fun LazyListScope.leaveSection(
    requests: List<LeaveRequest>,
    onRequestClick: (LeaveRequest) -> Unit = {},
) {
    item { WebSectionTitle("Absence Requests") }
    if (requests.isEmpty()) {
        item { Text("No absence requests.", color = MutedForeground) }
    } else {
        items(requests, key = { it.id }) { request ->
            WebCompactCard(
                modifier = Modifier.fillMaxWidth(),
                onClick = { onRequestClick(request) },
            ) {
                Column {
                    Text(request.status.replaceFirstChar { it.uppercase() }, color = Foreground)
                    Text(
                        "${request.leaveStart ?: ""} → ${request.leaveEnd ?: ""} · ${request.reason ?: ""}",
                        color = MutedForeground,
                        style = MaterialTheme.typography.bodySmall,
                    )
                }
            }
        }
    }
}

fun LazyListScope.notificationsSection(
    notifications: List<NotificationRow>,
    onNotificationClick: (NotificationRow) -> Unit = {},
) {
    item { WebSectionTitle("Notifications") }
    if (notifications.isEmpty()) {
        item { Text("No notifications.", color = MutedForeground) }
    } else {
        items(notifications, key = { it.id }) { notification ->
            WebCompactCard(
                modifier = Modifier.fillMaxWidth(),
                onClick = { onNotificationClick(notification) },
            ) {
                Column {
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
