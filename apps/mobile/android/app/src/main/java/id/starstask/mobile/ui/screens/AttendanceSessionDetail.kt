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
// (overview metrics + attendance summary + full session history). Membership is
// checked server-side by the same class-scoped query used by the list.
@Composable
fun AttendanceSessionDetailScreen(
    entry: AttendanceEntry?,
    onBack: () -> Unit,
) {
    if (entry == null) {
        Column(
            modifier = Modifier.fillMaxSize().padding(Spacing.Page),
            verticalArrangement = Arrangement.Center,
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Text("Attendance record not found.", color = MutedForeground)
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
                    Icon(Lucide.ArrowLeft, contentDescription = "Back", tint = Foreground)
                }
                Text("Back to attendance", color = MutedForeground, style = MaterialTheme.typography.bodyMedium)
            }
        }
        item(key = "title") {
            Column {
                Text(entry.title, color = Foreground, style = MaterialTheme.typography.headlineSmall)
                Text(
                    listOfNotNull(
                        entry.className,
                        entry.subjectName,
                        if (entry.sessionType == "online") "Online" else "In person",
                    ).joinToString(" · "),
                    color = MutedForeground,
                    style = MaterialTheme.typography.bodyMedium,
                    modifier = Modifier.padding(top = 4.dp),
                )
                StatusBadge(status = entry.status, modifier = Modifier.padding(top = 10.dp))
            }
        }

        when (entry.status) {
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
                    .border(1.dp, Border, RoundedCornerShape(12.dp))
                    .padding(horizontal = Spacing.Xxl),
            ) {
                SessionDetailRow("Class", entry.className + " · " + entry.academicYear + " · " + entry.semester)
                HorizontalDivider(color = Border)
                SessionDetailRow("Subject", entry.subjectName ?: "No linked subject")
                HorizontalDivider(color = Border)
                SessionDetailRow("Session date", formatDateShort(entry.startsAt))
                HorizontalDivider(color = Border)
                SessionDetailRow("Scheduled time", "${formatTime(entry.startsAt)}–${formatTime(entry.endsAt)} ${id.starstask.mobile.data.timezoneLabel(entry.timeZone)}")
                HorizontalDivider(color = Border)
                SessionDetailRow(
                    "Actual check-in",
                    if (entry.checkedInAt != null) {
                        "${formatDateShort(entry.checkedInAt)}, ${formatTime(entry.checkedInAt)}"
                    } else {
                        "Not checked in"
                    },
                )
                HorizontalDivider(color = Border)
                SessionDetailRow("Recorded by", recordedByLabel(entry))
                if (entry.location != null) {
                    HorizontalDivider(color = Border)
                    Row(
                        modifier = Modifier.fillMaxWidth().padding(vertical = Spacing.Xl),
                        horizontalArrangement = Arrangement.spacedBy(Spacing.Md),
                    ) {
                        Icon(Lucide.MapPin, contentDescription = null, tint = MutedForeground)
                        Text(entry.location, color = Foreground, style = MaterialTheme.typography.bodyMedium)
                    }
                }
                HorizontalDivider(color = Border)
                SessionDetailRow("Notes", entry.note ?: "No notes on this record.")
            }
        }
        item(key = "foot") {
            Text(
                "Only you and your class admins can see this record. Students cannot change attendance; ask your class admin if something looks wrong.",
                color = MutedForeground,
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
    Row(
        modifier = Modifier.fillMaxWidth().padding(vertical = Spacing.Xl),
        horizontalArrangement = Arrangement.spacedBy(Spacing.Xl),
    ) {
        Text(label, color = MutedForeground, style = MaterialTheme.typography.bodySmall, modifier = Modifier.weight(0.35f))
        Text(value, color = Foreground, style = MaterialTheme.typography.bodyMedium, modifier = Modifier.weight(1f))
    }
}

@Composable
fun NoteCard(text: String, isWarning: Boolean = false, isSuccess: Boolean = false) {
    val bg = when {
        isWarning -> id.starstask.mobile.ui.theme.WarningSoft
        isSuccess -> id.starstask.mobile.ui.theme.SuccessSoft
        else -> id.starstask.mobile.ui.theme.Muted
    }
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(8.dp))
            .background(bg)
            .padding(Spacing.Xl),
    ) {
        Text(text, color = Foreground, style = MaterialTheme.typography.bodySmall)
    }
}

