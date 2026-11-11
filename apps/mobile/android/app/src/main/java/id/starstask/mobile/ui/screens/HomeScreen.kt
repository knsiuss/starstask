package id.starstask.mobile.ui.screens

// Redesigned pastel dashboard: top bar (brand + theme toggle + unread
// notifications badge), gradient greeting hero with task-publication CTA,
// past-deadline alert card, "This Week" strip,
// then grouped white cards for assignments, classes, invitations,
// academic identity, and the what's-new card. All data comes from the same
// Supabase loaders as before; nothing is hardcoded except general
// interface copy (section titles, button labels, empty states).

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
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
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import id.starstask.mobile.data.AcademicCard
import id.starstask.mobile.data.DashboardData
import id.starstask.mobile.data.Invitation
import id.starstask.mobile.data.ScheduleEntry
import id.starstask.mobile.data.acceptPendingInvitation
import id.starstask.mobile.data.declineInvitation
import id.starstask.mobile.data.formatTime
import id.starstask.mobile.data.loadAcademicCard
import id.starstask.mobile.data.loadDashboard
import id.starstask.mobile.data.loadInvitations
import id.starstask.mobile.data.loadNextSchedule
import id.starstask.mobile.data.loadSchedule
import id.starstask.mobile.ui.icons.Lucide
import id.starstask.mobile.ui.screens.QuickActions
import id.starstask.mobile.ui.screens.dashboard.DashHero
import id.starstask.mobile.ui.screens.dashboard.DashNextTaskCard
import id.starstask.mobile.ui.screens.dashboard.DashSectionHeader
import id.starstask.mobile.ui.screens.dashboard.DashWeekStrip
import id.starstask.mobile.data.NextScheduleItem
import id.starstask.mobile.ui.theme.DashRadiusCard
import id.starstask.mobile.ui.theme.DashRadiusPill
import id.starstask.mobile.ui.theme.dashColors
import id.starstask.mobile.ui.theme.Danger
import kotlinx.coroutines.launch

@Composable
fun HomeScreen(
    userId: String,
    userEmail: String?,
    onCheckIn: (String) -> Unit,
    onOpenTasks: () -> Unit = {},
    onOpenMessages: () -> Unit = {},
    onOpenSchedule: () -> Unit = {},
    onNewAssignment: () -> Unit = {},
    onOpenAttendance: () -> Unit = {},
) {
    var data by remember { mutableStateOf<DashboardData?>(null) }
    var error by remember { mutableStateOf<String?>(null) }
    var schedule by remember { mutableStateOf<List<ScheduleEntry>>(emptyList()) }
    var invitations by remember { mutableStateOf<List<Invitation>>(emptyList()) }
    var academicCard by remember { mutableStateOf<AcademicCard?>(null) }
    var nextSchedule by remember { mutableStateOf<NextScheduleItem?>(null) }
    var invitationBusyId by remember { mutableStateOf<String?>(null) }
    var invitationFeedback by remember { mutableStateOf<String?>(null) }
    val appContext = LocalContext.current
    val whatsNewPrefs = remember {
        appContext.getSharedPreferences("starstask-whats-new", android.content.Context.MODE_PRIVATE)
    }
    var whatsNewDismissed by remember {
        mutableStateOf(whatsNewPrefs.getString("starstask-whats-new-seen", null) == "2026-11-05")
    }
    val scope = rememberCoroutineScope()

    LaunchedEffect(userId) {
        // Fetches are independent; run them in parallel so the dashboard
        // doesn't wait on five sequential Supabase round-trips.
        kotlinx.coroutines.coroutineScope {
            launch { runCatching { data = loadDashboard(userId) }.onFailure { error = "Could not load your dashboard. Check your connection and try again." } }
            launch { runCatching { schedule = loadSchedule(userId) } }
            launch { runCatching { invitations = loadInvitations(userId, userEmail) } }
            launch { runCatching { academicCard = loadAcademicCard(userId) } }
            launch { runCatching { nextSchedule = loadNextSchedule(userId) } }
        }
    }

    val current = data
    val palette = dashColors()
    val assignmentDeadlines = remember(current) {
        current?.upcomingAssignments?.mapNotNull { it.deadline } ?: emptyList()
    }
    val nextTask = remember(current) {
        // upcomingAssignments is already published, deadline >= now-24h, ASC:
        // the first row is the most imminent task. When nothing is published
        // anymore, fall back to the most recent past-deadline assignment.
        current?.upcomingAssignments?.firstOrNull() ?: current?.latestPastAssignment
    }

    LazyColumn(
        modifier = Modifier.fillMaxSize().background(palette.pageBackground).padding(start = 16.dp, end = 16.dp, top = 12.dp, bottom = 104.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        item {
            DashHero(
                displayName = current?.displayName,
                classes = current?.classes.orEmpty(),
                onRequestTaskPublication = onNewAssignment,
            )
        }
        item {
            QuickActions(
                onCheckIn = { onOpenAttendance() },                onOpenTasks = onOpenTasks,
                onOpenMessages = onOpenMessages,
                onOpenSchedule = onOpenSchedule,
                onNewAssignment = onNewAssignment,
            )
        }

        nextSchedule?.let { item ->
            val whenLabel = if (item.kind == "session" && item.endsAt != null) {
                "${id.starstask.mobile.data.formatDateShort(item.at)}, ${formatTime(item.at)} – ${formatTime(item.endsAt)}"
            } else {
                "${id.starstask.mobile.data.formatDateShort(item.at)} at ${formatTime(item.at)}"
            }
            item {
                DashGroupedCard(onClick = onOpenTasks) {
                    Row(horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.CenterVertically) {
                        Box(
                            modifier = Modifier.size(40.dp).clip(RoundedCornerShape(10.dp)).background(palette.chip),
                            contentAlignment = Alignment.Center,
                        ) {
                            androidx.compose.material3.Icon(
                                if (item.kind == "assignment") Lucide.FileText else Lucide.CalendarDays,
                                contentDescription = null,
                                tint = palette.accent,
                                modifier = Modifier.size(20.dp),
                            )
                        }
                        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                            Text("Next up", color = palette.muted, style = MaterialTheme.typography.bodySmall)
                            Text(item.title, color = palette.text, maxLines = 1, overflow = TextOverflow.Ellipsis)
                            Text("${item.className} · ${item.detail} · $whenLabel", color = palette.muted, style = MaterialTheme.typography.bodySmall, maxLines = 1, overflow = TextOverflow.Ellipsis)
                        }
                    }
                }
            }
        }

        nextTask?.let { task ->
            item { DashNextTaskCard(task = task, onOpen = onOpenTasks) }
        }

        item { DashSectionHeader("This Week", actionLabel = "View Calendar", onAction = onOpenSchedule) }
        item { DashWeekStrip(schedule = schedule, assignmentDeadlines = assignmentDeadlines) }

        item { DashSectionHeader("Upcoming Assignments", actionLabel = "See all", onAction = onOpenTasks) }
        if (current?.upcomingAssignments.isNullOrEmpty()) {
            item { DashEmptyTile(text = "No upcoming assignments.") }
        } else {
            item {
                DashAssignmentGroup {
                    current.upcomingAssignments.forEachIndexed { index, assignment ->
                        DashAssignmentRow(
                            title = assignment.title,
                            meta = listOfNotNull(
                                assignment.subjectName?.takeIf { it.isNotBlank() },
                                assignment.deadline?.let { "${id.starstask.mobile.data.formatDateShort(it)} at ${formatTime(it)}" },
                            ).joinToString(" · "),
                            onClick = onOpenTasks,
                            showDivider = index != current.upcomingAssignments.lastIndex,
                        )
                    }
                }
            }
        }

        if (invitations.isNotEmpty() || invitationFeedback != null) {
            item { DashSectionHeader("Pending invitations") }
            item {
                Text(
                    "Invitations to join class groups. Accepting adds you to the group and all its subjects.",
                    color = palette.muted,
                    style = MaterialTheme.typography.bodySmall,
                )
            }
            if (invitationFeedback != null) {
                item { Text(invitationFeedback!!, color = palette.accent, style = MaterialTheme.typography.bodySmall) }
            }
            items(invitations, key = { it.id }) { invitation ->
                val busy = invitationBusyId == invitation.id
                DashGroupedCard(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    Text(invitation.className ?: "Class invitation", color = palette.text, style = MaterialTheme.typography.bodyMedium)
                    Text(
                        "Invited by ${invitation.adminName ?: "Class Admin"}",
                        color = palette.muted,
                        style = MaterialTheme.typography.bodySmall,
                    )
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
                            colors = ButtonDefaults.buttonColors(containerColor = palette.accent, contentColor = androidx.compose.ui.graphics.Color.White),
                            modifier = Modifier.weight(1f),
                        ) { Text(if (busy) "…" else "Accept") }
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
                        ) { Text("Decline") }
                    }
                }
            }
        }

        if (academicCard != null) {
            item { DashAcademicIdentityCard(card = academicCard!!) }
        }

        if (!whatsNewDismissed) {
            item {
                DashGroupedCard {
                    Row(horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.CenterVertically) {
                        Box(
                            modifier = Modifier.size(40.dp).clip(androidx.compose.foundation.shape.RoundedCornerShape(10.dp)).background(palette.chip),
                            contentAlignment = Alignment.Center,
                        ) {
                            androidx.compose.material3.Icon(id.starstask.mobile.ui.icons.Lucide.Sparkles, contentDescription = null, tint = palette.accent, modifier = Modifier.size(20.dp))
                        }
                        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                            Text("What's new", color = palette.text, fontWeight = androidx.compose.ui.text.font.FontWeight.SemiBold)
                            Text(
                                "Encrypted direct messages and GPS check-in are now on mobile.",
                                color = palette.muted,
                                style = MaterialTheme.typography.bodySmall,
                            )
                            Text(
                                "Instant navigation and loading skeletons.",
                                color = palette.muted,
                                style = MaterialTheme.typography.bodySmall,
                            )
                        }
                        Text(
                            "Dismiss",
                            color = palette.muted,
                            style = MaterialTheme.typography.bodySmall,
                            modifier = Modifier
                                .clip(DashRadiusPill)
                                .clickable {
                                    whatsNewPrefs.edit().putString("starstask-whats-new-seen", "2026-11-05").apply()
                                    whatsNewDismissed = true
                                }
                                .padding(horizontal = 8.dp, vertical = 4.dp),
                        )
                    }
                }
            }
        }

        if (error != null) {
            item { Text(error!!, color = id.starstask.mobile.ui.theme.Danger) }
        }
    }
}

@Composable
private fun DashGroupedCard(
    onClick: (() -> Unit)? = null,
    verticalArrangement: Arrangement.Vertical = Arrangement.spacedBy(0.dp),
    content: @Composable () -> Unit,
) {
    val palette = dashColors()
    val baseModifier = if (onClick != null) {
        Modifier.fillMaxWidth().clip(DashRadiusCard).background(palette.card).clickable(onClick = onClick)
    } else {
        Modifier.fillMaxWidth().clip(DashRadiusCard).background(palette.card)
    }
    androidx.compose.foundation.layout.Column(
        modifier = baseModifier.padding(16.dp),
        verticalArrangement = verticalArrangement,
    ) {
        content()
    }
}

@Composable
private fun DashEmptyTile(text: String) {
    val palette = dashColors()
    androidx.compose.material3.Surface(
        color = palette.card,
        shape = DashRadiusCard,
        modifier = Modifier.fillMaxWidth(),
    ) {
        Text(text, color = palette.muted, style = MaterialTheme.typography.bodySmall, modifier = Modifier.padding(16.dp))
    }
}

@Composable
private fun DashAcademicIdentityCard(card: AcademicCard) {
    val palette = dashColors()
    DashGroupedCard {
        Row(horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.CenterVertically) {
            if (card.linked) {
                Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                    Text(
                        card.universityName + (card.studentId?.let { " · $it" } ?: ""),
                        color = palette.text,
                        style = MaterialTheme.typography.bodyMedium,
                    )
                    Text(
                        (card.homeClassName?.let { "Home class: $it" } ?: "No home class assigned yet") + " · View academic identity",
                        color = palette.muted,
                        style = MaterialTheme.typography.bodySmall,
                    )
                }
            } else {
                Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
                    Text("Not linked to a university yet", color = palette.text, style = MaterialTheme.typography.bodyMedium)
                    Text(
                        "Find your university and request access from its operator.",
                        color = palette.muted,
                        style = MaterialTheme.typography.bodySmall,
                    )
                }
            }
        }
    }
}

@Composable
private fun DashAssignmentGroup(content: @Composable () -> Unit) {
    val palette = dashColors()
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(DashRadiusCard)
            .background(palette.card),
    ) {
        content()
    }
}

@Composable
private fun DashAssignmentRow(
    title: String,
    meta: String,
    onClick: () -> Unit,
    showDivider: Boolean,
) {
    val palette = dashColors()
    Column(modifier = Modifier.fillMaxWidth()) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .clip(androidx.compose.foundation.shape.RoundedCornerShape(0.dp))
                .clickable(onClick = onClick)
                .padding(horizontal = 12.dp, vertical = 10.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            androidx.compose.foundation.layout.Box(
                modifier = Modifier
                    .size(36.dp)
                    .clip(androidx.compose.foundation.shape.RoundedCornerShape(10.dp))
                    .background(palette.chip),
                contentAlignment = Alignment.Center,
            ) {
                Lucide.FileText.let { icon ->
                    androidx.compose.material3.Icon(
                        icon,
                        contentDescription = null,
                        tint = palette.accent,
                        modifier = Modifier.size(18.dp),
                    )
                }
            }
            Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(1.dp)) {
                Text(
                    title,
                    color = palette.text,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    style = MaterialTheme.typography.bodyMedium,
                )
                if (meta.isNotBlank()) {
                    Text(
                        meta,
                        color = palette.muted,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                        style = MaterialTheme.typography.bodySmall,
                    )
                }
            }
            androidx.compose.material3.Icon(
                Lucide.ChevronRight,
                contentDescription = null,
                tint = palette.muted,
                modifier = Modifier.size(16.dp),
            )
        }
        if (showDivider) {
            androidx.compose.foundation.layout.Spacer(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(start = 60.dp)
                    .height(0.5.dp)
                    .background(palette.cardBorder),
            )
        }
    }
}
