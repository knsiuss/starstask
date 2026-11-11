package id.starstask.mobile.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import id.starstask.mobile.data.ActiveMeeting
import id.starstask.mobile.data.AttendanceIdentity
import id.starstask.mobile.data.StudentAttendanceView
import id.starstask.mobile.data.attendanceCsv
import id.starstask.mobile.data.attendancePdfBytes
import id.starstask.mobile.data.attendancePeriodLabel
import id.starstask.mobile.data.buildCourseRows
import id.starstask.mobile.data.deviceDate
import id.starstask.mobile.data.loadActiveAttendance
import id.starstask.mobile.data.loadAttendanceIdentity
import id.starstask.mobile.data.loadStudentAttendance
import id.starstask.mobile.data.shareFile
import id.starstask.mobile.data.summarizeAttendance
import id.starstask.mobile.ui.components.WebAlert
import id.starstask.mobile.ui.components.WebButton
import id.starstask.mobile.ui.components.WebButtonVariant
import id.starstask.mobile.ui.components.WebSkeletonCard
import id.starstask.mobile.ui.theme.Spacing
import id.starstask.mobile.ui.theme.mockPageBrush

@Composable
fun AttendanceScreen(
    userId: String,
    onOpenCourse: (Triple<String, String, String?>) -> Unit,
    onOpenSession: (sessionId: String) -> Unit,
    onViewAllCourses: () -> Unit,
    onManageClass: (String) -> Unit,
    onBrowseClasses: () -> Unit,
) {
    val context = LocalContext.current
    var selectedTab by remember { mutableStateOf("checkin") }
    var view by remember { mutableStateOf<StudentAttendanceView?>(null) }
    var activeMeetings by remember { mutableStateOf<List<ActiveMeeting>>(emptyList()) }
    var identity by remember { mutableStateOf<AttendanceIdentity?>(null) }
    var loading by remember { mutableStateOf(true) }
    var error by remember { mutableStateOf<String?>(null) }
    var reloadTick by remember { mutableStateOf(0) }
    var filtersOpen by remember { mutableStateOf(false) }
    var filterClassId by remember { mutableStateOf<String?>(null) }
    var filterSubjectId by remember { mutableStateOf<String?>(null) }
    var filterStatus by remember { mutableStateOf("all") }
    var filterSemester by remember { mutableStateOf<String?>(null) }
    var filterYear by remember { mutableStateOf<String?>(null) }
    var filterFrom by remember { mutableStateOf<String?>(null) }
    var filterTo by remember { mutableStateOf<String?>(null) }

    LaunchedEffect(userId, reloadTick) {
        loading = true
        error = null
        try {
            view = loadStudentAttendance(userId)
            activeMeetings = loadActiveAttendance(userId)
            identity = loadAttendanceIdentity(userId)
        } catch (_: Exception) {
            error = "Could not load your attendance. Check your connection and try again."
        }
        loading = false
    }

    LazyColumn(
        modifier = Modifier.fillMaxSize().background(mockPageBrush()),
        contentPadding = PaddingValues(
            start = Spacing.Section,
            end = Spacing.Section,
            top = Spacing.Sm,
            bottom = 104.dp,
        ),
        verticalArrangement = Arrangement.spacedBy(Spacing.Xxl),
    ) {
        item(key = "header") {
            AttendancePageHeader(selectedTab = selectedTab, onSelectTab = { selectedTab = it })
        }

        if (loading) {
            item(key = "loading") {
                Column(verticalArrangement = Arrangement.spacedBy(Spacing.Md)) {
                    repeat(3) { WebSkeletonCard() }
                }
            }
            return@LazyColumn
        }
        if (error != null && view == null) {
            item(key = "error") {
                Column(verticalArrangement = Arrangement.spacedBy(Spacing.Md)) {
                    WebAlert(message = error!!)
                    WebButton(label = "Retry", onClick = { reloadTick++ }, variant = WebButtonVariant.SECONDARY)
                }
            }
            return@LazyColumn
        }

        val current = view ?: return@LazyColumn
        val rows = buildCourseRows(current)

        if (!current.hasClasses) {
            item(key = "no-classes") { NoClassesSection(onBrowseClasses = onBrowseClasses) }
            return@LazyColumn
        }

        if (selectedTab == "checkin") {
            item(key = "active") {
                ActiveSection(
                    heading = "Active Now",
                    active = activeMeetings,
                    identity = identity,
                    userId = userId,
                    onChanged = { reloadTick++ },
                    onOpenMeeting = onOpenSession,
                )
            }
            item(key = "active-card") {
                ActiveAttendanceCard(
                    period = attendancePeriodLabel(current),
                    managed = current.ManagedAttendanceClasses,
                    onOpenManageClass = { onManageClass(it.id) },
                    onBrowseClasses = onBrowseClasses,
                )
            }
            item(key = "courses") {
                CourseAttendanceSection(
                    rows = rows.take(6),
                    onOpenCourse = { (subjectId, name, code) ->
                        onOpenCourse(Triple(subjectId, name, code))
                    },
                    onViewAll = onViewAllCourses,
                )
            }
        } else {
            val filtered = current.entries.filter { entry ->
                (filterClassId == null || entry.classId == filterClassId) &&
                    (filterSubjectId == null || entry.subjectId == filterSubjectId) &&
                    (filterStatus == "all" || entry.status == filterStatus) &&
                    (filterSemester == null || entry.semester == filterSemester) &&
                    (filterYear == null || entry.academicYear == filterYear) &&
                    (filterFrom == null || deviceDate(entry.startsAt) >= filterFrom!!) &&
                    (filterTo == null || deviceDate(entry.startsAt) <= filterTo!!)
            }
            item(key = "history-toolbar") {
                HistoryToolbar(
                    selectedCount = activeFilterCount(filterClassId, filterSubjectId, filterStatus, filterSemester, filterYear, filterFrom, filterTo),
                    onOpenFilters = { filtersOpen = true },
                    onExportCsv = { shareAttendanceCsv(context, filtered) },
                    onExportPdf = { shareAttendancePdf(context, filtered) },
                    canExport = filtered.isNotEmpty(),
                )
            }
            item(key = "history") {
                HistorySection(
                    totalCount = filtered.size,
                    entries = filtered,
                    onOpenSession = { onOpenSession(it.sessionId) },
                )
            }
        }
    }

    if (filtersOpen) {
        AttendanceFilterSheet(
            base = view,
            initialClassId = filterClassId,
            initialSubjectId = filterSubjectId,
            initialStatus = filterStatus,
            initialSemester = filterSemester,
            initialYear = filterYear,
            initialFrom = filterFrom,
            initialTo = filterTo,
            onDismiss = { filtersOpen = false },
            onApply = { classId, subjectId, status, semester, year, from, to ->
                filterClassId = classId
                filterSubjectId = subjectId
                filterStatus = status
                filterSemester = semester
                filterYear = year
                filterFrom = from
                filterTo = to
                filtersOpen = false
            },
        )
    }
}

private fun activeFilterCount(
    classId: String?,
    subjectId: String?,
    status: String,
    semester: String?,
    year: String?,
    from: String?,
    to: String?,
): Int = listOf(classId, subjectId, semester, year, from, to).count { it != null } + if (status != "all") 1 else 0

private fun shareAttendanceCsv(context: android.content.Context, entries: List<id.starstask.mobile.data.AttendanceEntry>) {
    if (entries.isEmpty()) return
    val file = java.io.File(id.starstask.mobile.data.sharedReportsDir(context), "starstask-attendance-" + System.currentTimeMillis() + ".csv")
    file.writeText(attendanceCsv(entries), Charsets.UTF_8)
    shareFile(context, file, "text/csv", "Attendance report")
}

private fun shareAttendancePdf(context: android.content.Context, entries: List<id.starstask.mobile.data.AttendanceEntry>) {
    if (entries.isEmpty()) return
    val file = java.io.File(id.starstask.mobile.data.sharedReportsDir(context), "starstask-attendance-" + System.currentTimeMillis() + ".pdf")
    file.writeBytes(
        attendancePdfBytes(
            title = "Attendance report",
            summary = summarizeAttendance(entries.map { it.status }),
            entries = entries,
        ),
    )
    shareFile(context, file, "application/pdf", "Attendance report")
}
