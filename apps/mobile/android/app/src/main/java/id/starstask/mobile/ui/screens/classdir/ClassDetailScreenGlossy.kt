package id.starstask.mobile.ui.screens.classdir

// Glossy class detail scaffold: header (back + code + chips + actions), tab
// strip, and one content per tab. Reuses the existing tabs for Courses and
// Assignments; Members / Attendance / Overview / Schedule / Info are new
// glossy surfaces. External behavior stays the same as ClassDetailScreen
// (in-screen push, no NavHost routes).

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.unit.dp
import id.starstask.mobile.data.ClassDetail
import id.starstask.mobile.data.loadClassOverview
import id.starstask.mobile.ui.screens.ClassCoursesTab
import id.starstask.mobile.ui.screens.CreateAssignmentDialog
import id.starstask.mobile.ui.screens.AssignmentDetailScreen
import id.starstask.mobile.data.Assignment
import id.starstask.mobile.data.ClassCourse
import id.starstask.mobile.ui.components.WebAlert
import id.starstask.mobile.ui.theme.mockColors
import id.starstask.mobile.ui.theme.mockPageBrush

@Composable
fun ClassDetailScreenGlossy(
    clazz: ClassDetail,
    members: List<String>,
    userId: String,
    onBack: () -> Unit,
    onOpenGrades: (String) -> Unit,
) {
    val palette = mockColors()
    var activeTab by remember { mutableStateOf("overview") }
    var overviewReload by remember { mutableIntStateOf(0) }
    var manageOpen by remember { mutableStateOf(false) }
    var postAssignmentOpen by remember { mutableStateOf(false) }
    var setScheduleOpen by remember { mutableStateOf(false) }
    var exportOpen by remember { mutableStateOf(false) }
    var leaveId by remember { mutableStateOf<String?>(null) }
    var attendanceDetailOpen by remember { mutableStateOf(false) }
    var attendanceSessionsOpen by remember { mutableStateOf(false) }
    var absenceRequestsOpen by remember { mutableStateOf(false) }
    var sessionDetailId by remember { mutableStateOf<String?>(null) }
    var reviewQueueOpen by remember { mutableStateOf(false) }
    var invitesOpen by remember { mutableStateOf(false) }
    var assignmentsReload by remember { mutableIntStateOf(0) }
    var assignmentDetail by remember { mutableStateOf<Assignment?>(null) }
    var selectedCourse by remember { mutableStateOf<ClassCourse?>(null) }

    if (manageOpen) {
        ClassManageGlossy(
            clazz = clazz,
            onBack = { manageOpen = false },
            onOpenGrades = onOpenGrades,
            onOpenInvites = { manageOpen = false; invitesOpen = true },
        )
        return
    }
    if (reviewQueueOpen) {
        ClassReviewQueueGlossy(
            classId = clazz.id,
            userId = userId,
            isAdmin = clazz.isAdmin,
            onBack = { reviewQueueOpen = false },
            onOpenAssignment = { id ->
                assignmentDetail = Assignment(id = id, title = "", status = "", deadline = null, className = null)
                reviewQueueOpen = false
            },
        )
        return
    }
    if (invitesOpen) {
        ClassInvitesGlossy(
            classId = clazz.id,
            className = clazz.name,
            onBack = { invitesOpen = false },
        )
        return
    }
    val openAssignment = assignmentDetail
    if (openAssignment != null) {
        AssignmentDetailScreen(
            userId = userId,
            assignment = openAssignment,
            onBack = { assignmentDetail = null },
        )
        return
    }
    val openCourse = selectedCourse
    if (openCourse != null) {
        id.starstask.mobile.ui.screens.CourseWorkspaceScreen(
            clazz = clazz,
            course = openCourse,
            onBack = { selectedCourse = null },
        )
        return
    }
    val currentLeaveId = leaveId
    if (currentLeaveId != null) {
        id.starstask.mobile.ui.screens.LeaveRequestDetailScreen(
            userId = userId,
            requestId = currentLeaveId,
            onBack = { leaveId = null },
            onEdit = {},
            onChanged = { overviewReload++ },
        )
        return
    }
    if (sessionDetailId != null) {
        ClassMeetingDetailGlossy(
            classId = clazz.id,
            sessionId = sessionDetailId!!,
            isAdmin = clazz.isAdmin,
            onBack = { sessionDetailId = null },
        )
        return
    }
    if (attendanceDetailOpen) {
        ClassAttendanceDetailGlossy(
            clazz = DirectoryClassToDetailSheet(clazz),
            onBack = {
                attendanceDetailOpen = false
                sessionDetailId = null
            },
            onOpenMeeting = { sessionDetailId = it },
        )
        return
    }
    if (attendanceSessionsOpen) {
        ClassManageSessionsGlossy(
            clazz = DirectoryClassToDetailSheet(clazz),
            onBack = {
                attendanceSessionsOpen = false
                sessionDetailId = null
            },
            onOpenMeeting = { sessionDetailId = it },
        )
        return
    }
    if (absenceRequestsOpen) {
        ClassAbsenceRequestsGlossy(
            classId = clazz.id,
            onBack = { absenceRequestsOpen = false },
            onOpenRequest = { leaveId = it },
        )
        return
    }

    val context = androidx.compose.ui.platform.LocalContext.current
    val overview = androidx.compose.runtime.produceState(
        initialValue = id.starstask.mobile.data.readDiskCache(
            context, userId, "classOverview.${clazz.id}",
            id.starstask.mobile.data.ClassOverviewData.serializer(),
        ),
        key1 = clazz.id,
        key2 = overviewReload,
    ) {
        try {
            val fresh = loadClassOverview(userId, clazz.id)
            value = fresh
            id.starstask.mobile.data.writeDiskCache(
                context, userId, "classOverview.${clazz.id}", fresh,
                id.starstask.mobile.data.ClassOverviewData.serializer(),
            )
        } catch (_: Exception) {
            // Keep zeroed default so the tab renders something.
        }
    }

    val overviewData = overview.value

    Box(modifier = Modifier.fillMaxSize().background(mockPageBrush())) {
        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(bottom = 32.dp, start = 0.dp, end = 0.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            item(key = "header") {
                ClassDetailGlossyHeader(
                    clazz = clazz,
                    onBack = onBack,
                    onManageClass = if (clazz.isAdmin) ({ manageOpen = true }) else null,
                    onPostAssignment = { postAssignmentOpen = true },
                    onInvites = if (clazz.isAdmin) ({ invitesOpen = true }) else null,
                )
            }
            item(key = "tabs") {
                Box(modifier = Modifier.padding(horizontal = 16.dp)) {
                    ClassTabStripGlossy(
                        items = listOf(
                            "Overview" to "overview",
                            "Courses" to "courses",
                            "Assignments" to "assignments",
                            "Members" to "members",
                            "Schedule" to "schedule",
                            "Attendance" to "attendance",
                            "Info" to "info",
                        ),
                        activeKey = activeTab,
                        onSelect = { activeTab = it },
                    )
                }
            }
            item(key = "body") {
                Box(modifier = Modifier.padding(horizontal = 16.dp)) {
                    when (activeTab) {
                        "overview" -> ClassOverviewGlossy(
                            overview = overviewData,
                            loading = overview.value == null,
                            isAdmin = clazz.isAdmin,
                            onCreateAssignment = { postAssignmentOpen = true },
                            onSetSchedule = { setScheduleOpen = true },
                            onExportReport = { exportOpen = true },
                            onManageMembers = { activeTab = "members" },
                            onManageClass = { manageOpen = true },
                            onOpenAssignments = { activeTab = "assignments" },
                        )
                        "courses" -> ClassCoursesTab(clazz = clazz, onOpenCourse = { selectedCourse = it })
                        "assignments" -> ClassAssignmentsGlossy(
                            classId = clazz.id,
                            reloadTick = assignmentsReload,
                            onOpenAssignment = { assignmentDetail = it },
                            onReviewQueue = { reviewQueueOpen = true },
                            isAdmin = clazz.isAdmin,
                        )
                        "members" -> ClassMembersGlossy(
                            clazz = id.starstask.mobile.data.DirectoryClass(
                                id = clazz.id,
                                name = clazz.name,
                                slug = clazz.slug,
                                classCode = clazz.classCode.ifBlank { null },
                                semester = clazz.semester,
                                academicYear = clazz.academicYear,
                                status = clazz.status,
                                subjectCount = 0,
                                memberCount = clazz.memberCount,
                                assignmentCount = 0,
                                isAdmin = clazz.isAdmin,
                            ),
                            currentUserId = userId,
                            onMembersChanged = { overviewReload++ },
                        )
                        "schedule" -> ClassScheduleGlossy(clazz = clazz, onCreateSession = { setScheduleOpen = true })
                        "attendance" -> ClassAbsenceGlossy(
                            clazz = clazz,
                            userId = userId,
                            isAdmin = clazz.isAdmin,
                            onOpenLeaveRequest = { id -> leaveId = id },
                            onOpenAttendanceDetail = { attendanceDetailOpen = true },
                            onOpenManageSessions = { attendanceSessionsOpen = true },
                            onOpenAbsenceRequests = { absenceRequestsOpen = true },
                            onOpenMeeting = { sessionDetailId = it },
                        )
                        "info" -> ClassInfoGlossy(clazz = clazz)
                        else -> {}
                    }
                }
            }
        }
    }

    if (postAssignmentOpen) {
        val scopeState by androidx.compose.runtime.produceState<id.starstask.mobile.data.WorkspaceScope?>(
            initialValue = null,
            key1 = userId,
        ) {
            try {
                value = id.starstask.mobile.data.getWorkspaceScope(userId)
            } catch (_: Exception) {
                value = null
            }
        }
        val activeScope = scopeState
        if (activeScope != null) {
            CreateAssignmentDialog(
                scope = activeScope,
                userId = userId,
                initialClassId = clazz.id,
                onDismiss = { postAssignmentOpen = false },
                onCreated = {
                    postAssignmentOpen = false
                    overviewReload++
                    assignmentsReload++
                },
            )
        }
    }

    if (setScheduleOpen) {
        ClassSetScheduleSheet(
            clazzId = clazz.id,
            onDismiss = { setScheduleOpen = false },
            onSaved = {
                setScheduleOpen = false
                activeTab = "schedule"
                overviewReload++
            },
        )
    }

    if (exportOpen) {
        // Roster for CSV must come from the same class; load it here so the
        // sheet can build CSV from real rows.
        val roster = androidx.compose.runtime.produceState<List<id.starstask.mobile.data.DirectoryMember>>(
            initialValue = emptyList(),
            key1 = clazz.id,
            key2 = exportOpen,
        ) {
            try {
                value = id.starstask.mobile.data.loadClassRoster(clazz.id)
            } catch (_: Exception) {
                value = emptyList()
            }
        }
        ClassExportSheet(
            clazz = DirectoryClassToDetailSheet(clazz),
            members = roster.value,
            onDismiss = { exportOpen = false },
        )
    }
}

private fun DirectoryClassToDetailSheet(clazz: ClassDetail): id.starstask.mobile.data.DirectoryClass =
    id.starstask.mobile.data.DirectoryClass(
        id = clazz.id,
        name = clazz.name,
        slug = clazz.slug,
        classCode = clazz.classCode.ifBlank { null },
        semester = clazz.semester,
        academicYear = clazz.academicYear,
        status = clazz.status,
        subjectCount = 0,
        memberCount = clazz.memberCount,
        assignmentCount = 0,
        isAdmin = clazz.isAdmin,
    )
