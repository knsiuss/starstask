package id.starstask.mobile.ui.screens

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
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
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.unit.dp
import id.starstask.mobile.R
import id.starstask.mobile.data.AcademicContext
import id.starstask.mobile.data.DashboardData
import id.starstask.mobile.data.Invitation
import id.starstask.mobile.data.LeaveRequest
import id.starstask.mobile.data.NotificationRow
import id.starstask.mobile.data.ScheduleEntry
import id.starstask.mobile.data.acceptPendingInvitation
import id.starstask.mobile.data.declineInvitation
import id.starstask.mobile.data.formatTime
import id.starstask.mobile.data.loadAcademicContext
import id.starstask.mobile.data.loadDashboard
import id.starstask.mobile.data.loadInvitations
import id.starstask.mobile.data.loadLeaveRequests
import id.starstask.mobile.data.loadNotifications
import id.starstask.mobile.data.loadSchedule
import androidx.compose.ui.tooling.preview.Preview
import id.starstask.mobile.ui.theme.Accent
import id.starstask.mobile.ui.theme.AccentSoft
import id.starstask.mobile.ui.theme.Band
import id.starstask.mobile.ui.theme.Border
import id.starstask.mobile.ui.theme.Danger
import id.starstask.mobile.ui.theme.DangerSoft
import id.starstask.mobile.ui.theme.Foreground
import id.starstask.mobile.ui.theme.MutedFill
import id.starstask.mobile.ui.theme.MutedForeground
import id.starstask.mobile.ui.theme.StarsTaskTheme
import id.starstask.mobile.ui.theme.Subtle
import id.starstask.mobile.ui.theme.Surface
import id.starstask.mobile.ui.theme.Warning
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

/**
 * Mobile home mirroring the web dashboard structure one-to-one:
 * greeting header (live clock, gradient), stat cards (icon tones,
 * delta, hints), quick actions, next schedule, my week, my classes,
 * invitations, academic context, attention banner, what's new,
 * today's sessions with GPS check-in, upcoming assignments,
 * schedule, absence requests, and notifications.
 */
@Composable
fun HomeScreen(
    userId: String,
    userEmail: String?,
    onCheckIn: (String) -> Unit,
    onOpenTasks: () -> Unit = {},
    onOpenMessages: () -> Unit = {},
    onOpenSchedule: () -> Unit = {},
    onOpenClasses: () -> Unit = {},
    onNewAssignment: () -> Unit = {},
) {
    var data by remember { mutableStateOf<DashboardData?>(null) }
    var error by remember { mutableStateOf<String?>(null) }
    var schedule by remember { mutableStateOf<List<ScheduleEntry>>(emptyList()) }
    var leaveRequests by remember { mutableStateOf<List<LeaveRequest>>(emptyList()) }
    var notifications by remember { mutableStateOf<List<NotificationRow>>(emptyList()) }
    var invitations by remember { mutableStateOf<List<Invitation>>(emptyList()) }
    var academicContext by remember { mutableStateOf<AcademicContext?>(null) }
    var invitationBusyId by remember { mutableStateOf<String?>(null) }
    var invitationFeedback by remember { mutableStateOf<String?>(null) }
    var whatsNewDismissed by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()

    LaunchedEffect(userId) {
        try {
            data = loadDashboard(userId)
            schedule = loadSchedule(userId)
            leaveRequests = loadLeaveRequests(userId)
            notifications = loadNotifications()
            invitations = loadInvitations(userId, userEmail)
            academicContext = loadAcademicContext(userId)
        } catch (e: Exception) {
            error = "Could not load your dashboard. Check your connection and try again."
        }
    }

    val current = data
    val now = java.time.ZonedDateTime.now(java.time.ZoneId.of("Asia/Jakarta"))
    val greeting = when (now.hour) {
        in 0..11 -> "Good morning"
        in 12..17 -> "Good afternoon"
        else -> "Good evening"
    }
    val firstName = current?.displayName?.trim()?.split("\\s+".toRegex())?.firstOrNull()
        ?.takeIf { it.length > 1 } ?: current?.displayName ?: "Welcome"
    val summaryParts = buildList {
        if ((current?.dueSoon ?: 0) > 0) add("${current!!.dueSoon} tasks due in the next 7 days")
        if ((current?.pastDeadline ?: 0) > 0) add("${current!!.pastDeadline} past deadlines")
    }
    val dateLabel = now.format(java.time.format.DateTimeFormatter.ofPattern("EEEE, d MMMM yyyy"))

    LazyColumn(
        modifier = Modifier.fillMaxSize().padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        item { DashboardHeader(greeting, firstName, summaryParts, dateLabel, now) }

        // Web DashboardAttentionBanner parity: title + guidance + action.
        if ((current?.pastDeadline ?: 0) > 0) {
            item {
                Card(
                    colors = CardDefaults.cardColors(containerColor = DangerSoft),
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    Row(
                        modifier = Modifier.padding(16.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(12.dp),
                    ) {
                        Box(
                            modifier = Modifier
                                .clip(RoundedCornerShape(8.dp))
                                .background(Surface)
                                .padding(horizontal = 8.dp, vertical = 6.dp),
                            contentAlignment = Alignment.Center,
                        ) {
                            Text("⚠", color = Danger, style = MaterialTheme.typography.bodyMedium)
                        }
                        Column(modifier = Modifier.weight(1f)) {
                            Text(
                                "${current!!.pastDeadline} ${if (current.pastDeadline == 1) "task" else "tasks"} past deadline",
                                style = MaterialTheme.typography.bodyMedium,
                                color = Foreground,
                            )
                            Text(
                                "Deadlines that have already passed in your classes. Worth checking whether any of them still accept late work.",
                                color = MutedForeground,
                                style = MaterialTheme.typography.bodySmall,
                            )
                        }
                        Text(
                            "Review overdue ›",
                            color = Danger,
                            style = MaterialTheme.typography.bodySmall,
                            modifier = Modifier.clickable(onClick = onOpenTasks),
                        )
                    }
                }
            }
        }

        item {
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.fillMaxWidth()) {
                StatCard("Total assignments", current?.totalTasks ?: 0, "▦", "accent", Modifier.weight(1f), hint = "In your classes", delta = current?.newThisWeek ?: 0)
                StatCard("Due soon", current?.dueSoon ?: 0, "◔", "warning", Modifier.weight(1f), hint = "Within the next 7 days")
            }
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.fillMaxWidth().padding(top = 10.dp)) {
                StatCard("Past deadline", current?.pastDeadline ?: 0, "⚠", "danger", Modifier.weight(1f), hint = "Needs your attention")
                StatCard("My classes", current?.classes?.size ?: 0, "🎓", "success", Modifier.weight(1f), hint = "Active membership")
            }
        }

        item {
            QuickActions(
                onCheckIn = {
                    current?.todaySessions?.firstOrNull { it.checkInStatus == null }?.let { onCheckIn(it.id) }
                },
                onOpenTasks = onOpenTasks,
                onOpenMessages = onOpenMessages,
                onOpenSchedule = onOpenSchedule,
                onNewAssignment = onNewAssignment,
            )
        }

        if (schedule.isNotEmpty()) {
            item {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    SectionTitle("Next schedule")
                    Text(
                        "View all tasks ›",
                        color = Accent,
                        style = MaterialTheme.typography.bodySmall,
                        modifier = Modifier.clickable(onClick = onOpenSchedule),
                    )
                }
            }
            item {
                Card(colors = CardDefaults.cardColors(containerColor = Surface), shape = RoundedCornerShape(12.dp), modifier = Modifier.fillMaxWidth()) {
                    Row(modifier = Modifier.padding(16.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                        Box(
                            modifier = Modifier
                                .clip(RoundedCornerShape(8.dp))
                                .background(AccentSoft)
                                .padding(horizontal = 10.dp, vertical = 8.dp),
                            contentAlignment = Alignment.Center,
                        ) {
                            Text("📅", color = Accent, style = MaterialTheme.typography.bodyMedium)
                        }
                        Column(modifier = Modifier.weight(1f)) {
                            Text(schedule.first().title, color = Foreground)
                            Text(
                                "${schedule.first().className ?: ""} · ${formatTime(schedule.first().startsAt)}-${formatTime(schedule.first().endsAt)}",
                                color = MutedForeground,
                                style = MaterialTheme.typography.bodySmall,
                            )
                        }
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(6.dp),
                            modifier = Modifier
                                .clip(RoundedCornerShape(999.dp))
                                .background(Surface)
                                .padding(horizontal = 10.dp, vertical = 6.dp),
                        ) {
                            Box(Modifier.size(6.dp).clip(RoundedCornerShape(999.dp)).background(Accent))
                            Text("Planned", color = Accent, style = MaterialTheme.typography.bodySmall)
                        }
                    }
                }
            }
            item { SectionTitle("My week") }
            item { MyWeekStrip(schedule = schedule) }
        }

        item {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                SectionTitle("My classes")
                if (!current?.classes.isNullOrEmpty()) {
                    Text(
                        "View all",
                        color = Accent,
                        style = MaterialTheme.typography.bodySmall,
                        modifier = Modifier.clickable(onClick = onOpenClasses),
                    )
                }
            }
        }
        if (current?.classes.isNullOrEmpty()) {
            item {
                Card(colors = CardDefaults.cardColors(containerColor = Subtle), shape = RoundedCornerShape(12.dp), modifier = Modifier.fillMaxWidth()) {
                    Row(modifier = Modifier.padding(16.dp), horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.CenterVertically) {
                        Box(
                            modifier = Modifier
                                .clip(RoundedCornerShape(8.dp))
                                .background(Surface)
                                .padding(horizontal = 10.dp, vertical = 8.dp),
                            contentAlignment = Alignment.Center,
                        ) {
                            Text("🎓", color = MutedForeground, style = MaterialTheme.typography.bodyMedium)
                        }
                        Column(modifier = Modifier.weight(1f)) {
                            Text("No active classes yet", style = MaterialTheme.typography.bodyMedium, color = Foreground)
                            Text(
                                "Join a class group using an invitation link or browse available public classes.",
                                color = MutedForeground,
                                style = MaterialTheme.typography.bodySmall,
                            )
                        }
                        OutlinedButton(onClick = onOpenClasses) { Text("Browse classes") }
                    }
                }
            }
        } else {
            items(current!!.classes, key = { it.id }) { clazz ->
                MyClassRow(clazz = clazz)
            }
        }

        if (invitations.isNotEmpty() || invitationFeedback != null) {
            item {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text("✉", color = Accent, style = MaterialTheme.typography.bodyMedium)
                    SectionTitle("Pending invitations")
                    Box(
                        modifier = Modifier
                            .clip(RoundedCornerShape(999.dp))
                            .background(AccentSoft)
                            .padding(horizontal = 8.dp, vertical = 2.dp),
                        contentAlignment = Alignment.Center,
                    ) {
                        Text("${invitations.size}", color = Accent, style = MaterialTheme.typography.bodySmall)
                    }
                }
            }
            item {
                Text(
                    "Invitations to join class groups. Accepting adds you to the group and all its subjects.",
                    color = MutedForeground,
                    style = MaterialTheme.typography.bodySmall,
                )
            }
            if (invitationFeedback != null) {
                item { Text(invitationFeedback!!, color = Accent, style = MaterialTheme.typography.bodySmall) }
            }
            items(invitations, key = { it.id }) { invitation ->
                val busy = invitationBusyId == invitation.id
                Card(colors = CardDefaults.cardColors(containerColor = Surface), shape = RoundedCornerShape(12.dp), modifier = Modifier.fillMaxWidth()) {
                    Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                        Row(horizontalArrangement = Arrangement.SpaceBetween, modifier = Modifier.fillMaxWidth()) {
                            Column(modifier = Modifier.weight(1f)) {
                                Text(invitation.className ?: "Class invitation", color = Foreground, style = MaterialTheme.typography.bodyMedium)
                                if (invitation.classSlug != null) {
                                    Text(invitation.classSlug, color = MutedForeground, style = MaterialTheme.typography.bodySmall)
                                }
                            }
                        }
                        Text("🛡 Invited by ${invitation.adminName ?: "Class Admin"}", color = MutedForeground, style = MaterialTheme.typography.bodySmall)
                        if (invitation.expiresAt != null) {
                            Text("🕐 Expires ${invitation.expiresAt!!.take(10)}", color = MutedForeground, style = MaterialTheme.typography.bodySmall)
                        }
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
                            Button(
                                onClick = {
                                    invitationBusyId = invitation.id
                                    invitationFeedback = null
                                    scope.launch {
                                        try {
                                            acceptPendingInvitation(invitation.id)
                                            invitations = invitations.filter { it.id != invitation.id }
                                            invitationFeedback = "Joined ${invitation.className ?: "the class"}! You now have access to all its subjects."
                                        } catch (_: Exception) {
                                            invitationFeedback = "Could not accept this invitation. Please try again."
                                        } finally {
                                            invitationBusyId = null
                                        }
                                    }
                                },
                                enabled = invitationBusyId == null,
                                colors = ButtonDefaults.buttonColors(containerColor = Accent),
                                modifier = Modifier.weight(1f),
                            ) { Text(if (busy) "…" else "✓ Accept") }
                            OutlinedButton(
                                onClick = {
                                    invitationBusyId = invitation.id
                                    invitationFeedback = null
                                    scope.launch {
                                        try {
                                            declineInvitation(invitation.id)
                                            invitations = invitations.filter { it.id != invitation.id }
                                        } catch (_: Exception) {
                                            invitationFeedback = "Could not decline this invitation. Please try again."
                                        } finally {
                                            invitationBusyId = null
                                        }
                                    }
                                },
                                enabled = invitationBusyId == null,
                            ) { Text("✕ Decline") }
                        }
                    }
                }
            }
        }

        if (academicContext != null) {
            item {
                Card(colors = CardDefaults.cardColors(containerColor = Surface), shape = RoundedCornerShape(12.dp), modifier = Modifier.fillMaxWidth()) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Text("Academic context", style = MaterialTheme.typography.titleMedium, color = Foreground)
                        Text(
                            "Semester ${academicContext!!.semester} · ${academicContext!!.academicYear}",
                            color = MutedForeground,
                            style = MaterialTheme.typography.bodySmall,
                        )
                    }
                }
            }
        }

        item { SectionTitle("Today") }
        if (current?.todaySessions.isNullOrEmpty()) {
            item { Text("No sessions today.", color = MutedForeground) }
        } else {
            items(current!!.todaySessions, key = { it.id }) { session ->
                Card(
                    colors = CardDefaults.cardColors(containerColor = Surface),
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    Row(
                        modifier = Modifier.padding(16.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween,
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
                            Button(
                                onClick = { onCheckIn(session.id) },
                                colors = ButtonDefaults.buttonColors(containerColor = Accent),
                            ) { Text("Check in") }
                        }
                    }
                }
            }
        }

        item { SectionTitle("Upcoming assignments") }
        if (current?.upcomingAssignments.isNullOrEmpty()) {
            item { Text("No upcoming assignments.", color = MutedForeground) }
        } else {
            items(current!!.upcomingAssignments, key = { it.id }) { assignment ->
                Card(
                    colors = CardDefaults.cardColors(containerColor = Surface),
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
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

        item { SectionTitle("Schedule") }
        if (schedule.isEmpty()) {
            item { Text("No sessions this week.", color = MutedForeground) }
        } else {
            items(schedule, key = { it.id }) { entry ->
                Card(
                    colors = CardDefaults.cardColors(containerColor = Surface),
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
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

        item { SectionTitle("Absence Requests") }
        if (leaveRequests.isEmpty()) {
            item { Text("No absence requests.", color = MutedForeground) }
        } else {
            items(leaveRequests, key = { it.id }) { request ->
                Card(
                    colors = CardDefaults.cardColors(containerColor = Surface),
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
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

        item { SectionTitle("Notifications") }
        if (notifications.isEmpty()) {
            item { Text("No notifications.", color = MutedForeground) }
        } else {
            items(notifications, key = { it.id }) { notification ->
                Card(
                    colors = CardDefaults.cardColors(containerColor = Surface),
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier.fillMaxWidth(),
                ) {
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

        if (!whatsNewDismissed) {
            item {
                Card(colors = CardDefaults.cardColors(containerColor = AccentSoft), shape = RoundedCornerShape(12.dp), modifier = Modifier.fillMaxWidth()) {
                    Row(modifier = Modifier.padding(16.dp), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                        Box(
                            modifier = Modifier
                                .clip(RoundedCornerShape(8.dp))
                                .background(Surface)
                                .padding(horizontal = 8.dp, vertical = 6.dp),
                            contentAlignment = Alignment.Center,
                        ) {
                            Text("✦", color = Accent, style = MaterialTheme.typography.bodyMedium)
                        }
                        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                            Text("What's new", style = MaterialTheme.typography.bodyMedium, color = Foreground)
                            Text(
                                "Encrypted direct messages and GPS check-in are now on mobile.",
                                color = MutedForeground,
                                style = MaterialTheme.typography.bodySmall,
                            )
                            Text(
                                "Page transitions and loading skeletons — navigation no longer feels frozen.",
                                color = MutedForeground,
                                style = MaterialTheme.typography.bodySmall,
                            )
                            Text(
                                "GPS check-in failed? Your class admin can now mark you present manually.",
                                color = MutedForeground,
                                style = MaterialTheme.typography.bodySmall,
                            )
                        }
                        Text(
                            "✕",
                            color = MutedForeground,
                            style = MaterialTheme.typography.bodySmall,
                            modifier = Modifier.clickable { whatsNewDismissed = true },
                        )
                    }
                }
            }
        }

        if (error != null) {
            item { Text(error!!, color = Danger) }
        }
    }
}

@Composable
private fun DashboardHeader(
    greeting: String,
    name: String,
    summaryParts: List<String>,
    dateLabel: String,
    now: java.time.ZonedDateTime,
) {
    var clock by remember { mutableStateOf(now) }

    LaunchedEffect(Unit) {
        while (true) {
            delay(60_000)
            clock = java.time.ZonedDateTime.now(java.time.ZoneId.of("Asia/Jakarta"))
        }
    }

    val clockLabel = clock.format(java.time.format.DateTimeFormatter.ofPattern("HH.mm"))

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(16.dp))
            .background(Surface)
            .padding(20.dp),
        verticalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(16.dp)),
        ) {
            // Web header gradient: accent-soft → band → surface, right half.
            Box(
                modifier = Modifier
                    .fillMaxWidth(0.5f)
                    .align(Alignment.CenterEnd)
                    .background(
                        Brush.horizontalGradient(
                            listOf(AccentSoft, Band, Surface),
                        ),
                    ),
            )
            Row(
                modifier = Modifier.fillMaxWidth().padding(20.dp),
                verticalAlignment = Alignment.Top,
                horizontalArrangement = Arrangement.SpaceBetween,
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text("$greeting,", color = MutedForeground, style = MaterialTheme.typography.bodyMedium)
                    Text(name, style = MaterialTheme.typography.headlineMedium, color = Foreground)
                    Text(
                        if (summaryParts.isNotEmpty()) "You have ${summaryParts.joinToString(" and ")}."
                        else "Here is an overview of your academic activities today.",
                        color = MutedForeground,
                        style = MaterialTheme.typography.bodyMedium,
                    )
                }
                // BrandMark parity: real logo-mark.png, web size 88 height.
                Image(
                    painter = painterResource(id = R.drawable.logo_mark),
                    contentDescription = null,
                    contentScale = ContentScale.Fit,
                    modifier = Modifier.size(width = 108.dp, height = 88.dp),
                )
            }
        }
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .padding(top = 12.dp)
                .clip(RoundedCornerShape(1.dp))
                .background(Border),
        ) {
            Text("", style = MaterialTheme.typography.bodySmall)
        }
        Row(
            horizontalArrangement = Arrangement.spacedBy(16.dp),
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier.padding(top = 4.dp),
        ) {
            Row(
                horizontalArrangement = Arrangement.spacedBy(6.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Box(
                    modifier = Modifier.clip(RoundedCornerShape(999.dp)).background(AccentSoft).padding(horizontal = 8.dp, vertical = 4.dp),
                    contentAlignment = Alignment.Center,
                ) {
                    Text("📅", style = MaterialTheme.typography.bodySmall)
                }
                Text(dateLabel, color = MutedForeground, style = MaterialTheme.typography.bodySmall)
            }
            Row(
                horizontalArrangement = Arrangement.spacedBy(6.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Box(
                    modifier = Modifier.clip(RoundedCornerShape(999.dp)).background(AccentSoft).padding(horizontal = 8.dp, vertical = 4.dp),
                    contentAlignment = Alignment.Center,
                ) {
                    Text("🕐", style = MaterialTheme.typography.bodySmall)
                }
                Text(clockLabel, color = Foreground, style = MaterialTheme.typography.bodySmall)
                Text("WIB", color = MutedForeground, style = MaterialTheme.typography.bodySmall)
            }
        }
    }
}

@Composable
private fun SectionTitle(text: String) {
    Text(text, style = MaterialTheme.typography.titleMedium, color = Foreground)
}

@Composable
private fun StatCard(label: String, value: Int, icon: String, tone: String, modifier: Modifier = Modifier, hint: String? = null, delta: Int = 0) {
    val toneBackground = when (tone) {
        "warning" -> Color(0xFFFBF3E4)
        "danger" -> Color(0xFFFBEDED)
        "success" -> Color(0xFFECFDF5)
        else -> Color(0xFFE8EDFA)
    }
    val toneForeground = when (tone) {
        "warning" -> Warning
        "danger" -> Danger
        "success" -> Color(0xFF15803D)
        else -> Accent
    }

    Card(
        colors = CardDefaults.cardColors(containerColor = Surface),
        shape = RoundedCornerShape(12.dp),
        modifier = modifier,
    ) {
        Row(modifier = Modifier.padding(12.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            Box(
                modifier = Modifier
                    .clip(RoundedCornerShape(999.dp))
                    .background(toneBackground)
                    .padding(horizontal = 10.dp, vertical = 6.dp),
                contentAlignment = Alignment.Center,
            ) {
                Text(icon, color = toneForeground, style = MaterialTheme.typography.bodySmall)
            }
            Column {
                Text(label, color = MutedForeground, style = MaterialTheme.typography.bodySmall)
                Row(verticalAlignment = Alignment.Bottom, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                    Text("$value", style = MaterialTheme.typography.headlineSmall, color = Foreground)
                    if (delta > 0) {
                        Text("↗ +$delta", color = Color(0xFF15803D), style = MaterialTheme.typography.bodySmall)
                    }
                }
                if (hint != null) {
                    Text(hint, color = MutedForeground, style = MaterialTheme.typography.bodySmall)
                }
            }
        }
    }
}

@Composable
private fun QuickActions(
    onCheckIn: () -> Unit,
    onOpenTasks: () -> Unit,
    onOpenMessages: () -> Unit,
    onOpenSchedule: () -> Unit = {},
    onNewAssignment: () -> Unit = {},
) {
    // Web parity: horizontal scroll, 5 pill actions.
    Row(
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        modifier = Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()),
    ) {
        QuickActionPill(icon = "✓", label = "Check in now", primary = true, onClick = onCheckIn)
        QuickActionPill(icon = "▦", label = "Submit task", primary = false, onClick = onOpenTasks)
        QuickActionPill(icon = "📅", label = "Today's schedule", primary = false, onClick = onOpenSchedule)
        QuickActionPill(icon = "✉", label = "Open messages", primary = false, onClick = onOpenMessages)
        QuickActionPill(icon = "+", label = "New assignment", primary = false, onClick = onNewAssignment)
    }
}

@Composable
private fun QuickActionPill(
    icon: String,
    label: String,
    primary: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    OutlinedButton(
        onClick = onClick,
        shape = RoundedCornerShape(999.dp),
        modifier = modifier,
        colors = androidx.compose.material3.ButtonDefaults.outlinedButtonColors(
            containerColor = if (primary) Accent else Surface,
            contentColor = if (primary) Color.White else Accent,
        ),
    ) {
        Text("$icon $label", style = MaterialTheme.typography.bodySmall)
    }
}

// Live-preview entry points: open Design mode (split pane) in Android
// Studio and every edit below re-renders instantly without a device.
@Preview(showBackground = true, name = "Home — header + stats + actions")
@Composable
private fun HomeComponentsPreview() {
    StarsTaskTheme {
        Column(
            modifier = Modifier.padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            DashboardHeader(
                greeting = "Good morning",
                name = "StarsTask member",
                summaryParts = listOf("2 sessions today", "1 assignment due"),
                dateLabel = "Friday, 6 November 2026",
                now = java.time.ZonedDateTime.of(
                    2026, 11, 6, 8, 30,
                    0, 0, java.time.ZoneId.of("Asia/Jakarta"),
                ),
            )
            SectionTitle(text = "Overview")
            Row(
                horizontalArrangement = Arrangement.spacedBy(10.dp),
                modifier = Modifier.fillMaxWidth(),
            ) {
                StatCard(
                    label = "Sessions",
                    value = 2,
                    icon = "◐",
                    tone = "default",
                    modifier = Modifier.weight(1f),
                )
                StatCard(
                    label = "Due soon",
                    value = 1,
                    icon = "!",
                    tone = "warning",
                    modifier = Modifier.weight(1f),
                )
            }
            QuickActions(
                onCheckIn = {},
                onOpenTasks = {},
                onOpenMessages = {},
            )
        }
    }
}

@Preview(showBackground = true, name = "Home — stat card tones")
@Composable
private fun StatCardTonesPreview() {
    StarsTaskTheme {
        Column(
            modifier = Modifier.padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            StatCard(label = "Default", value = 3, icon = "◐", tone = "default")
            StatCard(label = "Warning", value = 1, icon = "!", tone = "warning")
            StatCard(label = "Danger", value = 2, icon = "✕", tone = "danger")
            StatCard(label = "Success", value = 5, icon = "✓", tone = "success")
        }
    }
}

@Composable
private fun MyClassRow(clazz: id.starstask.mobile.data.DashboardClass) {
    Card(colors = CardDefaults.cardColors(containerColor = Surface), shape = RoundedCornerShape(12.dp), modifier = Modifier.fillMaxWidth()) {
        Row(modifier = Modifier.padding(12.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            ClassLandscapeTile(index = clazz.id.hashCode().mod(4))
            Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
                    Text(clazz.name, color = Foreground, style = MaterialTheme.typography.bodyMedium, modifier = Modifier.weight(1f, fill = false))
                    if (clazz.slug.isNotEmpty()) {
                        Box(
                            modifier = Modifier
                                .clip(RoundedCornerShape(4.dp))
                                .background(MutedFill)
                                .padding(horizontal = 6.dp, vertical = 2.dp),
                            contentAlignment = Alignment.Center,
                        ) {
                            Text(clazz.slug, color = MutedForeground, style = MaterialTheme.typography.bodySmall)
                        }
                    }
                    if (clazz.isAdmin) {
                        Box(
                            modifier = Modifier
                                .clip(RoundedCornerShape(4.dp))
                                .background(AccentSoft)
                                .padding(horizontal = 6.dp, vertical = 2.dp),
                            contentAlignment = Alignment.Center,
                        ) {
                            Text("Class admin", color = Accent, style = MaterialTheme.typography.bodySmall)
                        }
                    }
                }
                if (clazz.adminName != null) {
                    Text("🛡 Admin: ${clazz.adminName}", color = MutedForeground, style = MaterialTheme.typography.bodySmall)
                }
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Box(
                        modifier = Modifier
                            .clip(RoundedCornerShape(6.dp))
                            .background(Subtle)
                            .padding(horizontal = 8.dp, vertical = 4.dp),
                        contentAlignment = Alignment.Center,
                    ) {
                        Text("📖 ${clazz.subjectCount} subject${if (clazz.subjectCount == 1) "" else "s"}", color = Foreground, style = MaterialTheme.typography.bodySmall)
                    }
                    Box(
                        modifier = Modifier
                            .clip(RoundedCornerShape(6.dp))
                            .background(Subtle)
                            .padding(horizontal = 8.dp, vertical = 4.dp),
                        contentAlignment = Alignment.Center,
                    ) {
                        Text("▦ ${clazz.taskCount} task${if (clazz.taskCount == 1) "" else "s"}", color = Foreground, style = MaterialTheme.typography.bodySmall)
                    }
                }
                if (clazz.semester.isNotEmpty() || clazz.academicYear.isNotEmpty()) {
                    Text("${clazz.semester} ${clazz.academicYear}".trim(), color = MutedForeground, style = MaterialTheme.typography.bodySmall)
                }
            }
            Text("›", color = MutedForeground, style = MaterialTheme.typography.titleLarge)
        }
    }
}

/**
 * Brand landscape tile (web `hero-dashboard.svg`): dawn sky + layered
 * mountains, cropped at a different horizontal offset per class so each
 * tile reads separately — same 4 positions as web IMAGE_POSITIONS.
 */
@Composable
private fun ClassLandscapeTile(index: Int) {
    val offsetFractions = listOf(0f, 0.33f, 0.66f, 1f)
    val fraction = offsetFractions[index % offsetFractions.size]
    Canvas(
        modifier = Modifier
            .size(56.dp)
            .clip(RoundedCornerShape(8.dp)),
    ) {
        val w = size.width
        val h = size.height
        // Sky + glow (SVG stops #dce8f8 → #eef2f8 → #fbf8f2; glow #ffe8c8).
        drawRect(
            brush = Brush.verticalGradient(
                listOf(Color(0xFFDCE8F8), Color(0xFFEEF2F8), Color(0xFFFBF8F2)),
                startY = 0f,
                endY = h,
            ),
        )
        drawCircle(
            brush = Brush.radialGradient(
                listOf(Color(0xFFFFE8C8).copy(alpha = 0.95f), Color.Transparent),
                center = androidx.compose.ui.geometry.Offset(w * 0.72f, h * 0.72f),
                radius = w * 0.5f,
            ),
            radius = w * 0.5f,
            center = androidx.compose.ui.geometry.Offset(w * 0.72f, h * 0.72f),
        )
        // Layered ridges, shifted by the per-class crop fraction.
        val shift = -fraction * w * 1.2f
        fun ridge(baseY: Float, amp: Float, color: Color, alpha: Float) {
            val path = Path().apply {
                moveTo(shift, baseY)
                val points = listOf(0f, 0.12f, 0.25f, 0.38f, 0.5f, 0.62f, 0.75f, 0.88f, 1f, 1.12f, 1.25f)
                points.forEachIndexed { i, xf ->
                    val y = baseY + java.util.Random((i * 31 + index).toLong()).nextFloat().let { (it - 0.5f) * amp }
                    lineTo(shift + w * xf, y)
                }
                lineTo(shift + w * 1.25f, h)
                lineTo(shift, h)
                close()
            }
            drawPath(path, color.copy(alpha = alpha))
        }
        ridge(h * 0.64f, h * 0.18f, Color(0xFFB9C9DE), 0.75f)
        ridge(h * 0.74f, h * 0.16f, Color(0xFF8FA6C4), 0.85f)
        ridge(h * 0.86f, h * 0.14f, Color(0xFF6F88A8), 0.9f)
        drawRect(Color(0xFFF7F5F0).copy(alpha = 0.9f), topLeft = androidx.compose.ui.geometry.Offset(0f, h * 0.93f), size = androidx.compose.ui.geometry.Size(w, h * 0.07f))
    }
}

@Composable
private fun MyWeekStrip(schedule: List<ScheduleEntry>) {
    val today = java.time.LocalDate.now(java.time.ZoneId.of("Asia/Jakarta"))
    val monday = today.minusDays((today.dayOfWeek.value - 1).toLong())

    Column(modifier = Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Row(horizontalArrangement = Arrangement.spacedBy(6.dp), modifier = Modifier.fillMaxWidth()) {
            (0..6).forEach { offset ->
                val day = monday.plusDays(offset.toLong())
                val daySessions = schedule.filter {
                    id.starstask.mobile.data.jakartaDate(it.startsAt) == day.toString()
                }
                Column(
                    horizontalAlignment = Alignment.CenterHorizontally,
                    modifier = Modifier
                        .weight(1f)
                        .clip(RoundedCornerShape(10.dp))
                        .background(if (day == today) id.starstask.mobile.ui.theme.AccentSoft else Surface)
                        .padding(vertical = 8.dp),
                ) {
                    Text(day.dayOfWeek.toString().take(3), style = MaterialTheme.typography.bodySmall, color = MutedForeground)
                    Text(day.dayOfMonth.toString(), style = MaterialTheme.typography.titleMedium, color = Foreground)
                    Text(
                        if (daySessions.isEmpty()) "·" else "${daySessions.size}",
                        style = MaterialTheme.typography.bodySmall,
                        color = Accent,
                    )
                }
            }
        }
        // Per-day session lists (web MyWeekSection parity).
        (0..6).forEach { offset ->
            val day = monday.plusDays(offset.toLong())
            val daySessions = schedule.filter {
                id.starstask.mobile.data.jakartaDate(it.startsAt) == day.toString()
            }
            if (daySessions.isNotEmpty()) {
                Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    Text(
                        "${day.dayOfWeek} · ${day.dayOfMonth}/${day.monthValue}${if (day == today) " · Today" else ""}",
                        color = if (day == today) Accent else MutedForeground,
                        style = MaterialTheme.typography.bodySmall,
                    )
                    daySessions.forEach { entry ->
                        Card(colors = CardDefaults.cardColors(containerColor = Surface), shape = RoundedCornerShape(12.dp), modifier = Modifier.fillMaxWidth()) {
                            Column(modifier = Modifier.padding(12.dp)) {
                                Text(entry.title, color = Foreground)
                                Text(
                                    "${formatTime(entry.startsAt)}-${formatTime(entry.endsAt)} · ${entry.className ?: ""}",
                                    color = MutedForeground,
                                    style = MaterialTheme.typography.bodySmall,
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}
