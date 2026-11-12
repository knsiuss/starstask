package id.starstask.mobile.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
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
import id.starstask.mobile.data.CALENDAR_EVENT_TYPE_LABELS
import id.starstask.mobile.data.CalendarTimelineItem
import id.starstask.mobile.data.formatCalendarTime
import id.starstask.mobile.data.formatGroupLabel
import id.starstask.mobile.data.formatShortDayMonth
import id.starstask.mobile.ui.theme.AssignmentForeground
import id.starstask.mobile.ui.theme.AssignmentSecondary
import id.starstask.mobile.ui.theme.Danger
import id.starstask.mobile.ui.theme.Success
import id.starstask.mobile.ui.theme.Surface
import id.starstask.mobile.ui.theme.AssignmentBorder
import id.starstask.mobile.ui.theme.AssignmentBackground

// Quiet agenda rows — no dividers, no rails. Rows breathe via spacing and
// a small dot for kind; time sits on the right like Apple Calendar.

private val RowAlt = AssignmentBackground

private fun scheduleDot(item: CalendarTimelineItem): Color {
    val completed = item.kind == "assignment" && item.isCompleted
    val overdue = item.kind == "assignment" && item.isOverdue
    return when {
        completed -> Success
        overdue -> Danger
        item.kind == "assignment" -> Color(0xFF5B8DEF)
        item.kind == "personal" || item.kind == "class_schedule" -> Color(0xFFF59E42)
        item.kind == "exam" || item.kind == "academic_event" -> Color(0xFF3E7C8C)
        item.kind == "absence" -> Color(0xFFC98A2E)
        else -> Color(0xFF9AA0AA)
    }
}

private fun scheduleTimeLabel(item: CalendarTimelineItem): String? {
    val start = item.startsAtIso.takeIf { it.isNotEmpty() }?.let { formatCalendarTime(it) }
    val end = item.endsAtIso?.takeIf { it.isNotEmpty() }?.let { formatCalendarTime(it) }
    return when {
        start != null && end != null && start != end -> start
        start != null -> start
        item.kind == "assignment" -> formatShortDayMonth(item.endKey)
        else -> null
    }
}

fun scheduleSubtitle(item: CalendarTimelineItem): String {
    if (item.kind == "assignment") {
        val course = item.courseName ?: item.courseCode ?: item.className
        val span = if (item.startKey != item.endKey) {
            "${formatShortDayMonth(item.startKey)} – ${formatShortDayMonth(item.endKey)}"
        } else {
            formatShortDayMonth(item.endKey)
        }
        return listOfNotNull(course, span).joinToString(" · ")
    }
    val place = item.location ?: item.subjectName ?: item.className
    return place ?: CALENDAR_EVENT_TYPE_LABELS[item.kind] ?: "Calendar"
}

@Composable
fun ScheduleEventItem(
    item: CalendarTimelineItem,
    todayKey: String,
    onOpen: (CalendarTimelineItem) -> Unit,
    completionSlot: (@Composable () -> Unit)? = null,
    alt: Boolean = false,
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(if (alt) RowAlt else Color.Transparent)
            .clickable { onOpen(item) }
            .padding(horizontal = 16.dp, vertical = 14.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(
            modifier = Modifier
                .size(8.dp)
                .clip(RoundedCornerShape(999.dp))
                .background(scheduleDot(item)),
        )
        Box(modifier = Modifier.size(width = 14.dp, height = 0.dp))
        Column(modifier = Modifier.weight(1f)) {
            Text(
                item.title,
                color = AssignmentForeground,
                fontSize = 15.sp,
                fontWeight = FontWeight.SemiBold,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis,
            )
            Text(
                scheduleSubtitle(item),
                color = AssignmentSecondary,
                fontSize = 13.sp,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier.padding(top = 2.dp),
            )
        }
        completionSlot?.invoke()
        scheduleTimeLabel(item)?.let { time ->
            Box(modifier = Modifier.size(width = 8.dp, height = 0.dp))
            Text(
                time,
                color = AssignmentSecondary,
                fontSize = 13.sp,
                fontWeight = FontWeight.Medium,
                maxLines = 1,
            )
        }
    }
}

@Composable
fun ScheduleDayGroup(
    dateKey: String,
    items: List<CalendarTimelineItem>,
    todayKey: String,
    onOpen: (CalendarTimelineItem) -> Unit,
    completionSlot: ((CalendarTimelineItem) -> (@Composable () -> Unit)?)?,
) {
    Column(modifier = Modifier.fillMaxWidth()) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier.padding(bottom = 12.dp),
        ) {
            Text(
                formatGroupLabel(dateKey),
                color = AssignmentForeground,
                fontSize = 20.sp,
                fontWeight = FontWeight.SemiBold,
                modifier = Modifier.weight(1f),
            )
            Text(
                items.size.toString(),
                color = AssignmentSecondary,
                fontSize = 13.sp,
                fontWeight = FontWeight.Medium,
            )
        }
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(12.dp))
                .background(Surface)
                .border(0.5.dp, AssignmentBorder, RoundedCornerShape(12.dp)),
        ) {
            items.forEachIndexed { index, item ->
                ScheduleEventItem(
                    item = item,
                    todayKey = todayKey,
                    onOpen = onOpen,
                    completionSlot = completionSlot?.invoke(item),
                    alt = index % 2 == 1,
                )
            }
        }
    }
}
