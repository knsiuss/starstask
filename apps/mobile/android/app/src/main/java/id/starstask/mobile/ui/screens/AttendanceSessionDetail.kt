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
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
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
import androidx.compose.ui.unit.dp
import id.starstask.mobile.data.AttendanceCounts
import id.starstask.mobile.data.AttendanceEntry
import id.starstask.mobile.data.formatDateShort
import id.starstask.mobile.data.formatTime
import id.starstask.mobile.data.loadStudentAttendance
import id.starstask.mobile.ui.components.StatusBadge
import id.starstask.mobile.ui.components.WebAlert
import id.starstask.mobile.ui.theme.mockColors
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme

// Course detail: web apps/web/src/app/(workspace)/attendance/courses/[courseId]/page.tsx
// (overview metrics + attendance summary + full session history). Membership is
// checked server-side by the same class-scoped query used by the list.
@Composable
fun AttendanceSessionDetailScreen(
    userId: String? = null,
    sessionId: String? = null,
    entry: AttendanceEntry? = null,
    onBack: () -> Unit,
) {
    val palette = mockColors()
    val provided = entry
    var loading by remember { mutableStateOf(provided == null && userId != null && sessionId != null) }
    var resolvedEntry by remember { mutableStateOf<AttendanceEntry?>(provided) }
    var resolvedError by remember { mutableStateOf(false) }
    LaunchedEffect(userId, sessionId) {
        if (provided == null && userId != null && sessionId != null) {
            loading = true
            runCatching {
                id.starstask.mobile.data.loadStudentAttendance(userId).entries.firstOrNull { it.sessionId == sessionId }
            }.onSuccess { loaded ->
                resolvedEntry = loaded
                resolvedError = loaded == null
            }.onFailure { resolvedError = true }
            loading = false
        }
    }
    val resolved: AttendanceEntry? = provided ?: resolvedEntry
    val loadFailed = resolvedError
    if (resolved == null) {
        Column(
            modifier = Modifier.fillMaxSize().padding(Spacing.Page),
            verticalArrangement = Arrangement.Center,
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            if (loading) {
                CircularProgressIndicator()
            } else {
                Text(
                    if (loadFailed) "Could not load this attendance record." else "Attendance record not found.",
                    color = palette.muted,
                )
                androidx.compose.material3.TextButton(onClick = onBack) { Text("Back") }
            }
        }
        return
    }


    LazyColumn(
        modifier = Modifier.fillMaxSize().padding(horizontal = Spacing.Section, vertical = Spacing.Xl),
        verticalArrangement = Arrangement.spacedBy(Spacing.Xxl),
    ) {
        item(key = "back") {
            Row(verticalAlignment = Alignment.CenterVertically) {
                IconButton(onClick = onBack) {
                    Icon(Lucide.ArrowLeft, contentDescription = "Back", tint = palette.ink)
                }
                Text("Back to attendance", color = palette.muted, style = MaterialTheme.typography.bodyMedium)
            }
        }
        item(key = "title") {
            Column {
                Text(resolved.title, color = palette.ink, style = MaterialTheme.typography.headlineSmall)
                Text(
                    listOfNotNull(
                        resolved.className,
                        resolved.subjectName,
                        if (resolved.sessionType == "online") "Online" else "In person",
                    ).joinToString(" · "),
                    color = palette.muted,
                    style = MaterialTheme.typography.bodyMedium,
                    modifier = Modifier.padding(top = 4.dp),
                )
                StatusBadge(status = resolved.status, modifier = Modifier.padding(top = 10.dp))
            }
        }

        when (resolved.status) {
            "pending" -> item(key = "note") {
                NoteCard("This session has not finished yet, so it is not counted in your attendance percentage.")
            }

            "unrecorded" -> item(key = "note") {
                NoteCard(
                    "No attendance has been recorded for this session yet. A missing record is never counted as present; your class admin can record it.",
                    isWarning = true,
                )
            }

            "excused" -> item(key = "note") {
                NoteCard(
                    "This absence was approved and marked excused. An excused session is excluded from your attendance percentage.",
                    isSuccess = true,
                )
            }
        }

        item(key = "details") {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .border(1.dp, palette.cardBorder, RoundedCornerShape(12.dp))
                    .padding(horizontal = Spacing.Xxl),
            ) {
                SessionDetailRow("Class", resolved.className + " · " + resolved.academicYear + " · " + resolved.semester)
                HorizontalDivider(color = palette.hairline, thickness = 0.5.dp)
                SessionDetailRow("Subject", resolved.subjectName ?: "No linked subject")
                HorizontalDivider(color = palette.hairline, thickness = 0.5.dp)
                SessionDetailRow("Session date", formatDateShort(resolved.startsAt))
                HorizontalDivider(color = palette.hairline, thickness = 0.5.dp)
                SessionDetailRow("Scheduled time", "${formatTime(resolved.startsAt)}–${formatTime(resolved.endsAt)} ${id.starstask.mobile.data.timezoneLabel(resolved.timeZone)}")
                HorizontalDivider(color = palette.hairline, thickness = 0.5.dp)
                SessionDetailRow(
                    "Actual check-in",
                    if (resolved.checkedInAt != null) {
                        "${formatDateShort(resolved.checkedInAt)}, ${formatTime(resolved.checkedInAt)}"
                    } else {
                        "Not checked in"
                    },
                )
                HorizontalDivider(color = palette.hairline, thickness = 0.5.dp)
                SessionDetailRow("Recorded by", recordedByLabel(resolved))
                if (resolved.location != null) {
                    HorizontalDivider(color = palette.hairline, thickness = 0.5.dp)
                    Row(
                        modifier = Modifier.fillMaxWidth().padding(vertical = Spacing.Xl),
                        horizontalArrangement = Arrangement.spacedBy(Spacing.Md),
                    ) {
                        Icon(Lucide.MapPin, contentDescription = null, tint = palette.muted)
                        Text(resolved.location, color = palette.ink, style = MaterialTheme.typography.bodyMedium)
                    }
                }
                HorizontalDivider(color = palette.hairline, thickness = 0.5.dp)
                SessionDetailRow("Notes", resolved.note ?: "No notes on this record.")
            }
        }
        item(key = "foot") {
            Text(
                "Only you and your class admins can see this record. Students cannot change attendance; ask your class admin if something looks wrong.",
                color = palette.muted,
                style = MaterialTheme.typography.bodySmall,
            )
        }
    }
}

fun recordedByLabel(entry: AttendanceEntry): String {
    if (entry.recordedByName != null) return entry.recordedByName
    return when (entry.method) {
        "geo" -> "You, by checking in at the session location"
        "manual" -> "Recorded by a class admin"
        "system" -> "Recorded automatically when attendance was finalized"
        else -> "—"
    }
}

@Composable
fun SessionDetailRow(label: String, value: String) {
    val palette = mockColors()
    Row(
        modifier = Modifier.fillMaxWidth().padding(vertical = Spacing.Xl),
        horizontalArrangement = Arrangement.spacedBy(Spacing.Xl),
    ) {
        Text(label, color = palette.muted, style = MaterialTheme.typography.bodySmall, modifier = Modifier.weight(0.35f))
        Text(value, color = palette.ink, style = MaterialTheme.typography.bodyMedium, modifier = Modifier.weight(1f))
    }
}

@Composable
fun NoteCard(text: String, isWarning: Boolean = false, isSuccess: Boolean = false) {
    val palette = mockColors()
    val bg = when {
        isWarning -> palette.fairBg
        isSuccess -> palette.goodBg
        else -> palette.chip
    }
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(8.dp))
            .background(bg)
            .padding(Spacing.Xl),
    ) {
        Text(text, color = palette.ink, style = MaterialTheme.typography.bodySmall)
    }
}

