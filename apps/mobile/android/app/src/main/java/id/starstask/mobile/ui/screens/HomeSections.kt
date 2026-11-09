package id.starstask.mobile.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyListScope
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import id.starstask.mobile.data.DashboardData
import id.starstask.mobile.data.DashboardAssignment
import id.starstask.mobile.data.DashboardClass
import id.starstask.mobile.ui.theme.Spacing

// Dashboard stat + quick action + week sections. Extracted from HomeScreen.
// The grid mirrors web `stat-cards.tsx`: `grid-cols-2 gap-2.5`.

fun LazyListScope.homeStatsSection(
    current: DashboardData?,
    onOpenTasks: () -> Unit,
    onOpenClasses: () -> Unit,
) {
    item {
        Row(horizontalArrangement = Arrangement.spacedBy(Spacing.CardGap), modifier = Modifier.fillMaxWidth()) {
            StatCard("Total assignments", current?.totalTasks ?: 0, TasksIcon, "accent", Modifier.weight(1f), hint = "In your classes", delta = current?.newThisWeek ?: 0, onClick = onOpenTasks)
            StatCard("Due soon", current?.dueSoon ?: 0, DueIcon, "warning", Modifier.weight(1f), hint = "Within the next 7 days", onClick = onOpenTasks)
        }
        Row(horizontalArrangement = Arrangement.spacedBy(Spacing.CardGap), modifier = Modifier.fillMaxWidth().padding(top = Spacing.CardGap)) {
            StatCard("Past deadline", current?.pastDeadline ?: 0, WarningIcon, "danger", Modifier.weight(1f), hint = "Needs your attention", onClick = onOpenTasks)
            StatCard("My classes", current?.classes?.size ?: 0, ClassesIcon, "success", Modifier.weight(1f), hint = "Active membership", onClick = onOpenClasses)
        }
    }
}

fun LazyListScope.homeQuickActionsSection(
    onCheckIn: () -> Unit,
    onOpenTasks: () -> Unit,
    onOpenMessages: () -> Unit,
    onOpenSchedule: () -> Unit,
    onNewAssignment: () -> Unit,
) {
    item {
        QuickActions(
            onCheckIn = onCheckIn,
            onOpenTasks = onOpenTasks,
            onOpenMessages = onOpenMessages,
            onOpenSchedule = onOpenSchedule,
            onNewAssignment = onNewAssignment,
        )
    }
}
