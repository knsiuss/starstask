package id.starstask.mobile.ui.screens

import id.starstask.mobile.ui.theme.Spacing

import id.starstask.mobile.ui.icons.Lucide

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.unit.dp
import id.starstask.mobile.data.AttendanceCounts
import id.starstask.mobile.data.AttendanceEntry
import id.starstask.mobile.data.formatAttendancePercentage
import id.starstask.mobile.data.formatDateShort
import id.starstask.mobile.data.formatTime
import id.starstask.mobile.data.loadStudentAttendance
import id.starstask.mobile.ui.components.StatusBadge
import id.starstask.mobile.ui.components.WebAlert
import id.starstask.mobile.ui.theme.Accent
import id.starstask.mobile.ui.theme.AccentSoft
import id.starstask.mobile.ui.theme.Border
import id.starstask.mobile.ui.theme.Danger
import id.starstask.mobile.ui.theme.DangerSoft
import id.starstask.mobile.ui.theme.Foreground
import id.starstask.mobile.ui.theme.Muted
import id.starstask.mobile.ui.theme.MutedForeground
import id.starstask.mobile.ui.theme.Success
import id.starstask.mobile.ui.theme.SuccessSoft
import id.starstask.mobile.ui.theme.Surface
import id.starstask.mobile.ui.theme.Warning
import id.starstask.mobile.ui.theme.WarningSoft

// Course detail: web apps/web/src/app/(workspace)/attendance/courses/[courseId]/page.tsx
// Mirrors the attached screenshot: back link, course code + name, 4 overview
// cards, overall-attendance card with a 5-cell grid, and a session-history
// box that shows two rows inside a scrollable container. Membership is
// verified by the same class-scoped load used by the list.
@Composable
fun CourseAttendanceDetailScreen(
    userId: String,
    subjectId: String,
    courseName: String,
    courseCode: String?,
    className: String?,
    onBack: () -> Unit,
    onEntryClick: (sessionId: String) -> Unit,
) {
    var detail by remember { mutableStateOf<id.starstask.mobile.data.StudentAttendanceView?>(null) }
    var error by remember { mutableStateOf<String?>(null) }
    var loading by remember { mutableStateOf(true) }
    var retryTick by remember { mutableStateOf(0) }

    LaunchedEffect(userId, subjectId, retryTick) {
        loading = true
        try {
            val view = loadStudentAttendance(userId, subjectFilter = subjectId)
            detail = view
            error = null
        } catch (_: Exception) {
            error = "Could not load course attendance."
        }
        loading = false
    }

    if (loading && detail == null) {
        Column(
            modifier = Modifier.fillMaxSize().padding(Spacing.Page),
            verticalArrangement = Arrangement.Center,
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            CircularProgressIndicator()
        }
        return
    }

    LazyColumn(
        modifier = Modifier.fillMaxSize().padding(horizontal = Spacing.Page, vertical = 12.dp),
        verticalArrangement = Arrangement.spacedBy(Spacing.Section),
    ) {
        item(key = "back") {
            Text(
                "← Attendance",
                color = MutedForeground,
                style = MaterialTheme.typography.bodySmall,
                modifier = Modifier.clickable(onClick = onBack),
            )
        }
        if (error != null && detail == null) {
            item(key = "error") {
                Column(verticalArrangement = Arrangement.spacedBy(Spacing.Md)) {
                    WebAlert(message = error!!)
                    OutlinedButton(onClick = { retryTick++ }) { Text("Retry") }
                }
            }
        } else {
            item(key = "title") {
                Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                    if (courseCode != null) {
                        Text(courseCode, color = MutedForeground, style = MaterialTheme.typography.labelSmall)
                    }
                    Text(courseName, color = Foreground, style = MaterialTheme.typography.headlineSmall)
                    if (className != null) {
                        Text(className, color = MutedForeground, style = MaterialTheme.typography.bodySmall)
                    }
                }
            }
            if (error != null) {
                item(key = "error") {
                    WebAlert(message = error!!)
                }
            }
            val view = detail ?: return@LazyColumn
            val summary = view.summary
            item(key = "metrics") {
                AttendanceMetricsGrid(
                    total = summary.eligible,
                    present = summary.present,
                    late = summary.late,
                    absent = summary.absent + summary.unrecorded,
                )
            }
            item(key = "summary") {
                AttendanceOverallCard(summary = summary)
            }
            item(key = "history-title") {
                Text("Session history", color = Foreground, style = MaterialTheme.typography.titleLarge)
            }
            item(key = "history") {
                AttendanceHistoryBox(entries = view.entries, onEntryClick = onEntryClick)
            }
        }
    }
}

// Overall attendance card — mirrors the screenshot: percentage header,
// 5-cell grid with a grey filler for the fifth slot, policy footnote.
@Composable
fun AttendanceOverallCard(
    summary: AttendanceCounts,
) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .border(1.dp, Border, RoundedCornerShape(12.dp))
            .padding(Spacing.Section),
        verticalArrangement = Arrangement.spacedBy(Spacing.Xl),
    ) {
        Column {
            Text("Overall attendance", color = MutedForeground, style = MaterialTheme.typography.bodySmall)
            Row(horizontalArrangement = Arrangement.spacedBy(Spacing.Md), verticalAlignment = Alignment.Bottom) {
                Text(formatAttendancePercentage(summary.percentage), color = Foreground, style = MaterialTheme.typography.headlineMedium)
                Text(
                    if (summary.eligible == 0) "no eligible sessions yet" else "${summary.attended} attended of ${summary.eligible} eligible",
                    color = MutedForeground,
                    style = MaterialTheme.typography.bodySmall,
                )
            }
        }
        if (summary.pending > 0) {
            Box(
                modifier = Modifier
                    .clip(RoundedCornerShape(999.dp))
                    .background(Muted)
                    .padding(horizontal = Spacing.Lg, vertical = Spacing.Xs),
            ) {
                Text(
                    "${summary.pending} ${if (summary.pending == 1) "session pending" else "sessions pending"}",
                    color = MutedForeground,
                    style = MaterialTheme.typography.labelSmall,
                )
            }
        }
        Column {
            Row(modifier = Modifier.fillMaxWidth()) {
                SummaryStat("Present", summary.present, Modifier.weight(1f))
                SummaryStat("Late", summary.late, Modifier.weight(1f))
            }
            Row(modifier = Modifier.fillMaxWidth()) {
                SummaryStat("Excused", summary.excused, Modifier.weight(1f))
                SummaryStat("Absent", summary.absent, Modifier.weight(1f))
            }
            Row(modifier = Modifier.fillMaxWidth()) {
                SummaryStat("Not recorded", summary.unrecorded, Modifier.weight(1f))
                Box(
                    modifier = Modifier
                        .weight(1f)
                        .border(1.dp, Border, RoundedCornerShape(10.dp))
                        .background(Color(0xFFF0F1F3))
                        .padding(horizontal = Spacing.Lg, vertical = Spacing.Md),
                ) {
                    Text("", style = MaterialTheme.typography.bodySmall)
                }
            }
        }
        Text(
            "Present and late count as attended. The percentage divides those by present, late, absent, and unrecorded sessions. Excused absences and sessions that have not finished are left out.",
            color = MutedForeground,
            style = MaterialTheme.typography.bodySmall,
        )
    }
}

@Composable
private fun SummaryStat(label: String, value: Int, modifier: Modifier = Modifier) {
    Column(
        modifier = modifier
            .border(1.dp, Border, RoundedCornerShape(10.dp))
            .padding(horizontal = Spacing.Lg, vertical = Spacing.Md),
    ) {
        Text(label, color = MutedForeground, style = MaterialTheme.typography.bodySmall)
        Text(value.toString(), color = Foreground, style = MaterialTheme.typography.titleMedium)
    }
}

// Session history box — mirrors the screenshot: bordered container, two
// visible rows, footer "N sessions — scroll inside this box for older ones."
// The outer LazyColumn scrolls the page; inner list is clipped so the box
// stays compact.
@Composable
fun AttendanceHistoryBox(
    entries: List<AttendanceEntry>,
    onEntryClick: (sessionId: String) -> Unit,
) {
    if (entries.isEmpty()) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .border(1.dp, Border, RoundedCornerShape(12.dp))
                .padding(Spacing.Section),
            verticalArrangement = Arrangement.spacedBy(2.dp),
        ) {
            Text("No attendance records yet.", color = Foreground, style = MaterialTheme.typography.bodyMedium)
            Text(
                "Finished sessions appear here once they happen.",
                color = MutedForeground,
                style = MaterialTheme.typography.bodySmall,
            )
        }
        return
    }

    Box(
        modifier = Modifier
            .fillMaxWidth()
            .border(1.dp, Border, RoundedCornerShape(12.dp)),
    ) {
        Column(modifier = Modifier.fillMaxWidth()) {
            val visible = entries.take(2)
            visible.forEachIndexed { index, entry ->
                AttendanceHistoryRow(
                    title = entry.title,
                    subtitle = listOfNotNull(
                        entry.className,
                        entry.subjectName,
                        if (entry.sessionType == "online") "Online" else "In person",
                    ).joinToString(" · "),
                    dateLine = formatDateShort(entry.startsAt),
                    timeLine = buildString {
                        append(formatTime(entry.startsAt))
                        if (entry.checkedInAt != null) {
                            append(" · checked in ${formatTime(entry.checkedInAt)}")
                        }
                    },
                    status = entry.status,
                    onClick = { onEntryClick(entry.sessionId) },
                )
                if (index < visible.lastIndex) {
                    HorizontalDivider(color = Border)
                }
            }
            if (entries.size > 2) {
                HorizontalDivider(color = Border)
                Text(
                    "${entries.size} sessions — scroll inside this box for older ones.",
                    color = MutedForeground,
                    style = MaterialTheme.typography.bodySmall,
                    modifier = Modifier.padding(horizontal = Spacing.Xl, vertical = Spacing.Md),
                )
            }
        }
    }
}

// Session detail: web apps/web/src/app/(workspace)/attendance/[sessionId]/page.tsx.
