package id.starstask.mobile.ui.screens

import id.starstask.mobile.ui.components.WebSectionTitle
import id.starstask.mobile.ui.icons.Lucide

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyListScope
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.unit.dp
import id.starstask.mobile.data.NextScheduleItem
import id.starstask.mobile.data.formatDateShort
import id.starstask.mobile.data.formatTime
import id.starstask.mobile.ui.components.BadgeVariant
import id.starstask.mobile.ui.components.StarsTaskBadge
import id.starstask.mobile.ui.components.WebCompactCard
import id.starstask.mobile.ui.theme.Spacing
import id.starstask.mobile.ui.theme.Accent
import id.starstask.mobile.ui.theme.Band
import id.starstask.mobile.ui.theme.Foreground
import id.starstask.mobile.ui.theme.MutedForeground
import id.starstask.mobile.ui.theme.Surface

/** Web NextSchedule parity: nearest deadlines/sessions, always shown. */
fun LazyListScope.nextScheduleSection(
    next: NextScheduleItem?,
    onOpenTasks: () -> Unit,
    onOpenSchedule: () -> Unit,
) {
    nextScheduleListSection(scheduleItems = listOfNotNull(next), onOpenTasks = onOpenTasks, onOpenSchedule = onOpenSchedule)
}

fun LazyListScope.nextScheduleListSection(
    scheduleItems: List<NextScheduleItem>,
    onOpenTasks: () -> Unit,
    onOpenSchedule: () -> Unit,
) {
    item {
        WebSectionTitle(
            text = "Next Schedule",
            actionLabel = "View all tasks",
            onAction = onOpenSchedule,
        )
    }
    item {
        if (scheduleItems.isEmpty()) {
            WebCompactCard(modifier = Modifier.fillMaxWidth()) {
                Text(
                    "No upcoming deadlines or sessions. Enjoy the free time.",
                    color = MutedForeground,
                    style = MaterialTheme.typography.bodySmall,
                )
            }
        }
    }
    if (scheduleItems.isNotEmpty()) {
        items(scheduleItems, key = { it.title + it.at }) { item ->
            val whenLabel = if (item.kind == "session" && item.endsAt != null) {
                "${formatDateShort(item.at)}, ${formatTime(item.at)} – ${formatTime(item.endsAt!!)}"
            } else {
                "${formatDateShort(item.at)} at ${formatTime(item.at)}"
            }
            WebCompactCard(
                modifier = Modifier.fillMaxWidth(),
                onClick = onOpenTasks,
                containerColor = Band,
                padding = Spacing.Xxl,
            ) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Spacing.Xl)) {
                    Box(
                        modifier = Modifier
                            .size(Spacing.Section + Spacing.Page)
                            .clip(RoundedCornerShape(Spacing.Md))
                            .background(Surface),
                        contentAlignment = Alignment.Center,
                    ) {
                        Icon(
                            imageVector = if (item.kind == "assignment") {
                                Lucide.FileText
                            } else {
                                Lucide.CalendarDays
                            },
                            contentDescription = null,
                            tint = Accent,
                            modifier = Modifier.size(Spacing.Block),
                        )
                    }
                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            item.title,
                            color = Foreground,
                            style = MaterialTheme.typography.bodyMedium.copy(
                                fontSize = androidx.compose.ui.unit.TextUnit(16f, androidx.compose.ui.unit.TextUnitType.Sp),
                                fontWeight = androidx.compose.ui.text.font.FontWeight.SemiBold,
                            ),
                            maxLines = 1,
                            overflow = androidx.compose.ui.text.style.TextOverflow.Ellipsis,
                        )
                        Text(
                            "${item.className} · ${item.detail}",
                            color = MutedForeground,
                            style = MaterialTheme.typography.bodySmall,
                        )
                        Text(
                            "Scheduled for · $whenLabel",
                            color = MutedForeground,
                            style = MaterialTheme.typography.bodySmall,
                        )
                    }
                    StarsTaskBadge(label = "Planned", variant = BadgeVariant.ACCENT)
                }
            }
        }
    }
}
