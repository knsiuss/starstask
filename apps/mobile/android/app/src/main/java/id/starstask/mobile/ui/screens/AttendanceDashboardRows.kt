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
import id.starstask.mobile.ui.theme.mockColors

// Grouped-list rows: 12sp code chip on palette.chip, 16sp SemiBold ink
// title, 13sp muted meta, 20dp chevron in muted.

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
    val palette = mockColors()
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween,
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(modifier = Modifier.weight(1f, fill = false)) {
            Text(
                title,
                color = palette.ink,
                fontSize = 22.sp,
                fontWeight = FontWeight.SemiBold,
            )
            if (subtitle != null) {
                Text(
                    subtitle,
                    style = MaterialTheme.typography.bodySmall,
                    color = palette.muted,
                    modifier = Modifier.padding(PaddingValues(top = 2.dp)),
                )
            }
        }
        trailing?.invoke()
    }
}

@Composable
internal fun CourseRow(row: CourseAttendanceRow, onClick: (() -> Unit)?) {
    val palette = mockColors()
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
                    .background(palette.chip)
                    .padding(horizontal = 8.dp, vertical = 4.dp),
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    row.code,
                    color = palette.ink,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Medium,
                    maxLines = 1,
                )
            }
        }
        Column(modifier = Modifier.weight(1f)) {
            Text(
                row.name,
                color = palette.ink,
                fontSize = 16.sp,
                fontWeight = FontWeight.SemiBold,
                maxLines = 1,
            )
            Text(
                row.className,
                color = palette.muted,
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
                color = palette.muted,
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
                    color = palette.ink,
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
                color = palette.muted,
                fontSize = 16.sp,
            )
        }
        Icon(
            Lucide.ChevronRight,
            contentDescription = null,
            tint = palette.muted,
            modifier = Modifier.size(20.dp),
        )
    }
}

@Composable
internal fun HistoryRow(entry: AttendanceEntry, onClick: () -> Unit) {
    val palette = mockColors()
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
            when (entry.method) {
                "manual" -> "Manual"
                "offline_sync" -> "Offline sync"
                "geo" -> "In person"
                else -> entry.method.replaceFirstChar { c -> c.uppercase() }
            }
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
                color = palette.ink,
                fontSize = 16.sp,
                fontWeight = FontWeight.SemiBold,
                maxLines = 1,
            )
            Text(
                methodLine,
                color = palette.muted,
                fontSize = 13.sp,
                maxLines = 1,
                modifier = Modifier.padding(top = 2.dp),
            )
            Text(
                formatDateShort(entry.startsAt),
                color = palette.ink,
                fontSize = 12.sp,
                fontWeight = FontWeight.Medium,
                modifier = Modifier.padding(top = 6.dp),
            )
            Text(
                timeLine,
                color = palette.muted,
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
                tint = palette.muted,
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
