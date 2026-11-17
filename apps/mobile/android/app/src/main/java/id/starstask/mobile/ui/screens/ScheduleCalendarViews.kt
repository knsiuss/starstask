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
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import id.starstask.mobile.data.CalendarRange
import id.starstask.mobile.data.CalendarTimelineItem
import id.starstask.mobile.data.formatShortDay
import id.starstask.mobile.data.splitIntoWeeks
import id.starstask.mobile.ui.theme.mockColors
import androidx.compose.runtime.getValue

// Calendar strip/grid sit directly on #F7F8FA. No card chrome — mobile
// is a distinct state, not a desktop board squeezed into a phone.

private val WEEKDAY_LABELS = listOf("Mo", "Tu", "We", "Th", "Fr", "Sa", "Su")

// Week strip: seven day cells. Each cell is a 48dp touch target (antislop
// R-03: ≥44px). Selected day is a filled circle, today is a soft tint,
// marked days carry a dot. No horizontal scroll: 7 × weight(1f) always fits.
@Composable
fun WeekCalendarView(
    range: CalendarRange,
    anchorKey: String,
    todayKey: String,
    markedKeys: Set<String>,
    onSelectDay: (String) -> Unit,
    modifier: Modifier = Modifier,
) {
    val palette = mockColors()
    Column(modifier = modifier.fillMaxWidth()) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
        ) {
            range.days.forEachIndexed { index, day ->
                val selected = day.dateKey == anchorKey
                val isToday = day.dateKey == todayKey
                val marked = day.dateKey in markedKeys
                Column(
                    modifier = Modifier
                        .weight(1f)
                        .clickable { onSelectDay(day.dateKey) }
                        .padding(horizontal = 4.dp, vertical = 8.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                ) {
                    Text(
                        WEEKDAY_LABELS.getOrElse(index) { formatShortDay(day.dateKey).take(2) },
                        color = if (selected || isToday) palette.accent else palette.muted,
                        style = MaterialTheme.typography.labelSmall,
                        fontWeight = if (selected || isToday) FontWeight.SemiBold else FontWeight.Normal,
                    )
                    Box(modifier = Modifier.size(height = 8.dp, width = 0.dp))
                    Box(
                        modifier = Modifier
                            .size(48.dp)
                            .clip(RoundedCornerShape(999.dp))
                            .background(
                                when {
                                    selected -> palette.accent
                                    isToday -> palette.accentSofter
                                    else -> Color.Transparent
                                },
                            )
                            .border(
                                1.dp,
                                when {
                                    isToday && !selected -> palette.accent
                                    else -> Color.Transparent
                                },
                                RoundedCornerShape(999.dp),
                            ),
                        contentAlignment = Alignment.Center,
                    ) {
                        Text(
                            day.dayOfMonth.toString(),
                            color = when {
                                selected -> Color.White
                                isToday -> palette.accent
                                else -> palette.ink
                            },
                            style = MaterialTheme.typography.titleMedium,
                            fontWeight = if (selected || isToday) FontWeight.SemiBold else FontWeight.Normal,
                        )
                    }
                    Box(modifier = Modifier.size(height = 4.dp, width = 0.dp))
                    Box(
                        modifier = Modifier
                            .size(4.dp)
                            .clip(RoundedCornerShape(999.dp))
                            .background(
                                when {
                                    selected -> palette.accent
                                    marked -> palette.accent
                                    else -> Color.Transparent
                                },
                            ),
                    )
                }
            }
        }
    }
}

// Month grid: 42 cells (six weeks), Monday-first. Each cell is a 48dp
// touch target with no card chrome. No fixed-width children: every cell
// is weight(1f) so the grid reflows to any phone width.
@Composable
fun MonthCalendarView(
    range: CalendarRange,
    anchorKey: String,
    todayKey: String,
    markedKeys: Set<String>,
    onSelectDay: (String) -> Unit,
    modifier: Modifier = Modifier,
) {
    val palette = mockColors()
    Column(
        modifier = modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
        ) {
            WEEKDAY_LABELS.forEach { label ->
                Text(
                    label,
                    color = palette.muted,
                    style = MaterialTheme.typography.labelSmall,
                    fontWeight = FontWeight.Medium,
                    modifier = Modifier.weight(1f),
                )
            }
        }
        splitIntoWeeks(range.days).forEach { week ->
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
            ) {
                week.forEach { day ->
                    val selected = day.dateKey == anchorKey
                    val isToday = day.dateKey == todayKey
                    val marked = day.dateKey in markedKeys
                    Column(
                        modifier = Modifier
                            .weight(1f)
                            .clickable { onSelectDay(day.dateKey) }
                            .padding(horizontal = 4.dp, vertical = 8.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                    ) {
                        Box(
                            modifier = Modifier
                                .size(48.dp)
                                .clip(RoundedCornerShape(999.dp))
                                .background(
                                    when {
                                        selected -> palette.accent
                                        isToday -> palette.accentSofter
                                        else -> Color.Transparent
                                    },
                                )
                                .border(
                                    1.dp,
                                    when {
                                        isToday && !selected -> palette.accent
                                        else -> Color.Transparent
                                    },
                                    RoundedCornerShape(999.dp),
                                ),
                            contentAlignment = Alignment.Center,
                        ) {
                            Text(
                                day.dayOfMonth.toString(),
                                color = when {
                                    selected -> Color.White
                                    isToday -> palette.accent
                                    !day.inMonth -> palette.muted.copy(alpha = 0.45f)
                                    else -> palette.ink
                                },
                                style = MaterialTheme.typography.bodyMedium,
                                fontWeight = if (selected || isToday) FontWeight.SemiBold else FontWeight.Normal,
                            )
                        }
                        Box(modifier = Modifier.size(height = 4.dp, width = 0.dp))
                        Box(
                            modifier = Modifier
                                .size(4.dp)
                                .clip(RoundedCornerShape(999.dp))
                                .background(
                                    when {
                                        selected -> palette.accent
                                        marked -> palette.accent
                                        else -> Color.Transparent
                                    },
                                ),
                        )
                    }
                }
            }
        }
    }
}

// Agenda for one view window. Items already carry the web lifecycle filter
// (listCalendar). Week/Month show the selected day's agenda first plus the
// remaining days of the window; List shows every day in the window.
@Composable
fun ScheduleAgendaList(
    range: CalendarRange,
    items: List<CalendarTimelineItem>,
    anchorKey: String,
    todayKey: String,
    view: id.starstask.mobile.data.CalendarView,
    onOpen: (CalendarTimelineItem) -> Unit,
    completionSlot: ((CalendarTimelineItem) -> (@Composable () -> Unit)?)?,
    modifier: Modifier = Modifier,
) {
    val fromKey = range.startKey
    val toKey = range.endKey
    val groups = groupTimelineItems(items, fromKey, toKey)
    Column(
        modifier = modifier.fillMaxWidth(),
        verticalArrangement = Arrangement.spacedBy(24.dp),
    ) {
        if (groups.isEmpty()) {
            ScheduleEmptyBox(
                title = "Nothing here yet.",
                description = "Events and assignments for this period will appear here.",
            )
        } else {
            val ordered = when (view) {
                id.starstask.mobile.data.CalendarView.WEEK,
                id.starstask.mobile.data.CalendarView.MONTH,
                id.starstask.mobile.data.CalendarView.DAY,
                -> {
                    val selectedFirst = groups.filter { it.first == anchorKey }
                    val rest = groups.filter { it.first != anchorKey }
                    selectedFirst + rest
                }
                id.starstask.mobile.data.CalendarView.LIST -> groups
            }
            ordered.forEach { (dateKey, dayItems) ->
                ScheduleDayGroup(
                    dateKey = dateKey,
                    items = dayItems,
                    todayKey = todayKey,
                    onOpen = onOpen,
                    completionSlot = completionSlot,
                )
            }
        }
    }
}

@Composable
fun ScheduleEmptyBox(title: String, description: String, modifier: Modifier = Modifier) {
    val palette = mockColors()
    Column(
        modifier = modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .background(palette.card)
            .border(0.5.dp, palette.cardBorder, RoundedCornerShape(12.dp))
            .padding(horizontal = 24.dp, vertical = 32.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        Text(
            title,
            color = palette.ink,
            style = MaterialTheme.typography.titleSmall,
            fontWeight = FontWeight.SemiBold,
        )
        Text(
            description,
            color = palette.muted,
            style = MaterialTheme.typography.bodySmall,
        )
    }
}
