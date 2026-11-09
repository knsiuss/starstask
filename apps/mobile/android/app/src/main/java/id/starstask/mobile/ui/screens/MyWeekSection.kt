package id.starstask.mobile.ui.screens

import id.starstask.mobile.ui.theme.Spacing

import androidx.compose.foundation.background
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.unit.dp
import id.starstask.mobile.data.MAX_WEEK_OFFSET
import id.starstask.mobile.data.MyWeekData
import id.starstask.mobile.data.MyWeekItem
import id.starstask.mobile.data.MyWeekItemKind
import id.starstask.mobile.data.formatTime
import id.starstask.mobile.data.jakartaDate
import id.starstask.mobile.ui.components.WebButton
import id.starstask.mobile.ui.components.WebButtonVariant
import id.starstask.mobile.ui.components.WebCompactCard
import id.starstask.mobile.ui.theme.Accent
import id.starstask.mobile.ui.theme.AccentSoft
import id.starstask.mobile.ui.theme.Foreground
import id.starstask.mobile.ui.theme.MutedForeground
import id.starstask.mobile.ui.theme.Surface

private fun weekOptionLabel(offset: Int, currentMonday: java.time.LocalDate): String = when (offset) {
    0 -> "This week"
    -1 -> "Last week"
    1 -> "Next week"
    else -> "Week of ${currentMonday.plusWeeks(offset.toLong())}"
}

@Composable
fun MyWeekSection(
    week: MyWeekData,
    weekOffset: Int,
    canScheduleSessions: Boolean,
    onWeekChange: (Int) -> Unit,
    onItemClick: (MyWeekItem) -> Unit,
    onAddSession: () -> Unit,
) {
    val zone = java.time.ZoneId.of("Asia/Jakarta")
    val weekStart = java.time.LocalDate.parse(jakartaDate(week.weekStartIso))
    val today = java.time.LocalDate.now(zone)
    val currentMonday = today.minusDays((today.dayOfWeek.value - 1).toLong())
    val rangeLabel = "${weekStart.dayOfMonth}/${weekStart.monthValue} – " +
        "${weekStart.plusDays(6).dayOfMonth}/${weekStart.plusDays(6).monthValue}"
    var menuExpanded by remember { mutableStateOf(false) }

    Column(modifier = Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(Spacing.Lg)) {
    Column(modifier = Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(Spacing.Md)) {
        Text(
            weekOptionLabel(weekOffset, currentMonday),
            style = MaterialTheme.typography.titleMedium,
            color = Foreground,
        )
        Row(
            horizontalArrangement = Arrangement.spacedBy(Spacing.Sm),
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()),
        ) {
            WebButton(label = "Today", onClick = { onWeekChange(0) }, modifier = Modifier.widthIn(min = 72.dp), variant = WebButtonVariant.SECONDARY)
            WebButton(
                label = "‹",
                onClick = { onWeekChange(weekOffset - 1) },
                modifier = Modifier.widthIn(min = 48.dp),
                variant = WebButtonVariant.SECONDARY,
                enabled = weekOffset > -MAX_WEEK_OFFSET,
            )
            WebButton(
                label = "›",
                onClick = { onWeekChange(weekOffset + 1) },
                modifier = Modifier.widthIn(min = 48.dp),
                variant = WebButtonVariant.SECONDARY,
                enabled = weekOffset < MAX_WEEK_OFFSET,
            )
            Box {
                WebButton(label = "Week ▾", onClick = { menuExpanded = true }, modifier = Modifier.widthIn(min = 88.dp), variant = WebButtonVariant.SECONDARY)
                DropdownMenu(expanded = menuExpanded, onDismissRequest = { menuExpanded = false }) {
                    listOf(-2, -1, 0, 1, 2).forEach { offset ->
                        DropdownMenuItem(
                            text = { Text(weekOptionLabel(offset, currentMonday)) },
                            onClick = {
                                menuExpanded = false
                                onWeekChange(offset)
                            },
                        )
                    }
                }
            }
        }
        Text(rangeLabel, color = MutedForeground, style = MaterialTheme.typography.bodySmall)
    }

        Row(horizontalArrangement = Arrangement.spacedBy(Spacing.Sm), modifier = Modifier.fillMaxWidth()) {
            (0..6).forEach { index ->
                val day = weekStart.plusDays(index.toLong())
                val dayItems = week.items.filter { jakartaDate(it.at) == day.toString() }
                Column(
                    horizontalAlignment = Alignment.CenterHorizontally,
                    modifier = Modifier
                        .weight(1f)
                        .clip(RoundedCornerShape(10.dp))
                        .background(if (day == today) AccentSoft else Surface)
                        .padding(vertical = Spacing.Md),
                ) {
                    Text(day.dayOfWeek.toString().take(3), style = MaterialTheme.typography.bodySmall, color = MutedForeground)
                    Text(day.dayOfMonth.toString(), style = MaterialTheme.typography.titleMedium, color = Foreground)
                    Text(
                        if (dayItems.isEmpty()) "·" else "${dayItems.size}",
                        style = MaterialTheme.typography.bodySmall,
                        color = Accent,
                    )
                }
            }
        }

        (0..6).forEach { index ->
            val day = weekStart.plusDays(index.toLong())
            val dayItems = week.items.filter { jakartaDate(it.at) == day.toString() }
            if (dayItems.isNotEmpty()) {
                Column(verticalArrangement = Arrangement.spacedBy(Spacing.Sm)) {
                    Text(
                        "${day.dayOfWeek} · ${day.dayOfMonth}/${day.monthValue}${if (day == today) " · Today" else ""}",
                        color = if (day == today) Accent else MutedForeground,
                        style = MaterialTheme.typography.bodySmall,
                    )
                    dayItems.forEach { item ->
                        WebCompactCard(
                            modifier = Modifier.fillMaxWidth(),
                            onClick = { onItemClick(item) },
                            padding = 12.dp,
                        ) {
                            Column {
                                Text(
                                    when (item.kind) {
                                        MyWeekItemKind.ASSIGNMENT -> "Assignment · ${item.title}"
                                        MyWeekItemKind.LEAVE -> "Absence · ${item.title}"
                                        MyWeekItemKind.SESSION -> "Session · ${item.title}"
                                    },
                                    color = Foreground,
                                )
                                Text(
                                    "${formatTime(item.at)} · ${item.className ?: when (item.kind) {
                                        MyWeekItemKind.ASSIGNMENT -> "Assignment"
                                        MyWeekItemKind.LEAVE -> "Absence"
                                        MyWeekItemKind.SESSION -> "Session"
                                    }}",
                                    color = MutedForeground,
                                    style = MaterialTheme.typography.bodySmall,
                                )
                            }
                        }
                    }
                }
            }
        }

        if (canScheduleSessions) {
            WebButton(
                label = "+ Schedule a session",
                onClick = onAddSession,
                modifier = Modifier.fillMaxWidth(),
                variant = WebButtonVariant.SECONDARY,
            )
        }
    }
}
