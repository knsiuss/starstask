package id.starstask.mobile.ui.screens

import id.starstask.mobile.ui.theme.Spacing

import id.starstask.mobile.ui.icons.Lucide

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import id.starstask.mobile.data.ActiveMeeting
import id.starstask.mobile.data.AttendanceEntry
import id.starstask.mobile.data.AttendanceIdentity
import id.starstask.mobile.data.CourseAttendanceRow
import id.starstask.mobile.data.formatDateShort
import id.starstask.mobile.data.jakartaDate
import id.starstask.mobile.ui.components.BadgeVariant
import id.starstask.mobile.ui.components.StarsTaskBadge
import id.starstask.mobile.ui.components.WebEmptyState
import id.starstask.mobile.ui.theme.AssignmentAccent
import id.starstask.mobile.ui.theme.AssignmentForeground
import id.starstask.mobile.ui.theme.MutedForeground
import id.starstask.mobile.ui.theme.Surface
import id.starstask.mobile.ui.theme.AssignmentBorder

// Check-in / History list sections. Background is the assignment off-white;
// lists are white grouped surfaces with 0.5.dp #E9EBF0 borders and 20.dp corners.

@Composable
fun CourseAttendanceSection(
    rows: List<CourseAttendanceRow>,
    onOpenCourse: (Triple<String, String, String?>) -> Unit,
    onViewAll: () -> Unit = {},
) {
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.Lg)) {
        SectionHeader(
            title = "Course Attendance",
            trailing = {
                TextButton(onClick = onViewAll) {
                    Text(
                        "View all",
                        color = AssignmentAccent,
                        style = MaterialTheme.typography.bodySmall,
                    )
                }
            },
        )
        if (rows.isEmpty()) {
            WebEmptyState(
                title = "No courses yet",
                description =
                    "Courses appear here once you join a class that has subjects.",
            )
        } else {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(20.dp))
                    .background(Surface)
                    .border(0.5.dp, AssignmentBorder, RoundedCornerShape(20.dp)),
            ) {
                rows.forEachIndexed { index, row ->
                    CourseRow(
                        row = row,
                        onClick =
                            row.subjectId?.let { id ->
                                { onOpenCourse(Triple(id, row.name, row.code)) }
                            },
                    )
                    if (index < rows.lastIndex) {
                        HorizontalDivider(color = AssignmentBorder)
                    }
                }
            }
        }
    }
}

@Composable
fun ActiveSection(
    heading: String,
    active: List<ActiveMeeting>,
    identity: AttendanceIdentity?,
    userId: String,
    onChanged: () -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.Lg)) {
        SectionHeader(title = heading)
        if (active.isEmpty()) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(20.dp))
                    .background(Surface)
                    .border(0.5.dp, AssignmentBorder, RoundedCornerShape(20.dp))
                    .padding(16.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                Box(
                    modifier = Modifier
                        .size(36.dp)
                        .clip(RoundedCornerShape(12.dp))
                        .background(AssignmentAccent.copy(alpha = 0.1f)),
                    contentAlignment = Alignment.Center,
                ) {
                    Icon(
                        Lucide.CalendarDays,
                        contentDescription = null,
                        tint = AssignmentAccent,
                        modifier = Modifier.size(18.dp),
                    )
                }
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        "No active attendance sessions.",
                        style = MaterialTheme.typography.titleSmall,
                        color = AssignmentForeground,
                    )
                    Text(
                        "Your instructors have not opened an attendance session yet.",
                        style = MaterialTheme.typography.bodySmall,
                        color = MutedForeground,
                    )
                }
            }
        } else {
            active.forEach { meeting ->
                ActiveMeetingCard(
                    meeting = meeting,
                    identity = identity,
                    userId = userId,
                    onChanged = onChanged,
                )
            }
        }
    }
}

@Composable
fun HistorySection(
    totalCount: Int,
    entries: List<AttendanceEntry>,
    onOpenSession: (AttendanceEntry) -> Unit,
) {
    // Cheap date grouping using the same Jakarta day key as the date filters.
    val grouped = entries.groupBy { jakartaDate(it.startsAt) }
        .entries.sortedByDescending { it.key }
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.Lg)) {
        SectionHeader(
            title = "Attendance History",
            trailing = {
                StarsTaskBadge(
                    label = "$totalCount " + (if (totalCount == 1) "session" else "sessions"),
                    variant = BadgeVariant.NEUTRAL,
                )
            },
        )
        if (entries.isEmpty()) {
            WebEmptyState(
                title = "No attendance records yet.",
                description =
                    "Finished sessions appear here once they happen. " +
                        "Try widening the filters if you expected older records.",
            )
        } else {
            grouped.forEach { (dateKey, group) ->
                Column(verticalArrangement = Arrangement.spacedBy(Spacing.Sm)) {
                    Text(
                        formatDateShort(group.first().startsAt),
                        style = MaterialTheme.typography.labelSmall,
                        color = MutedForeground,
                        modifier = Modifier.padding(start = 2.dp),
                    )
                    Column(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(20.dp))
                            .background(Surface)
                            .border(0.5.dp, AssignmentBorder, RoundedCornerShape(20.dp)),
                    ) {
                        group.forEachIndexed { index, entry ->
                            HistoryRow(entry = entry) {
                                onOpenSession(entry)
                            }
                            if (index < group.lastIndex) {
                                HorizontalDivider(color = AssignmentBorder)
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun HistoryToolbar(
    selectedCount: Int,
    onOpenFilters: () -> Unit,
    onExportCsv: () -> Unit,
    onExportPdf: () -> Unit,
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        TextButton(onClick = onOpenFilters) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(Spacing.Xs),
            ) {
                Icon(
                    Lucide.SlidersHorizontal,
                    contentDescription = null,
                    tint = AssignmentAccent,
                    modifier = Modifier.size(18.dp),
                )
                Text(
                    "Filter" + if (selectedCount > 0) " ($selectedCount)" else "",
                    color = AssignmentAccent,
                    style = MaterialTheme.typography.bodyMedium,
                )
            }
        }
        Row(horizontalArrangement = Arrangement.spacedBy(Spacing.Md)) {
            TextButton(onClick = onExportCsv) {
                Text("CSV", color = AssignmentAccent, style = MaterialTheme.typography.bodyMedium)
            }
            TextButton(onClick = onExportPdf) {
                Text("PDF", color = AssignmentAccent, style = MaterialTheme.typography.bodyMedium)
            }
        }
    }
}

@Composable
fun PagerRow(
    currentPage: Int,
    totalPages: Int,
    onPrevious: () -> Unit,
    onNext: () -> Unit,
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        TextButton(onClick = onPrevious, enabled = currentPage > 1) {
            Text("Previous")
        }
        Text(
            "Page $currentPage of $totalPages",
            style = MaterialTheme.typography.bodySmall,
            color = MutedForeground,
        )
        TextButton(onClick = onNext, enabled = currentPage < totalPages) {
            Text("Next")
        }
    }
}
