package id.starstask.mobile.ui.screens.dashboard

// White grouped card for the next actionable task. It is the slot that used
// to hold the past-deadline warning banner: instead of advertising overdue
// counts, the dashboard always shows what to do next. `nextTask` is already
// resolved by the caller (upcoming first, most recent past task as fallback).

import androidx.compose.foundation.background
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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import id.starstask.mobile.data.DashboardAssignment
import id.starstask.mobile.data.formatDateShort
import id.starstask.mobile.data.formatTime
import id.starstask.mobile.ui.icons.Lucide
import id.starstask.mobile.ui.theme.DashRadiusCard
import id.starstask.mobile.ui.theme.dashColors

@Composable
fun DashNextTaskCard(
    task: DashboardAssignment,
    onOpen: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val palette = dashColors()
    Row(
        modifier = modifier
            .fillMaxWidth()
            .clip(DashRadiusCard)
            .background(palette.card)
            .clickable(onClick = onOpen)
            .padding(16.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Box(
            modifier = Modifier
                .size(40.dp)
                .clip(RoundedCornerShape(12.dp))
                .background(palette.tileBlueBackground),
            contentAlignment = Alignment.Center,
        ) {
            Icon(Lucide.CalendarClock, contentDescription = null, tint = palette.tileBlueForeground, modifier = Modifier.size(20.dp))
        }
        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(
                "NEXT TASK",
                color = palette.muted,
                fontSize = 11.sp,
                fontWeight = FontWeight.SemiBold,
                letterSpacing = 1.sp,
            )
            Text(
                task.title,
                color = palette.text,
                fontSize = 15.sp,
                lineHeight = 20.sp,
                fontWeight = FontWeight.SemiBold,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis,
            )
            val meta = listOfNotNull(
                task.subjectName?.takeIf { it.isNotBlank() },
                task.deadline?.let { "${formatDateShort(it)} at ${formatTime(it)}" },
            ).joinToString(" · ")
            if (meta.isNotBlank()) {
                Text(meta, color = palette.muted, fontSize = 12.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
            }
        }
        Icon(
            Lucide.ChevronRight,
            contentDescription = "Open task",
            tint = palette.muted,
            modifier = Modifier.size(18.dp),
        )
    }
}
