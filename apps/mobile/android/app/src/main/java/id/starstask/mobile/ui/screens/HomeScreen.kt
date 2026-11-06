package id.starstask.mobile.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
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
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import id.starstask.mobile.data.AcademicContext
import id.starstask.mobile.data.DashboardData
import id.starstask.mobile.data.Invitation
import id.starstask.mobile.data.LeaveRequest
import id.starstask.mobile.data.NotificationRow
import id.starstask.mobile.data.ScheduleEntry
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
import id.starstask.mobile.ui.theme.Border
import id.starstask.mobile.ui.theme.Danger
import id.starstask.mobile.ui.theme.Foreground
import id.starstask.mobile.ui.theme.MutedForeground
import id.starstask.mobile.ui.theme.StarsTaskTheme
import id.starstask.mobile.ui.theme.Surface
import id.starstask.mobile.ui.theme.Warning
import kotlinx.coroutines.delay

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

        if ((current?.pastDeadline ?: 0) > 0) {
            item {
                Card(
                    colors = CardDefaults.cardColors(containerColor = Color(0xFFFBF3E4)),
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    Text(
                        "⚠ ${current!!.pastDeadline} past deadlines need your attention.",
                        modifier = Modifier.padding(16.dp),
                        color = Warning,
                    )
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
            item { SectionTitle("Next schedule") }
            item {
                Card(colors = CardDefaults.cardColors(containerColor = Surface), shape = RoundedCornerShape(12.dp), modifier = Modifier.fillMaxWidth()) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Text(schedule.first().title, color = Foreground)
                        Text(
                            "${schedule.first().className ?: ""} · ${formatTime(schedule.first().startsAt)}-${formatTime(schedule.first().endsAt)}",
                            color = MutedForeground,
                            style = MaterialTheme.typography.bodySmall,
                        )
                    }
                }
            }
            item { SectionTitle("My week") }
            item { MyWeekStrip(schedule = schedule) }
        }

        if (!current?.classes.isNullOrEmpty()) {
            item { SectionTitle("My classes") }
            items(current!!.classes, key = { it.id }) { clazz ->
                Card(colors = CardDefaults.cardColors(containerColor = Surface), shape = RoundedCornerShape(12.dp), modifier = Modifier.fillMaxWidth()) {
                    Row(modifier = Modifier.padding(16.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                        Box(
                            modifier = Modifier
                                .clip(RoundedCornerShape(10.dp))
                                .background(AccentSoft)
                                .padding(horizontal = 12.dp, vertical = 8.dp),
                        ) {
                            Text(clazz.name.firstOrNull()?.uppercase() ?: "S", color = Accent, style = MaterialTheme.typography.titleMedium)
                        }
                        Column(modifier = Modifier.weight(1f)) {
                            Text(clazz.name, color = Foreground)
                        }
                        Text("›", color = MutedForeground)
                    }
                }
            }
            item {
                OutlinedButton(onClick = onOpenClasses, modifier = Modifier.fillMaxWidth()) {
                    Text("View all")
                }
            }
        }

        if (invitations.isNotEmpty()) {
            item { SectionTitle("Invitations") }
            items(invitations, key = { it.id }) { invitation ->
                Card(colors = CardDefaults.cardColors(containerColor = Surface), shape = RoundedCornerShape(12.dp), modifier = Modifier.fillMaxWidth()) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Text(invitation.className ?: "Class invitation", color = Foreground)
                        Text("You were invited to join this class.", color = MutedForeground, style = MaterialTheme.typography.bodySmall)
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

        item {
            Card(colors = CardDefaults.cardColors(containerColor = Color(0xFFEEF3FC)), shape = RoundedCornerShape(12.dp), modifier = Modifier.fillMaxWidth()) {
                Column(modifier = Modifier.padding(16.dp)) {
                    Text("What's new", style = MaterialTheme.typography.titleMedium, color = Foreground)
                    Text(
                        "Encrypted direct messages and GPS check-in are now on mobile.",
                        color = MutedForeground,
                        style = MaterialTheme.typography.bodySmall,
                    )
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
        Row(
            modifier = Modifier.fillMaxWidth(),
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
            // BrandMark parity (web: BrandMark size 88, right side).
            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(2.dp),
            ) {
                Box(
                    modifier = Modifier
                        .clip(RoundedCornerShape(16.dp))
                        .background(AccentSoft)
                        .padding(horizontal = 14.dp, vertical = 10.dp),
                    contentAlignment = Alignment.Center,
                ) {
                    Text("★", color = Accent, style = MaterialTheme.typography.headlineSmall)
                }
                Text("StarsTask", color = Accent, style = MaterialTheme.typography.bodySmall)
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
