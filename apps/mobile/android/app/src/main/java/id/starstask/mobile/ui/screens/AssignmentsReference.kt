package id.starstask.mobile.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import id.starstask.mobile.data.WorkspaceOverview
import id.starstask.mobile.data.WorkspaceScheduleItem
import id.starstask.mobile.data.formatDeadline
import id.starstask.mobile.data.formatRemainingTime
import id.starstask.mobile.data.getDeadlineState
import id.starstask.mobile.data.DeadlineState
import id.starstask.mobile.ui.icons.Lucide
import id.starstask.mobile.ui.theme.Surface
import id.starstask.mobile.ui.theme.dashColors
import id.starstask.mobile.ui.theme.SoftFill
import id.starstask.mobile.ui.theme.Muted

private val BadgeBlueBg = SoftFill
private val BadgeGrayBg = Muted
private val StatusBlue = Color(0xFF526B9F)
private val StatusRed = Color(0xFFB85454)
private val PinkBg = Color(0xFFFBEEF0)
private val PinkText = Color(0xFFB03A48)

@Composable
fun ReferenceStats(overview: WorkspaceOverview) {
    val palette = dashColors()
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(20.dp))
            .background(Surface)
            .border(0.5.dp, palette.cardBorder, RoundedCornerShape(20.dp))
            .padding(vertical = 20.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        ReferenceStat(value = overview.total.toString(), label = "Total Tasks", color = palette.text, modifier = Modifier.weight(1f))
        Box(Modifier.size(width = 0.5.dp, height = 36.dp).background(palette.cardBorder))
        ReferenceStat(value = overview.upcoming.toString(), label = "Upcoming", color = palette.text, modifier = Modifier.weight(1f))
        Box(Modifier.size(width = 0.5.dp, height = 36.dp).background(palette.cardBorder))
        ReferenceStat(value = overview.expired.toString(), label = "Expired", color = StatusRed, modifier = Modifier.weight(1f))
    }
}

@Composable
private fun ReferenceStat(value: String, label: String, color: Color, modifier: Modifier = Modifier) {
    val palette = dashColors()
    Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = modifier, verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Text(value, color = color, fontSize = 28.sp, fontWeight = FontWeight.SemiBold)
        Text(label, color = palette.muted, fontSize = 12.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
    }
}

@Composable
fun ReferenceDeadlineAlert(overview: WorkspaceOverview, onOpenAssignment: (String) -> Unit) {
    val palette = dashColors()
    val nearest = overview.upcomingDeadlines.firstOrNull() ?: return
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(20.dp))
            .background(PinkBg)
            .border(0.5.dp, Color(0xFFF3D4D9), RoundedCornerShape(20.dp))
            .clickable { onOpenAssignment(nearest.id) }
            .padding(horizontal = 16.dp, vertical = 14.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Box(
            modifier = Modifier
                .size(36.dp)
                .clip(RoundedCornerShape(999.dp))
                .background(Color(0xFFC43B4A).copy(alpha = 0.12f)),
            contentAlignment = Alignment.Center,
        ) {
            Icon(Lucide.AlertCircle, contentDescription = null, tint = Color(0xFFC43B4A), modifier = Modifier.size(20.dp))
        }
        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text("Upcoming Deadline", color = PinkText, fontSize = 13.sp, fontWeight = FontWeight.Medium)
            Text(nearest.title, color = palette.text, fontSize = 15.sp, fontWeight = FontWeight.SemiBold, maxLines = 1, overflow = TextOverflow.Ellipsis)
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                Icon(Lucide.Clock, contentDescription = null, tint = palette.muted, modifier = Modifier.size(14.dp))
                Text(
                    "${formatRemainingTime(nearest.deadline, System.currentTimeMillis()) ?: ""} · ${formatDeadline(nearest.deadline)}",
                    color = palette.muted,
                    fontSize = 12.sp,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
            }
        }
        Icon(Lucide.ChevronRight, contentDescription = "Open assignment", tint = palette.muted, modifier = Modifier.size(20.dp))
    }
}

@Composable
fun ReferenceScheduleHeader(count: Int, onOpenSort: () -> Unit) {
    val palette = dashColors()
    Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.SpaceBetween) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Text("Task Schedule", color = palette.text, fontSize = 22.sp, fontWeight = FontWeight.SemiBold)
            Text(
                count.toString(),
                color = StatusBlue,
                fontSize = 12.sp,
                fontWeight = FontWeight.SemiBold,
                modifier = Modifier.clip(RoundedCornerShape(999.dp)).background(BadgeBlueBg).padding(horizontal = 8.dp, vertical = 2.dp),
            )
        }
        Icon(Lucide.ArrowDownUp, contentDescription = "Sort", tint = palette.text, modifier = Modifier.size(20.dp).clickable(onClick = onOpenSort))
    }
}

@Composable
fun ReferenceAssignmentCard(
    item: WorkspaceScheduleItem,
    onOpen: () -> Unit,
    onDismiss: (() -> Unit)? = null,
    onOpenAttachments: (() -> Unit)? = null,
) {
    val palette = dashColors()
    val state = getDeadlineState(item.deadline)
    val isOverdue = state == DeadlineState.OVERDUE
    val courseLabel = if (!item.courseCode.isNullOrBlank()) "${item.courseCode} · ${item.courseName}" else item.courseName
    val classLabel = item.className ?: courseLabel
    val leftTint = if (isOverdue) PinkBg else BadgeBlueBg

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(20.dp))
            .background(Surface)
            .border(0.5.dp, palette.cardBorder, RoundedCornerShape(20.dp))
            .clickable(onClick = onOpen)
            .padding(16.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(
                item.classCode ?: courseLabel,
                color = palette.text,
                fontSize = 12.sp,
                fontWeight = FontWeight.Medium,
                modifier = Modifier.clip(RoundedCornerShape(999.dp)).background(if (isOverdue) BadgeGrayBg else BadgeBlueBg).padding(horizontal = 8.dp, vertical = 4.dp),
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            Text(
                "Published",
                color = StatusBlue,
                fontSize = 12.sp,
                fontWeight = FontWeight.Medium,
                modifier = Modifier.clip(RoundedCornerShape(999.dp)).background(BadgeBlueBg).padding(horizontal = 8.dp, vertical = 4.dp),
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            if (isOverdue && onDismiss != null) {
                Icon(Lucide.X, contentDescription = "Remove assignment", tint = palette.muted, modifier = Modifier.size(18.dp).clickable(onClick = onDismiss))
            }
            Box(Modifier.weight(1f))
            if (item.attachmentCount > 0) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(4.dp),
                    modifier = Modifier
                        .clip(RoundedCornerShape(999.dp))
                        .clickable { onOpenAttachments?.invoke() ?: onOpen() }
                        .padding(horizontal = 4.dp, vertical = 2.dp),
                ) {
                    Icon(Lucide.Paperclip, contentDescription = "Open attachments", tint = palette.muted, modifier = Modifier.size(16.dp))
                    Text(item.attachmentCount.toString(), color = palette.muted, fontSize = 13.sp)
                }
            }
            Icon(Lucide.ChevronRight, contentDescription = "Open assignment", tint = palette.muted, modifier = Modifier.size(20.dp))
        }
        Text(
            item.title,
            color = palette.text,
            fontSize = 16.sp,
            fontWeight = FontWeight.SemiBold,
            maxLines = 2,
            overflow = TextOverflow.Ellipsis,
            modifier = Modifier.padding(top = 10.dp),
        )
        Text(
            classLabel,
            color = palette.muted,
            fontSize = 13.sp,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            modifier = Modifier.padding(top = 2.dp),
        )
        Row(
            modifier = Modifier.padding(top = 12.dp).fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween,
        ) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                Icon(
                    Lucide.CalendarDays,
                    contentDescription = null,
                    tint = if (isOverdue) StatusRed else StatusBlue,
                    modifier = Modifier.size(16.dp),
                )
                Text(
                    item.deadline?.let { formatDeadline(it) } ?: "No deadline",
                    color = if (isOverdue) StatusRed else palette.text,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.Medium,
                    modifier = Modifier.clip(RoundedCornerShape(999.dp)).background(leftTint).padding(horizontal = 8.dp, vertical = 4.dp),
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
            }
            Text(
                if (isOverdue) "●  Overdue" else "●  Upcoming",
                color = if (isOverdue) StatusRed else StatusBlue,
                fontSize = 12.sp,
                fontWeight = FontWeight.Medium,
                maxLines = 1,
            )
        }
    }
}
