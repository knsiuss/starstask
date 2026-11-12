package id.starstask.mobile.ui.screens.classdir

// Glossy Overview tab: stats row (real ClassOverviewStats), quick actions
// (Create Assignment / Set Schedule / Export Report / Manage Members /
// Manage Class), Recent Assignments with Overdue/Upcoming status pills.

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import id.starstask.mobile.data.ClassOverviewData
import id.starstask.mobile.data.ClassOverviewStats
import id.starstask.mobile.data.OverviewAssignmentItem
import id.starstask.mobile.data.DeadlineState
import id.starstask.mobile.data.getDeadlineState
import id.starstask.mobile.ui.icons.Lucide
import id.starstask.mobile.ui.theme.mockColors

@Composable
fun ClassOverviewGlossy(
    overview: ClassOverviewData?,
    loading: Boolean,
    isAdmin: Boolean,
    onCreateAssignment: () -> Unit,
    onSetSchedule: () -> Unit,
    onExportReport: () -> Unit,
    onManageMembers: () -> Unit,
    onManageClass: () -> Unit,
    onOpenAssignments: () -> Unit,
) {
    val palette = mockColors()
    val stats = overview?.stats ?: ClassOverviewStats(0, 0, 0, 0)

    Column(verticalArrangement = Arrangement.spacedBy(20.dp)) {
        GlossySectionTitle("Overview", palette)
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(12.dp))
                .background(palette.card)
                .border(1.dp, palette.cardBorder, RoundedCornerShape(12.dp))
                .padding(vertical = 16.dp),
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
            ) {
                GlossyStatTile(icon = Lucide.ClipboardList, value = stats.total.toString(), label = "Total", palette = palette)
                GlossyStatTile(icon = Lucide.CalendarDays, value = stats.upcoming.toString(), label = "Upcoming", palette = palette)
                GlossyStatTile(icon = Lucide.Clock, value = stats.dueToday.toString(), label = "Due today", palette = palette, accent = true)
                GlossyStatTile(icon = Lucide.CircleCheck, value = stats.completed.toString(), label = "Done", palette = palette)
            }
        }

        GlossySectionTitle("Quick Actions", palette)
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(12.dp))
                .background(palette.card)
                .border(1.dp, palette.cardBorder, RoundedCornerShape(12.dp)),
        ) {
            Column {
                GlossyActionRow(
                    icon = Lucide.PenLine,
                    label = "Create Assignment",
                    onClick = onCreateAssignment,
                    palette = palette,
                )
                GlossyDivider(palette)
                GlossyActionRow(
                    icon = Lucide.CalendarDays,
                    label = "Set Schedule",
                    onClick = onSetSchedule,
                    palette = palette,
                )
                GlossyDivider(palette)
                GlossyActionRow(
                    icon = Lucide.Download,
                    label = "Export Report",
                    onClick = onExportReport,
                    palette = palette,
                )
                GlossyDivider(palette)
                GlossyActionRow(
                    icon = Lucide.Users,
                    label = "Manage Members",
                    onClick = onManageMembers,
                    palette = palette,
                )
                if (isAdmin) {
                    GlossyDivider(palette)
                    GlossyActionRow(
                        icon = Lucide.Settings,
                        label = "Manage Class",
                        onClick = onManageClass,
                        palette = palette,
                    )
                }
            }
        }

        GlossySectionTitle("Assignments", palette)
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(12.dp))
                .background(palette.card)
                .border(1.dp, palette.cardBorder, RoundedCornerShape(12.dp)),
        ) {
            Column {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp, vertical = 14.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text("Recent", color = palette.ink, fontSize = 15.sp, fontWeight = FontWeight.SemiBold, modifier = Modifier.weight(1f))
                    Row(
                        modifier = Modifier.clickable(onClick = onOpenAssignments),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(2.dp),
                    ) {
                        Text("View all", color = palette.accent, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
                        Icon(Lucide.ArrowRight, contentDescription = null, tint = palette.accent, modifier = Modifier.size(14.dp))
                    }
                }
                GlossyDivider(palette)
                val recent = overview?.recent.orEmpty()
                if (recent.isEmpty()) {
                    Text(
                        "No assignments yet.",
                        color = palette.muted,
                        fontSize = 13.sp,
                        modifier = Modifier.padding(16.dp),
                    )
                } else {
                    recent.take(5).forEachIndexed { index, item ->
                        if (index > 0) GlossyDivider(palette)
                        RecentAssignmentRow(item = item, onClick = onOpenAssignments, palette = palette)
                    }
                }
            }
        }
    }
}

@Composable
private fun GlossyStatTile(
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    value: String,
    label: String,
    palette: id.starstask.mobile.ui.theme.MockPalette,
    accent: Boolean = false,
) {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(4.dp),
        modifier = Modifier.padding(horizontal = 6.dp),
    ) {
        Box(
            modifier = Modifier
                .size(34.dp)
                .clip(RoundedCornerShape(12.dp))
                .background(if (accent) palette.accentSoft else palette.chip),
            contentAlignment = Alignment.Center,
        ) {
            Icon(icon, contentDescription = null, tint = if (accent) palette.accent else palette.accent, modifier = Modifier.size(17.dp))
        }
        Text(value, color = palette.ink, fontSize = 20.sp, fontWeight = FontWeight.Bold, lineHeight = 22.sp)
        Text(label, color = palette.muted, fontSize = 11.sp, maxLines = 1)
    }
}

@Composable
private fun GlossyActionRow(
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    label: String,
    onClick: () -> Unit,
    palette: id.starstask.mobile.ui.theme.MockPalette,
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .heightIn(min = 52.dp)
            .padding(horizontal = 16.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Icon(icon, contentDescription = null, tint = palette.accent, modifier = Modifier.size(19.dp))
        Text(label, color = palette.ink, fontSize = 15.sp, fontWeight = FontWeight.Medium, modifier = Modifier.weight(1f))
        Icon(Lucide.ChevronRight, contentDescription = null, tint = palette.muted, modifier = Modifier.size(18.dp))
    }
}

@Composable
private fun RecentAssignmentRow(
    item: OverviewAssignmentItem,
    onClick: () -> Unit,
    palette: id.starstask.mobile.ui.theme.MockPalette,
) {
    val deadlineState = getDeadlineState(item.deadline)
    val (pillLabel, pillBg, pillFg) = when (deadlineState) {
        DeadlineState.OVERDUE -> Triple("Overdue", palette.riskBg, palette.riskFg)
        DeadlineState.DUE_TODAY -> Triple("Due today", palette.fairBg, palette.fairFg)
        DeadlineState.UPCOMING -> Triple("Upcoming", palette.accentSoft, palette.accent)
        DeadlineState.NONE -> Triple("No deadline", palette.chip, palette.muted)
    }
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .padding(horizontal = 16.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Icon(Lucide.FileText, contentDescription = null, tint = palette.accent, modifier = Modifier.size(19.dp))
        Column(modifier = Modifier.weight(1f)) {
            Text(item.title, color = palette.ink, fontSize = 14.sp, fontWeight = FontWeight.SemiBold, maxLines = 2, overflow = TextOverflow.Ellipsis)
            val meta = buildList {
                item.courseCode?.takeIf { it.isNotBlank() }?.let { add(it) }
                item.courseName.takeIf { it.isNotBlank() }?.let { add(it) }
            }.joinToString(" · ")
            if (meta.isNotBlank()) {
                Text(meta, color = palette.muted, fontSize = 12.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
            }
        }
        Column(
            horizontalAlignment = Alignment.End,
            verticalArrangement = Arrangement.spacedBy(4.dp),
        ) {
            Box(
                modifier = Modifier
                    .clip(RoundedCornerShape(999.dp))
                    .background(pillBg)
                    .padding(horizontal = 8.dp, vertical = 3.dp),
            ) {
                Text(pillLabel, color = pillFg, fontSize = 11.sp, fontWeight = FontWeight.SemiBold)
            }
            if (item.deadline != null) {
                Text(
                    item.deadline.take(10),
                    color = palette.muted,
                    fontSize = 11.sp,
                )
            }
        }
    }
}

@Composable
private fun GlossyDivider(palette: id.starstask.mobile.ui.theme.MockPalette) {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .height(1.dp)
            .background(palette.hairline),
    )
}

@Composable
private fun GlossySectionTitle(text: String, palette: id.starstask.mobile.ui.theme.MockPalette) {
    Text(
        text,
        color = palette.ink,
        fontSize = 18.sp,
        fontWeight = FontWeight.SemiBold,
        modifier = Modifier.padding(start = 4.dp),
    )
}
