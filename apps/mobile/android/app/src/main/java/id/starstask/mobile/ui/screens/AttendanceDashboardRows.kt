package id.starstask.mobile.ui.screens

import id.starstask.mobile.ui.theme.Spacing

import id.starstask.mobile.ui.icons.Lucide

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import id.starstask.mobile.data.AttendanceCounts
import id.starstask.mobile.data.AttendanceEntry
import id.starstask.mobile.data.CourseAttendanceRow
import id.starstask.mobile.data.CourseAttendanceStatus
import id.starstask.mobile.data.courseAttendanceStatusLabel
import id.starstask.mobile.data.formatAttendancePercentage
import id.starstask.mobile.data.formatDateShort
import id.starstask.mobile.data.formatTime
import id.starstask.mobile.data.summarizeAttendance
import id.starstask.mobile.ui.components.BadgeVariant
import id.starstask.mobile.ui.components.StarsTaskBadge
import id.starstask.mobile.ui.theme.AssignmentForeground
import id.starstask.mobile.ui.theme.AssignmentSecondary
import id.starstask.mobile.ui.theme.MutedForeground

// Grouped-list rows, mirroring AssignmentsReference: 12sp code pill on
// #EEF1F7, 16sp title, 13sp meta, 20dp chevron in AssignmentSecondary.

internal val STATUS_OPTIONS =
    listOf(
        "all" to "All",
        "present" to "Present",
        "late" to "Late",
        "excused" to "Excused",
        "sick" to "Sick",
        "absent" to "Absent",
        "pending" to "Pending",
        "unrecorded" to "Not recorded",
    )

internal fun groupCounts(
    entries: List<AttendanceEntry>,
    keyOf: (AttendanceEntry) -> String,
): Map<String, AttendanceCounts> =
    entries.groupBy(keyOf).mapValues { (_, group) ->
        summarizeAttendance(group.map { it.status })
    }

@Composable
internal fun SectionHeader(
    title: String,
    subtitle: String? = null,
    trailing: @Composable (() -> Unit)? = null,
) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween,
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(modifier = Modifier.weight(1f, fill = false)) {
            Text(
                title,
                color = AssignmentForeground,
                fontSize = 22.sp,
                fontWeight = FontWeight.SemiBold,
            )
            if (subtitle != null) {
                Text(
                    subtitle,
                    style = MaterialTheme.typography.bodySmall,
                    color = AssignmentSecondary,
                    modifier = Modifier.padding(PaddingValues(top = 2.dp)),
                )
            }
        }
        trailing?.invoke()
    }
}

@Composable
internal fun CourseRow(row: CourseAttendanceRow, onClick: (() -> Unit)?) {
    val hasSessions = row.status != CourseAttendanceStatus.NoSessions
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .then(if (onClick != null) Modifier.clickable { onClick() } else Modifier)
            .padding(horizontal = 16.dp, vertical = 14.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        if (row.code != null) {
            Box(
                modifier = Modifier
                    .clip(RoundedCornerShape(999.dp))
                    .background(Color(0xFFEEF1F7))
                    .padding(horizontal = 8.dp, vertical = 4.dp),
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    row.code,
                    color = AssignmentForeground,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Medium,
                    maxLines = 1,
                )
            }
        }
        Column(modifier = Modifier.weight(1f)) {
            Text(
                row.name,
                color = AssignmentForeground,
                fontSize = 16.sp,
                fontWeight = FontWeight.SemiBold,
                maxLines = 1,
            )
            Text(
                row.className,
                color = AssignmentSecondary,
                fontSize = 13.sp,
                maxLines = 1,
                modifier = Modifier.padding(top = 2.dp),
            )
            Text(
                if (hasSessions) {
                    "${row.counts.eligible} sessions · " +
                        "${row.counts.present + row.counts.late} attended"
                } else {
                    "No sessions yet"
                },
                color = AssignmentSecondary,
                fontSize = 12.sp,
                fontWeight = FontWeight.Medium,
                maxLines = 1,
                modifier = Modifier.padding(top = 2.dp),
            )
        }
        if (hasSessions) {
            Column(horizontalAlignment = Alignment.End) {
                Text(
                    formatAttendancePercentage(row.counts.percentage),
                    color = AssignmentForeground,
                    fontSize = 16.sp,
                    fontWeight = FontWeight.SemiBold,
                )
                StarsTaskBadge(
                    label = courseAttendanceStatusLabel(row.status),
                    variant = courseBadgeVariant(row.status),
                    modifier = Modifier.padding(PaddingValues(top = 4.dp)),
                )
            }
        } else {
            Text(
                "-",
                color = AssignmentSecondary,
                fontSize = 16.sp,
            )
        }
        Icon(
            Lucide.ChevronRight,
            contentDescription = null,
            tint = AssignmentSecondary,
            modifier = Modifier.size(20.dp),
        )
    }
}

@Composable
internal fun HistoryRow(entry: AttendanceEntry, onClick: () -> Unit) {
    val timeLine =
        buildString {
            append(formatTime(entry.startsAt))
            if (entry.checkedInAt != null) {
                append(" · checked in ${formatTime(entry.checkedInAt)}")
            }
        }
    val methodLine = listOfNotNull(
        "${entry.className} · ${entry.subjectName ?: "No linked subject"}",
        if (entry.method != null) {
            if (entry.method == "manual") "Manual" else "In person"
        } else if (entry.sessionType == "online") {
            "Online"
        } else {
            "In person"
        },
    ).joinToString(" · ")
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable { onClick() }
            .padding(horizontal = 16.dp, vertical = 14.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Text(
                entry.title,
                color = AssignmentForeground,
                fontSize = 16.sp,
                fontWeight = FontWeight.SemiBold,
                maxLines = 1,
            )
            Text(
                methodLine,
                color = AssignmentSecondary,
                fontSize = 13.sp,
                maxLines = 1,
                modifier = Modifier.padding(top = 2.dp),
            )
            Text(
                formatDateShort(entry.startsAt),
                color = AssignmentForeground,
                fontSize = 12.sp,
                fontWeight = FontWeight.Medium,
                modifier = Modifier.padding(top = 6.dp),
            )
            Text(
                timeLine,
                color = AssignmentSecondary,
                fontSize = 12.sp,
            )
        }
        Column(
            horizontalAlignment = Alignment.End,
            verticalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            StarsTaskBadge(
                label = attendanceStatusLabel(entry.status),
                variant = attendanceStatusVariant(entry.status),
            )
            Icon(
                Lucide.ChevronRight,
                contentDescription = null,
                tint = AssignmentSecondary,
                modifier = Modifier.size(20.dp),
            )
        }
    }
}

private fun courseBadgeVariant(status: CourseAttendanceStatus): BadgeVariant = when (status) {
    CourseAttendanceStatus.Excellent -> BadgeVariant.SUCCESS
    CourseAttendanceStatus.Good -> BadgeVariant.ACCENT
    CourseAttendanceStatus.Fair -> BadgeVariant.WARNING
    CourseAttendanceStatus.AtRisk -> BadgeVariant.DANGER
    CourseAttendanceStatus.NoSessions -> BadgeVariant.NEUTRAL
}

private fun attendanceStatusLabel(status: String): String = when (status) {
    "present" -> "Present"
    "late" -> "Late"
    "excused" -> "Excused"
    "sick" -> "Sick"
    "absent" -> "Absent"
    "pending" -> "Pending"
    "unrecorded" -> "Not recorded"
    else -> status
}

private fun attendanceStatusVariant(status: String): BadgeVariant = when (status) {
    "present" -> BadgeVariant.SUCCESS
    "late" -> BadgeVariant.WARNING
    "excused", "sick" -> BadgeVariant.ACCENT
    "absent" -> BadgeVariant.DANGER
    else -> BadgeVariant.NEUTRAL
}
