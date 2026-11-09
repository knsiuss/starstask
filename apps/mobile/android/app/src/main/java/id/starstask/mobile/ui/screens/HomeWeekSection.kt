package id.starstask.mobile.ui.screens

import id.starstask.mobile.ui.theme.Spacing

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.lazy.LazyListScope
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.ui.unit.dp
import id.starstask.mobile.data.DashboardData
import id.starstask.mobile.data.MyWeekItemKind
import id.starstask.mobile.ui.components.WebSectionTitle
import id.starstask.mobile.ui.components.WebAlert
import id.starstask.mobile.ui.components.WebButton
import id.starstask.mobile.ui.components.WebButtonVariant
import id.starstask.mobile.ui.theme.Danger

// My Week section (web order: between Next Schedule and My Classes).

fun LazyListScope.homeWeekSection(
    weekError: String?,
    week: id.starstask.mobile.data.MyWeekData?,
    weekOffset: Int,
    canScheduleSessions: Boolean,
    current: DashboardData?,
    onRetry: () -> Unit,
    onWeekChange: (Int) -> Unit,
    onOpenSession: (String) -> Unit,
    onOpenAssignment: (id.starstask.mobile.data.DashboardAssignment) -> Unit,
    onLeaveClick: (String) -> Unit,
    onAddSession: () -> Unit,
) {
    item { WebSectionTitle("My week") }
    if (weekError != null) {
        item {
            Column(verticalArrangement = Arrangement.spacedBy(Spacing.Md)) {
                WebAlert(message = weekError)
                WebButton(label = "Retry", onClick = onRetry, variant = WebButtonVariant.SECONDARY)
            }
        }
    } else if (week != null) {
        item {
            MyWeekSection(
                week = week,
                weekOffset = weekOffset,
                canScheduleSessions = canScheduleSessions,
                onWeekChange = onWeekChange,
                onItemClick = { item ->
                    when (item.kind) {
                        MyWeekItemKind.SESSION -> onOpenSession(item.hrefId)
                        MyWeekItemKind.ASSIGNMENT -> {
                            val assignment = current?.upcomingAssignments?.firstOrNull { it.id == item.hrefId }
                                ?: id.starstask.mobile.data.DashboardAssignment(
                                    id = item.hrefId,
                                    title = item.title,
                                    deadline = item.at,
                                    subjectName = item.className,
                                )
                            onOpenAssignment(assignment)
                        }
                        MyWeekItemKind.LEAVE -> onLeaveClick(item.title)
                    }
                },
                onAddSession = onAddSession,
            )
        }
    } else {
        item { CircularProgressIndicator() }
    }
}
