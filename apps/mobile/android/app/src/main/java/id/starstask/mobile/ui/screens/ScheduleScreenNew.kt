package id.starstask.mobile.ui.screens

import androidx.compose.animation.animateColorAsState
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import id.starstask.mobile.data.CalendarAssignmentBar
import id.starstask.mobile.data.CalendarLoaded
import id.starstask.mobile.data.CalendarTimelineItem
import id.starstask.mobile.data.CalendarView
import id.starstask.mobile.data.buildCalendarRange
import id.starstask.mobile.data.formatDayLabel
import id.starstask.mobile.data.formatMonthLabel
import id.starstask.mobile.data.formatShortDayMonth
import id.starstask.mobile.data.jakartaTodayKey
import id.starstask.mobile.data.listCalendar
import id.starstask.mobile.data.shiftCalendarAnchor
import id.starstask.mobile.ui.components.WebAlert
import id.starstask.mobile.ui.icons.Lucide
import id.starstask.mobile.ui.theme.AssignmentAccent
import id.starstask.mobile.ui.theme.AssignmentBackground
import id.starstask.mobile.ui.theme.AssignmentForeground
import id.starstask.mobile.ui.theme.AssignmentSecondary
import id.starstask.mobile.ui.theme.Surface

private enum class ScheduleMode { WEEK, MONTH, LIST }

private fun ScheduleMode.toCalendarView(): CalendarView = when (this) {
    ScheduleMode.WEEK -> CalendarView.WEEK
    ScheduleMode.MONTH -> CalendarView.MONTH
    ScheduleMode.LIST -> CalendarView.LIST
}

/**
 * Ultra-clean Schedule — Apple Calendar / Assignments-inspired.
 *
 * • ONE LazyColumn on #F7F8FA, 20dp gutters, 24dp section rhythm.
 * • Title 28sp + subtitle 14sp secondary. No FAB badges.
 * • Create: two equal pills (Official primary, Personal secondary).
 * • Mode: segmented 3 tabs — selected Accent, rest transparent.
 * • Nav: prev/next 48dp circles, range 17sp, "Today" link.
 * • Agenda: grouped white lists (radius 20dp, border 0.5dp), title 16sp,
 *   subtitle 13sp secondary, rail only — no chips/pills/badges.
 * • Upcoming: same grouped list, plain text rows.
 * Touch targets ≥48dp.
 */
@Composable
fun ScheduleScreen(
    userId: String,
    onOpenAssignment: ((String) -> Unit)? = null,
    onOpenSession: ((String) -> Unit)? = null,
    onOpenLeave: ((String) -> Unit)? = null,
    onOpenClassSchedule: ((String) -> Unit)? = null,
    onViewAllAssignments: (() -> Unit)? = null,
) {
    var mode by remember { mutableStateOf(ScheduleMode.WEEK) }
    var anchorKey by remember { mutableStateOf(jakartaTodayKey()) }
    var showHistory by remember { mutableStateOf(false) }
    var typeFilter by remember { mutableStateOf("all") }
    var mineOnly by remember { mutableStateOf(false) }
    var courseKeys by remember { mutableStateOf<Set<String>?>(null) }
    var classFilter by remember { mutableStateOf<String?>(null) }

    var loaded by remember { mutableStateOf<CalendarLoaded?>(null) }
    var loading by remember { mutableStateOf(true) }
    var error by remember { mutableStateOf<String?>(null) }
    var reloadTick by remember { mutableStateOf(0) }
    var detailItem by remember { mutableStateOf<CalendarTimelineItem?>(null) }
    var formScope by remember { mutableStateOf<String?>(null) }
    var editingItem by remember { mutableStateOf<CalendarTimelineItem?>(null) }
    var showFilters by remember { mutableStateOf(false) }
    var showStorageWarning by remember { mutableStateOf(false) }

    val view = mode.toCalendarView()

    LaunchedEffect(userId, view, anchorKey, showHistory, typeFilter, mineOnly, courseKeys, classFilter, reloadTick) {
        loading = true
        error = null
        try {
            val result = listCalendar(
                userId = userId,
                view = view,
                anchorKey = anchorKey,
                showHistory = showHistory,
                typeFilter = typeFilter,
                mineOnly = mineOnly,
                courseKeys = courseKeys,
                classFilter = classFilter,
            )
            loaded = result
            showStorageWarning = !result.storageReady
        } catch (_: Exception) {
            error = "Could not load schedule."
        }
        loading = false
    }

    val data = loaded
    val range = buildCalendarRange(view, anchorKey)
    val todayKey = data?.todayKey ?: jakartaTodayKey()
    val scope = data?.scope
    val items = data?.items.orEmpty()
    val assignments = data?.assignments.orEmpty()
    val upcoming = data?.upcoming.orEmpty()
    val markedKeys = remember(items) { buildMarkedDayKeys(items) }
    val adminClasses = scope?.classes.orEmpty().filter { it.isAdmin }
    val rangeLabel = when (mode) {
        ScheduleMode.MONTH -> formatMonthLabel(anchorKey)
        ScheduleMode.WEEK -> "${formatDayLabel(range.startKey).removeSuffix(range.startKey.takeLast(4))} – ${formatDayLabel(range.endKey)}"
        ScheduleMode.LIST -> "${formatDayLabel(range.startKey)} – ${formatDayLabel(range.endKey)}"
    }

    fun goToAssignment(id: String) {
        if (onOpenAssignment != null) {
            onOpenAssignment(id)
        } else {
            detailItem = null
        }
    }

    fun offerCreate(scopeName: String) {
        formScope = scopeName
        editingItem = null
    }

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .background(AssignmentBackground),
        contentPadding = PaddingValues(horizontal = 20.dp, vertical = 20.dp),
        verticalArrangement = Arrangement.spacedBy(24.dp),
    ) {
        item(key = "header") {
            Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    Text(
                        "Schedule",
                        color = AssignmentForeground,
                        fontSize = 28.sp,
                        fontWeight = FontWeight.SemiBold,
                        modifier = Modifier.weight(1f),
                    )
                    Icon(
                        imageVector = Lucide.SlidersHorizontal,
                        contentDescription = "Filters",
                        tint = AssignmentSecondary,
                        modifier = Modifier
                            .size(48.dp)
                            .clip(RoundedCornerShape(12.dp))
                            .background(Color.White)
                            .border(0.5.dp, Color(0xFFE9EBF0), RoundedCornerShape(12.dp))
                            .clickable { showFilters = true }
                            .padding(12.dp),
                    )
                }
                Text(
                    "Your assignments, classes, and events — all in one place.",
                    color = AssignmentSecondary,
                    fontSize = 14.sp,
                )
            }
        }

        if (!showStorageWarning) {
            item(key = "create") {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
                    if (adminClasses.isNotEmpty()) {
                        Box(
                            modifier = Modifier
                                .weight(1f)
                                .clip(RoundedCornerShape(999.dp))
                                .background(AssignmentAccent)
                                .clickable { offerCreate("official") }
                                .padding(vertical = 14.dp),
                            contentAlignment = Alignment.Center,
                        ) {
                            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                Icon(Lucide.PlusCircle, contentDescription = null, tint = Color.White, modifier = Modifier.size(18.dp))
                                Text("Official Event", color = Color.White, fontSize = 15.sp, fontWeight = FontWeight.SemiBold)
                            }
                        }
                    }
                    Box(
                        modifier = Modifier
                            .weight(1f)
                            .clip(RoundedCornerShape(999.dp))
                            .background(Color(0xFFEEF1F7))
                            .clickable { offerCreate("personal") }
                            .padding(vertical = 14.dp),
                        contentAlignment = Alignment.Center,
                    ) {
                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                            Icon(Lucide.UserRound, contentDescription = null, tint = AssignmentForeground, modifier = Modifier.size(18.dp))
                            Text("Personal Event", color = AssignmentForeground, fontSize = 15.sp, fontWeight = FontWeight.SemiBold)
                        }
                    }
                }
            }
        }

        if (showStorageWarning) {
            item(key = "storage-warning") {
                WebAlert(
                    message = "Calendar storage is not deployed yet. Assignment deadlines still appear.",
                )
            }
        }

        item(key = "mode") {
            ScheduleModeSelector(mode = mode, onSelect = { mode = it })
        }

        item(key = "nav") {
            ScheduleNavBar(
                rangeLabel = rangeLabel,
                onPrevious = { anchorKey = shiftCalendarAnchor(view, anchorKey, -1) },
                onNext = { anchorKey = shiftCalendarAnchor(view, anchorKey, 1) },
                onToday = { anchorKey = jakartaTodayKey() },
                showHistory = showHistory,
                onToggleHistory = { showHistory = !showHistory },
            )
        }

        if (error != null) {
            item(key = "error") {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    WebAlert(message = error!!)
                    Text(
                        "Retry",
                        color = AssignmentAccent,
                        fontSize = 14.sp,
                        fontWeight = FontWeight.SemiBold,
                        modifier = Modifier
                            .clip(RoundedCornerShape(999.dp))
                            .background(Color(0xFFEEF1F7))
                            .clickable { reloadTick++ }
                            .padding(horizontal = 20.dp, vertical = 12.dp),
                    )
                }
            }
        }

        if (loading && data == null) {
            item(key = "loading") {
                Box(modifier = Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator(color = AssignmentAccent)
                }
            }
        }

        if (data != null) {
            when (mode) {
                ScheduleMode.WEEK -> item(key = "week-view") {
                    WeekCalendarView(
                        range = range,
                        anchorKey = anchorKey,
                        todayKey = todayKey,
                        markedKeys = markedKeys,
                        onSelectDay = { anchorKey = it },
                    )
                }
                ScheduleMode.MONTH -> item(key = "month-view") {
                    MonthCalendarView(
                        range = range,
                        anchorKey = anchorKey,
                        todayKey = todayKey,
                        markedKeys = markedKeys,
                        onSelectDay = { anchorKey = it },
                    )
                }
                ScheduleMode.LIST -> Unit
            }

            item(key = "agenda") {
                ScheduleAgendaList(
                    range = range,
                    items = items,
                    anchorKey = anchorKey,
                    todayKey = todayKey,
                    view = view,
                    onOpen = { detailItem = it },
                    completionSlot = { item ->
                        if (item.kind == "assignment" && item.assignmentId != null) {
                            {
                                CompletionToggle(
                                    userId = userId,
                                    assignmentId = item.assignmentId!!,
                                    completed = item.isCompleted,
                                    title = item.title,
                                    onChanged = { reloadTick++ },
                                )
                            }
                        } else null
                    },
                )
            }

            item(key = "upcoming") {
                UpcomingSection(
                    assignments = upcoming,
                    onViewAll = onViewAllAssignments ?: {},
                    onOpen = { bar -> goToAssignment(bar.id) },
                )
            }

            item(key = "tz-note") {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(20.dp))
                        .background(Surface)
                        .border(0.5.dp, Color(0xFFE9EBF0), RoundedCornerShape(20.dp))
                        .padding(horizontal = 16.dp, vertical = 16.dp),
                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Icon(
                        imageVector = Lucide.CalendarClock,
                        contentDescription = null,
                        tint = AssignmentSecondary,
                        modifier = Modifier.size(20.dp),
                    )
                    Text(
                        "All times in Asia/Jakarta (WIB).",
                        color = AssignmentSecondary,
                        fontSize = 13.sp,
                        modifier = Modifier.weight(1f),
                    )
                }
            }

            item(key = "bottom-spacer") {
                Box(modifier = Modifier.size(height = 96.dp, width = 0.dp))
            }
        }
    }

    detailItem?.let { item ->
        EventDetailSheet(
            userId = userId,
            item = item,
            onDismiss = { detailItem = null },
            onAssignmentClick = {
                val id = item.assignmentId
                if (onOpenAssignment != null && id != null) {
                    onOpenAssignment(id)
                }
                detailItem = null
            },
            onSessionClick = {
                if (onOpenSession != null) onOpenSession(item.sourceId)
                detailItem = null
            },
            onLeaveClick = {
                if (onOpenLeave != null) onOpenLeave(item.sourceId)
                detailItem = null
            },
            onOpenClass = {
                if (onOpenClassSchedule != null && item.classId != null) {
                    onOpenClassSchedule(item.classId!!)
                }
                detailItem = null
            },
            onEdit = {
                val scopeName = if (item.owner == "personal") "personal" else "official"
                formScope = scopeName
                editingItem = item
                detailItem = null
            },
        )
    }

    formScope?.let { scopeName ->
        EventFormSheet(
            userId = userId,
            scope = scopeName,
            existing = editingItem,
            defaultDateKey = anchorKey,
            classes = scope?.classes.orEmpty(),
            onDismiss = {
                formScope = null
                editingItem = null
            },
            onSaved = {
                formScope = null
                editingItem = null
                reloadTick++
            },
        )
    }

    if (showFilters && data != null) {
        CalendarCourseFilterSheet(
            assignments = assignments,
            classes = scope?.classes.orEmpty(),
            selected = courseKeys,
            mineOnly = mineOnly,
            typeFilter = typeFilter,
            classFilter = classFilter,
            onToggleCourse = { key ->
                val current = courseKeys ?: courseOptionsOf(assignments, scope?.classes.orEmpty()).map { it.key }.toSet()
                courseKeys = if (current.contains(key)) current - key else current + key
            },
            onToggleMine = { mineOnly = !mineOnly },
            onSelectType = { typeFilter = it },
            onSelectClass = { classFilter = it },
            onReset = {
                courseKeys = null
                mineOnly = false
                typeFilter = "all"
                classFilter = null
            },
            onDismiss = { showFilters = false },
        )
    }
}

@Composable
private fun ScheduleModeSelector(mode: ScheduleMode, onSelect: (ScheduleMode) -> Unit) {
    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(4.dp)) {
        listOf(
            ScheduleMode.WEEK to "Week",
            ScheduleMode.MONTH to "Month",
            ScheduleMode.LIST to "List",
        ).forEach { (value, label) ->
            val selected = mode == value
            val bg by animateColorAsState(
                targetValue = if (selected) AssignmentAccent else Color.White,
                label = "mode-bg",
            )
            Box(
                modifier = Modifier
                    .weight(1f)
                    .clip(RoundedCornerShape(999.dp))
                    .background(bg)
                    .border(0.5.dp, Color(0xFFE9EBF0), RoundedCornerShape(999.dp))
                    .clickable { onSelect(value) }
                    .padding(vertical = 12.dp),
                contentAlignment = Alignment.Center,
            ) {
                Text(
                    label,
                    color = if (selected) Color.White else AssignmentForeground,
                    fontSize = 14.sp,
                    fontWeight = FontWeight.SemiBold,
                )
            }
        }
    }
}

@Composable
private fun ScheduleNavBar(
    rangeLabel: String,
    onPrevious: () -> Unit,
    onNext: () -> Unit,
    onToday: () -> Unit,
    showHistory: Boolean,
    onToggleHistory: () -> Unit,
) {
    // One quiet row: prev/range/next. "Today" and "Past events" are text links
    // on the next row — no competing pills, no tight stacking.
    Row(
        modifier = Modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        NavCircle(icon = Lucide.ChevronLeft, label = "Previous period", onClick = onPrevious)
        Text(
            rangeLabel,
            color = AssignmentForeground,
            fontSize = 17.sp,
            fontWeight = FontWeight.SemiBold,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            modifier = Modifier.weight(1f),
        )
        NavCircle(icon = Lucide.ChevronRight, label = "Next period", onClick = onNext)
    }
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(top = 8.dp, start = 4.dp, end = 4.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween,
    ) {
        Text(
            "Today",
            color = AssignmentAccent,
            fontSize = 14.sp,
            fontWeight = FontWeight.SemiBold,
            modifier = Modifier
                .clickable { onToday() }
                .padding(vertical = 8.dp),
        )
        Text(
            if (showHistory) "Past events: On" else "Past events: Off",
            color = if (showHistory) AssignmentAccent else AssignmentSecondary,
            fontSize = 14.sp,
            fontWeight = FontWeight.Medium,
            modifier = Modifier
                .clickable { onToggleHistory() }
                .padding(vertical = 8.dp),
        )
    }
}

@Composable
private fun NavCircle(icon: androidx.compose.ui.graphics.vector.ImageVector, label: String, onClick: () -> Unit) {
    Box(
        modifier = Modifier
            .size(48.dp)
            .clip(RoundedCornerShape(999.dp))
            .background(Color.White)
            .border(0.5.dp, Color(0xFFE9EBF0), RoundedCornerShape(999.dp))
            .clickable { onClick() },
        contentAlignment = Alignment.Center,
    ) {
        Icon(imageVector = icon, contentDescription = label, tint = AssignmentForeground, modifier = Modifier.size(20.dp))
    }
}

@Composable
private fun UpcomingSection(
    assignments: List<CalendarAssignmentBar>,
    onViewAll: () -> Unit,
    onOpen: (CalendarAssignmentBar) -> Unit,
) {
    Column(modifier = Modifier.fillMaxWidth()) {
        Text(
            "Upcoming",
            color = AssignmentForeground,
            fontSize = 20.sp,
            fontWeight = FontWeight.SemiBold,
            modifier = Modifier.padding(bottom = 12.dp),
        )
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(20.dp))
                .background(Color.White)
                .border(0.5.dp, Color(0xFFE9EBF0), RoundedCornerShape(20.dp)),
        ) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 12.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    "Nearest deadline first",
                    color = AssignmentSecondary,
                    fontSize = 13.sp,
                    modifier = Modifier.weight(1f),
                )
                Text(
                    "View all",
                    color = AssignmentAccent,
                    fontSize = 13.sp,
                    fontWeight = FontWeight.SemiBold,
                    modifier = Modifier.clickable { onViewAll() },
                )
            }
            if (assignments.isEmpty()) {
                Text(
                    "No upcoming assignments.",
                    color = AssignmentSecondary,
                    fontSize = 13.sp,
                    modifier = Modifier.padding(horizontal = 16.dp, vertical = 16.dp),
                )
            } else {
                assignments.forEachIndexed { index, bar ->
                    val alt = index % 2 == 1
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .background(if (alt) Color(0xFFF7F8FA) else Color.Transparent)
                            .clickable { onOpen(bar) }
                            .padding(horizontal = 16.dp, vertical = 14.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Column(modifier = Modifier.weight(1f)) {
                            Text(bar.title, color = AssignmentForeground, fontSize = 15.sp, fontWeight = FontWeight.SemiBold, maxLines = 2, overflow = TextOverflow.Ellipsis)
                            Text(
                                "${bar.courseName ?: bar.className ?: "Assignment"} · ${formatShortDayMonth(bar.startKey)} – ${formatShortDayMonth(bar.endKey)}",
                                color = AssignmentSecondary,
                                fontSize = 13.sp,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis,
                            )
                        }
                        Text(
                            if (bar.isCompleted) "Done" else formatShortDayMonth(bar.endKey),
                            color = if (bar.isCompleted) AssignmentSecondary else AssignmentAccent,
                            fontSize = 13.sp,
                            fontWeight = FontWeight.SemiBold,
                        )
                    }
                }
            }
        }
    }
}
