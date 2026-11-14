package id.starstask.mobile.ui.screens.dashboard

// "This Week" strip: 7 day columns for the current Mon–Sun window, today
// highlighted with a solid accent tile, activity dot under busy days.

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
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
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import id.starstask.mobile.data.ScheduleEntry
import id.starstask.mobile.data.deviceDate
import id.starstask.mobile.ui.theme.DashRadiusCard
import id.starstask.mobile.ui.theme.dashColors

private val WeekDayLabels = listOf("MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN")

@Composable
fun DashWeekStrip(
    schedule: List<ScheduleEntry>,
    assignmentDeadlines: List<String>,
    today: java.time.LocalDate = java.time.LocalDate.now(java.time.ZoneId.systemDefault()),
    modifier: Modifier = Modifier,
) {
    val palette = dashColors()
    val monday = today.minusDays((today.dayOfWeek.value - 1).toLong())
    val hasActivity: (java.time.LocalDate) -> Boolean = { day ->
        val key = day.toString()
        schedule.any { runCatching { deviceDate(it.startsAt) }.getOrNull() == key } ||
            assignmentDeadlines.any { it.take(10) == key }
    }

    androidx.compose.foundation.layout.Column(
        modifier = modifier
            .fillMaxWidth()
            .clip(DashRadiusCard)
            .background(palette.card)
            .padding(vertical = 12.dp, horizontal = 8.dp),
        verticalArrangement = Arrangement.spacedBy(6.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Row(horizontalArrangement = Arrangement.spacedBy(0.dp), modifier = Modifier.fillMaxWidth()) {
            (0..6).forEach { offset ->
                val day = monday.plusDays(offset.toLong())
                val selected = day == today
                val dayModifier = Modifier
                    .weight(1f)
                    .clip(RoundedCornerShape(14.dp))
                    .let { if (selected) it.background(palette.accent) else it }
                    .padding(vertical = 10.dp)
                Column(modifier = dayModifier, horizontalAlignment = Alignment.CenterHorizontally) {
                    Text(
                        WeekDayLabels[offset],
                        color = if (selected) androidx.compose.ui.graphics.Color.White else palette.muted,
                        fontSize = 11.sp,
                        fontWeight = androidx.compose.ui.text.font.FontWeight.Medium,
                    )
                    Text(
                        day.dayOfMonth.toString(),
                        color = if (selected) androidx.compose.ui.graphics.Color.White else palette.text,
                        fontSize = 20.sp,
                        fontWeight = androidx.compose.ui.text.font.FontWeight.SemiBold,
                    )
                    if (hasActivity(day)) {
                        androidx.compose.foundation.layout.Spacer(Modifier.size(3.dp))
                        androidx.compose.foundation.layout.Box(
                            modifier = Modifier
                                .size(6.dp)
                                .clip(RoundedCornerShape(999.dp))
                                .background(if (selected) androidx.compose.ui.graphics.Color.White else palette.accent),
                        )
                    } else {
                        androidx.compose.foundation.layout.Spacer(Modifier.size(9.dp))
                    }
                }
            }
        }
    }
}
