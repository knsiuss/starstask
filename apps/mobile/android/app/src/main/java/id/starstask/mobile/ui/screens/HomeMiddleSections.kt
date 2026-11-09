package id.starstask.mobile.ui.screens

import androidx.compose.foundation.lazy.LazyListScope
import id.starstask.mobile.data.DashboardClass
import id.starstask.mobile.data.NextScheduleItem

// Middle sections: next schedule + my classes (web order).

fun LazyListScope.homeMiddleSections(
    scheduleItems: List<NextScheduleItem>,
    onOpenTasks: () -> Unit,
    onOpenSchedule: () -> Unit,
    classes: List<DashboardClass>,
    onOpenClasses: () -> Unit,
    onClassClick: (DashboardClass) -> Unit,
) {
    nextScheduleListSection(
        scheduleItems = scheduleItems,
        onOpenTasks = onOpenTasks,
        onOpenSchedule = onOpenSchedule,
    )
    myClassesSection(
        classes = classes,
        onOpenClasses = onOpenClasses,
        onClassClick = onClassClick,
    )
}
