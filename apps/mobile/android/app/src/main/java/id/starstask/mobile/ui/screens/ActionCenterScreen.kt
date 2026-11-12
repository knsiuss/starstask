package id.starstask.mobile.ui.screens

import id.starstask.mobile.data.ActionCenter as ActionCenterData
import id.starstask.mobile.data.ActionAttendanceCourse
import id.starstask.mobile.data.ActionCenterRow
import id.starstask.mobile.data.Assignment
import id.starstask.mobile.data.ClassDetail
import id.starstask.mobile.data.ExportFormat
import id.starstask.mobile.data.WorkspaceClassOption
import id.starstask.mobile.data.WorkspaceRequest
import id.starstask.mobile.data.WorkspaceScope
import id.starstask.mobile.data.buildActionSummary
import id.starstask.mobile.data.countRevisionLeaveRequests
import id.starstask.mobile.data.downloadAttendanceExport
import id.starstask.mobile.data.formatLeaveDate
import id.starstask.mobile.data.getClassActionCenter
import id.starstask.mobile.data.getWorkspaceScope
import id.starstask.mobile.data.listClassMembersCount
import id.starstask.mobile.data.listClassSubjectsForAttendance
import id.starstask.mobile.data.listManagedLeaveRequests
import id.starstask.mobile.data.listManagedRequests
import id.starstask.mobile.data.shareFile
import id.starstask.mobile.ui.components.BadgeVariant
import id.starstask.mobile.ui.components.StarsTaskBadge
import id.starstask.mobile.ui.components.WebAlert
import id.starstask.mobile.ui.components.WebCard
import id.starstask.mobile.ui.components.WebEmptyState
import id.starstask.mobile.ui.components.WebInput
import id.starstask.mobile.ui.components.WebTabStrip
import id.starstask.mobile.ui.icons.Lucide
import id.starstask.mobile.ui.theme.Spacing
import id.starstask.mobile.ui.theme.mockColors
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExposedDropdownMenuAnchorType
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.ExposedDropdownMenuDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextFieldDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.launch

enum class RecentRequestKind { ASSIGNMENT, ABSENCE }

data class RecentRequestItem(
    val id: String,
    val rawId: String,
    val kind: RecentRequestKind,
    val studentName: String,
    val studentId: String,
    val type: String,
    val course: String,
    val className: String,
    val date: String?,
    val statusLabel: String,
    val statusVariant: BadgeVariant,
    val request: WorkspaceRequest? = null,
)

/** Build the ClassDetail the manage/reports screens expect from a workspace option. */
private suspend fun classDetailFor(option: WorkspaceClassOption): ClassDetail =
    ClassDetail(
        id = option.id,
        name = option.name,
        slug = option.slug,
        semester = option.semester ?: "",
        academicYear = option.academicYear ?: "",
        memberCount = listClassMembersCount(option.id),
        classCode = option.classCode ?: "",
        isAdmin = option.isAdmin,
        status = "active",
    )

@Composable
fun ActionCenterScreen(
    userId: String,
    onOpenAttendanceCourse: (subjectId: String, name: String, code: String?, className: String?) -> Unit = { _, _, _, _ -> },
) {
    var scope by remember { mutableStateOf<WorkspaceScope?>(null) }
    var managedRequests by remember { mutableStateOf(emptyList<WorkspaceRequest>()) }
    var center by remember { mutableStateOf<ActionCenterData?>(null) }
    var revisionLeaveCount by remember { mutableStateOf(0) }
    var loading by remember { mutableStateOf(true) }
    var error by remember { mutableStateOf<String?>(null) }
    var tab by remember { mutableStateOf("overview") }
    var assignmentsClassFilter by remember { mutableStateOf<String?>(null) }
    var attendanceClassFilter by remember { mutableStateOf<String?>(null) }
    var refreshTick by remember { mutableStateOf(0) }

    LaunchedEffect(userId, refreshTick) {
        error = null
        try {
            val loaded = getWorkspaceScope(userId)
            scope = loaded
            val reqs = listManagedRequests(loaded)
            managedRequests = reqs
            center = getClassActionCenter(loaded)
            revisionLeaveCount = countRevisionLeaveRequests(loaded.managedClassIds)
        } catch (_: Exception) {
            error = "Your action counts could not be loaded. Refresh the page to try again."
        }
        loading = false
    }

    // In-screen pushes (same pattern as LeaveRequestsScreen destination state).
    var manageClassId by remember { mutableStateOf<String?>(null) }
    var reportClassId by remember { mutableStateOf<String?>(null) }
    var leaveRequestId by remember { mutableStateOf<String?>(null) }
    var reviewTarget by remember { mutableStateOf<WorkspaceRequest?>(null) }
    var assignmentDetailTarget by remember { mutableStateOf<Assignment?>(null) }
    var detailClass by remember { mutableStateOf<ClassDetail?>(null) }
    var detailClassLoading by remember { mutableStateOf(false) }

    val manageOption = manageClassId?.let { id -> scope?.classes?.firstOrNull { it.id == id } }
    val reportOption = reportClassId?.let { id -> scope?.classes?.firstOrNull { it.id == id } }
    val pendingDetailOption = manageOption ?: reportOption
    LaunchedEffect(pendingDetailOption?.id) {
        val opt = pendingDetailOption
        if (opt != null) {
            detailClassLoading = true
            detailClass = try {
                classDetailFor(opt)
            } catch (_: Exception) {
                ClassDetail(opt.id, opt.name, opt.slug, opt.semester ?: "", opt.academicYear ?: "", 0, opt.classCode ?: "", isAdmin = opt.isAdmin)
            }
            detailClassLoading = false
        } else {
            detailClass = null
            detailClassLoading = false
        }
    }

    reviewTarget?.let { target ->
        ReviewRequestDialog(
            request = target,
            onDismiss = { reviewTarget = null },
            onReviewed = {
                reviewTarget = null
                refreshTick++
            },
        )
    }
    assignmentDetailTarget?.let { target ->
        AssignmentDetailScreen(userId = userId, assignment = target, onBack = { assignmentDetailTarget = null })
        return
    }
    pendingDetailOption?.let { opt ->
        val detail = detailClass
        if (detailClassLoading) {
            CircularProgressIndicator(color = mockColors().accent)
        } else if (detail != null) {
            if (manageClassId != null) {
                ClassManageScreen(clazz = detail, onBack = { manageClassId = null }, onOpenGrades = {})
            } else {
                ClassReportsScreen(clazz = detail, onBack = { reportClassId = null })
            }
            return
        }
    }
    leaveRequestId?.let { id ->
        LeaveRequestDetailScreen(
            userId = userId,
            requestId = id,
            onBack = { leaveRequestId = null },
            onEdit = {},
            onChanged = { refreshTick++ },
        )
        return
    }

    fun navigate(target: String, classId: String? = null) {
        when (target) {
            "assignments" -> if (classId != null) assignmentsClassFilter = classId
            "attendance" -> if (classId != null) attendanceClassFilter = classId
        }
        tab = target
    }

    val sc = scope
    Column(modifier = Modifier.fillMaxSize().padding(horizontal = Spacing.Section, vertical = Spacing.Section)) {
        Text(
            "CLASS LEADER",
            color = mockColors().muted,
            style = MaterialTheme.typography.labelSmall.copy(fontWeight = FontWeight.Medium, letterSpacing = androidx.compose.ui.unit.TextUnit(0.08f, androidx.compose.ui.unit.TextUnitType.Em)),
            modifier = Modifier.padding(bottom = 2.dp),
        )
        Text("Action center", style = MaterialTheme.typography.headlineMedium, color = mockColors().ink, modifier = Modifier.padding(bottom = 2.dp))
        val summaryText = center?.let { buildActionSummary(it.totals) + " Today's sessions are counted in your local time." }
            ?: "Everything waiting on you across the classes you lead. Today's sessions are counted in your local time."
        Text(summaryText, color = mockColors().muted, style = MaterialTheme.typography.bodySmall, modifier = Modifier.padding(bottom = Spacing.Md))

        when {
            loading -> CircularProgressIndicator(color = mockColors().accent)
            error != null -> WebAlert(message = error!!)
            sc == null || sc!!.managedClassIds.isEmpty() -> WebEmptyState(
                title = "No classes to lead yet",
                description = "This page collects review queues for class leaders. Once you administer an active class, its pending work appears here.",
            )
            else -> {
                val pendingAssignments = center?.totals?.pendingSubmissions ?: managedRequests.count { it.displayStatus.name == "PENDING" }
                val pendingAbsences = center?.totals?.pendingLeave ?: 0
                val tabs = listOf(
                    "Overview" to "overview",
                    (if (pendingAssignments > 0) "Assignment Requests ($pendingAssignments)" else "Assignment Requests") to "assignments",
                    (if (pendingAbsences > 0) "Absence Requests ($pendingAbsences)" else "Absence Requests") to "absences",
                    "Attendance" to "attendance",
                )
                WebTabStrip(items = tabs, activeKey = tab, onSelect = { tab = it }, modifier = Modifier.padding(bottom = Spacing.Section))
                when (tab) {
                    "overview" -> ActionOverviewTab(
                        center = center,
                        scope = sc!!,
                        managedRequests = managedRequests,
                        revisionLeaveCount = revisionLeaveCount,
                        onNavigate = { target, classId -> navigate(target, classId) },
                        onReview = { reviewTarget = it },
                        onViewAssignment = { req ->
                            assignmentDetailTarget = Assignment(
                                id = req.id,
                                title = req.title,
                                status = req.status,
                                deadline = null,
                                className = req.className,
                            )
                        },
                        onOpenLeaveDetail = { leaveRequestId = it },
                        onManageClass = { manageClassId = it },
                        onOpenReports = { reportClassId = it },
                    )
                    "assignments" -> ActionAssignmentsTab(
                        scope = sc!!,
                        requests = managedRequests,
                        initialClassFilter = assignmentsClassFilter,
                        onReview = { reviewTarget = it },
                        onOpenDetail = { assignmentDetailTarget = it },
                    )
                    "absences" -> ActionAbsencesTab(scope = sc!!, onOpenLeaveDetail = { leaveRequestId = it })
                    "attendance" -> ActionAttendanceTab(
                        scope = sc!!,
                        center = center,
                        initialClassId = attendanceClassFilter,
                        onOpenAttendanceCourse = onOpenAttendanceCourse,
                    )
                }
            }
        }
    }
}

@Composable
private fun ActionOverviewTab(
    center: ActionCenterData?,
    scope: WorkspaceScope,
    managedRequests: List<WorkspaceRequest>,
    revisionLeaveCount: Int,
    onNavigate: (String, String?) -> Unit,
    onReview: (WorkspaceRequest) -> Unit,
    onViewAssignment: (WorkspaceRequest) -> Unit,
    onOpenLeaveDetail: (String) -> Unit,
    onManageClass: (String) -> Unit,
    onOpenReports: (String) -> Unit,
) {
    val managedOptions = scope.classes.filter { it.isAdmin }
    var selectedClassId by remember(managedOptions) { mutableStateOf(managedOptions.firstOrNull()?.id) }
    var membersCount by remember(selectedClassId) { mutableStateOf(0) }
    var recordedSessions by remember(selectedClassId) { mutableStateOf(0) }
    LaunchedEffect(selectedClassId) {
        val id = selectedClassId
        if (id != null) {
            membersCount = listClassMembersCount(id)
            recordedSessions = listClassSubjectsForAttendance(id).flatMap { it.meetings }.size
        }
    }
    val selected = managedOptions.firstOrNull { it.id == selectedClassId } ?: managedOptions.firstOrNull()
    val c = center
    val pendingAssignments = c?.totals?.pendingSubmissions ?: managedRequests.count { it.displayStatus.name == "PENDING" }
    val pendingAbsences = c?.totals?.pendingLeave ?: 0
    val revisionAssignments = managedRequests.count { it.displayStatus.name == "REVISION_REQUESTED" }
    val revisionTotal = revisionLeaveCount + revisionAssignments
    val totalPending = pendingAssignments + pendingAbsences

    // Recent items merged from both queues (mirrors web buildRecentItems).
    var recentAbsences by remember(scope) { mutableStateOf(emptyList<id.starstask.mobile.data.ManagedLeaveRequest>()) }
    LaunchedEffect(scope) {
        recentAbsences = listManagedLeaveRequests(scope, page = 1, pageSize = 20)
    }
    val recent = buildRecentItems(managedRequests, recentAbsences)
    fun onRecentClick(item: RecentRequestItem) {
        when (item.kind) {
            RecentRequestKind.ASSIGNMENT -> item.request?.let { req ->
                if (req.displayStatus.name == "PENDING") onReview(req) else onViewAssignment(req)
            }
            RecentRequestKind.ABSENCE -> onOpenLeaveDetail(item.rawId)
        }
    }

    Column(modifier = Modifier.fillMaxSize().padding(bottom = 104.dp).verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(Spacing.Section)) {
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(Spacing.Lg)) {
            OverviewStatCard("Pending Requests", totalPending, Lucide.ListChecks, modifier = Modifier.weight(1f), onClick = { onNavigate("assignments", null) })
            OverviewStatCard("Assignment Requests", pendingAssignments, Lucide.ClipboardCheck, modifier = Modifier.weight(1f), onClick = { onNavigate("assignments", null) })
        }
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(Spacing.Lg)) {
            OverviewStatCard("Absence Requests", pendingAbsences, Lucide.ClipboardList, modifier = Modifier.weight(1f), onClick = { onNavigate("absences", null) })
            OverviewStatCard("Requires Revision", revisionTotal, Lucide.FileWarning, modifier = Modifier.weight(1f), onClick = { onNavigate("assignments", null) })
        }

        WebCard(modifier = Modifier.fillMaxWidth()) {
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                Column {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Spacing.Sm)) {
                        Icon(Lucide.Clock3, contentDescription = null, tint = mockColors().ink, modifier = Modifier.size(Spacing.Section))
                        Text("Recent requests", style = MaterialTheme.typography.titleMedium, color = mockColors().ink)
                    }
                    Text("Latest requests that need your attention.", color = mockColors().muted, style = MaterialTheme.typography.bodySmall)
                }
                Row(
                    modifier = Modifier.clickable { onNavigate("assignments", null) }.padding(start = Spacing.Md),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(Spacing.Xs),
                ) {
                    Text("View all requests", color = mockColors().accent, style = MaterialTheme.typography.labelMedium)
                    Icon(Lucide.ArrowRight, contentDescription = null, tint = mockColors().accent, modifier = Modifier.size(Spacing.Xl))
                }
            }
            if (recent.isEmpty()) {
                Text("No recent requests. New submissions appear here as they arrive.", color = mockColors().muted, style = MaterialTheme.typography.bodySmall, modifier = Modifier.padding(top = Spacing.Md))
            } else {
                recent.forEach { item ->
                    Row(modifier = Modifier.fillMaxWidth().padding(vertical = Spacing.Md).clickable { onRecentClick(item) }, verticalAlignment = Alignment.CenterVertically) {
                        Box(
                            modifier = Modifier.size(36.dp).background(mockColors().accentSofter, CircleShape),
                            contentAlignment = Alignment.Center,
                        ) {
                            Text(item.studentName.firstOrNull()?.uppercase() ?: "?", color = mockColors().accent, style = MaterialTheme.typography.labelMedium)
                        }
                        Column(modifier = Modifier.weight(1f).padding(horizontal = Spacing.Md)) {
                            Row(horizontalArrangement = Arrangement.spacedBy(Spacing.Sm)) {
                                Text(item.studentName, style = MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight.SemiBold), color = mockColors().ink, maxLines = 1)
                                Text(item.studentId, color = mockColors().muted, style = MaterialTheme.typography.labelSmall, maxLines = 1)
                            }
                            Text("${item.type} · ${item.course} · ${item.className}", color = mockColors().muted, style = MaterialTheme.typography.bodySmall, maxLines = 2)
                            if (item.date != null) Text(formatLeaveDate(item.date.take(10)), color = mockColors().muted, style = MaterialTheme.typography.bodySmall)
                        }
                        StarsTaskBadge(item.statusLabel, item.statusVariant)
                        Icon(Lucide.ArrowRight, contentDescription = null, tint = mockColors().muted, modifier = Modifier.padding(start = Spacing.Sm).size(Spacing.Section))
                    }
                }
            }
        }

        WebCard(modifier = Modifier.fillMaxWidth()) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Spacing.Sm)) {
                Icon(Lucide.Users, contentDescription = null, tint = mockColors().ink, modifier = Modifier.size(Spacing.Section))
                Text("Your classes", style = MaterialTheme.typography.titleMedium, color = mockColors().ink)
            }
            if (selected != null) {
                ActionClassDropdown(
                    options = managedOptions.map { it.id to (it.classCode ?: it.name) },
                    selected = selected.id,
                    onSelect = { selectedClassId = it },
                    modifier = Modifier.padding(top = Spacing.Md),
                )
                val sidebarRow = c?.rows?.firstOrNull { it.classId == selected.id }
                val pendingForClass = (sidebarRow?.counts?.pendingSubmissions ?: 0) + (sidebarRow?.counts?.pendingLeave ?: 0)
                LabelValueRow(icon = Lucide.Users, label = "Total students", value = membersCount.toString())
                LabelValueRow(icon = Lucide.Clock3, label = "Pending requests", value = pendingForClass.toString(), onClick = { onNavigate("assignments", selected.id) })
                LabelValueRow(icon = Lucide.CalendarClock, label = "Attendance sessions", value = recordedSessions.toString(), onClick = { onNavigate("attendance", selected.id) })
            }
        }

        WebCard(modifier = Modifier.fillMaxWidth()) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Spacing.Sm)) {
                Icon(Lucide.Zap, contentDescription = null, tint = mockColors().ink, modifier = Modifier.size(Spacing.Section))
                Text("Quick actions", style = MaterialTheme.typography.titleMedium, color = mockColors().ink)
            }
            QuickActionRow(icon = Lucide.FileCheck2, label = "Review assignment requests") { onNavigate("assignments", null) }
            QuickActionRow(icon = Lucide.ClipboardList, label = "Review absence requests") { onNavigate("absences", null) }
            QuickActionRow(icon = Lucide.CalendarClock, label = "Open attendance management") { onNavigate("attendance", null) }
        }

        if (c != null && c.totals.actions == 0) {
            WebEmptyState(title = "All caught up", description = "No submissions, absence requests, sessions, or reader reports need you right now. New work appears here as it arrives.")
        }

        c?.rows?.forEach { row ->
            ClassActionsCard(
                row = row,
                onManageClass = onManageClass,
                onOpenReports = onOpenReports,
                onNavigate = onNavigate,
            )
        }
    }
}

private fun buildRecentItems(
    assignments: List<WorkspaceRequest>,
    absences: List<id.starstask.mobile.data.ManagedLeaveRequest>,
): List<RecentRequestItem> {
    val assignmentItems = assignments.map { req ->
        val (label, variant) = when (req.displayStatus) {
            id.starstask.mobile.data.RequestDisplayStatus.PENDING -> "Pending" to BadgeVariant.ACCENT
            id.starstask.mobile.data.RequestDisplayStatus.APPROVED -> "Approved" to BadgeVariant.SUCCESS
            id.starstask.mobile.data.RequestDisplayStatus.REJECTED -> "Rejected" to BadgeVariant.DANGER
            id.starstask.mobile.data.RequestDisplayStatus.REVISION_REQUESTED -> "Revision" to BadgeVariant.WARNING
        }
        RecentRequestItem(
            id = "assignment-${req.id}",
            rawId = req.id,
            kind = RecentRequestKind.ASSIGNMENT,
            studentName = req.submitterName ?: "Student",
            studentId = req.id.take(8),
            type = "Assignment Request",
            course = req.courseName,
            className = req.className,
            date = req.createdAt,
            statusLabel = label,
            statusVariant = variant,
            request = req,
        )
    }
    val absenceItems = absences.map { req ->
        val variant = when (req.status) {
            "submitted" -> BadgeVariant.ACCENT
            "approved", "forwarded" -> BadgeVariant.SUCCESS
            "rejected" -> BadgeVariant.DANGER
            "revision_requested" -> BadgeVariant.WARNING
            else -> BadgeVariant.NEUTRAL
        }
        val label = id.starstask.mobile.data.leaveStatusLabel(req.status)
        val course = if (req.subjectIds.isEmpty()) "Whole class" else "${req.subjectIds.size} ${if (req.subjectIds.size == 1) "course" else "courses"}"
        RecentRequestItem(
            id = "absence-${req.id}",
            rawId = req.id,
            kind = RecentRequestKind.ABSENCE,
            studentName = req.studentName,
            studentId = req.studentId.take(8).ifEmpty { req.id.take(8) },
            type = "Absence Request",
            course = course,
            className = req.className,
            date = req.submittedAt ?: req.createdAt,
            statusLabel = label,
            statusVariant = variant,
        )
    }
    return (assignmentItems + absenceItems).sortedWith(compareByDescending<RecentRequestItem> { it.date ?: "" }).take(10)
}

@Composable
private fun OverviewStatCard(label: String, value: Int, icon: ImageVector, modifier: Modifier = Modifier, onClick: (() -> Unit)? = null) {
    val content: @Composable () -> Unit = {
        WebCard(modifier = Modifier.fillMaxWidth()) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Spacing.Sm)) {
                Icon(icon, contentDescription = null, tint = mockColors().muted, modifier = Modifier.size(Spacing.Xl))
                Text(label, color = mockColors().muted, style = MaterialTheme.typography.bodySmall, maxLines = 1)
            }
            Text(value.toString(), style = MaterialTheme.typography.headlineSmall, color = mockColors().ink, modifier = Modifier.padding(top = Spacing.Xs))
        }
    }
    if (onClick != null) {
        Box(modifier = modifier.clickable { onClick() }) { content() }
    } else {
        Box(modifier = modifier) { content() }
    }
}

@Composable
private fun LabelValueRow(icon: ImageVector, label: String, value: String, onClick: (() -> Unit)? = null) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(top = Spacing.Sm).let { if (onClick != null) it.clickable { onClick() } else it },
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Spacing.Sm)) {
            Icon(icon, contentDescription = null, tint = mockColors().muted, modifier = Modifier.size(Spacing.Xl))
            Text(label, color = mockColors().muted, style = MaterialTheme.typography.bodySmall)
        }
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(value, style = MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight.SemiBold), color = mockColors().ink)
            if (onClick != null) {
                Icon(Lucide.ArrowRight, contentDescription = null, tint = mockColors().muted, modifier = Modifier.padding(start = Spacing.Sm).size(Spacing.Section))
            }
        }
    }
}

@Composable
private fun QuickActionRow(icon: ImageVector, label: String, onClick: () -> Unit) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(top = Spacing.Sm).border(1.dp, mockColors().cardBorder, RoundedCornerShape(12.dp)).clickable { onClick() }.padding(horizontal = Spacing.Xl, vertical = Spacing.Md),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Spacing.Md),
    ) {
        Icon(icon, contentDescription = null, tint = mockColors().muted, modifier = Modifier.size(Spacing.Section))
        Text(label, style = MaterialTheme.typography.bodyMedium, color = mockColors().ink)
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun ActionClassDropdown(
    options: List<Pair<String, String>>,
    selected: String,
    onSelect: (String) -> Unit,
    modifier: Modifier = Modifier,
) {
    var expanded by remember { mutableStateOf(false) }
    val selectedLabel = options.firstOrNull { it.first == selected }?.second ?: ""
    ExposedDropdownMenuBox(expanded = expanded, onExpandedChange = { expanded = !expanded }, modifier = modifier.fillMaxWidth()) {
        OutlinedTextField(
            value = selectedLabel,
            onValueChange = {},
            readOnly = true,
            trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded) },
            modifier = Modifier.fillMaxWidth().menuAnchor(ExposedDropdownMenuAnchorType.PrimaryNotEditable, true),
            shape = RoundedCornerShape(8.dp),
            colors = TextFieldDefaults.colors(unfocusedIndicatorColor = id.starstask.mobile.ui.theme.Input),
            textStyle = MaterialTheme.typography.bodyMedium,
        )
        ExposedDropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }) {
            options.forEach { (id, label) ->
                DropdownMenuItem(text = { Text(label) }, onClick = { onSelect(id); expanded = false })
            }
        }
    }
}

@Composable
private fun ClassActionsCard(
    row: ActionCenterRow,
    onManageClass: (String) -> Unit,
    onOpenReports: (String) -> Unit,
    onNavigate: (String, String?) -> Unit,
) {
    WebCard(modifier = Modifier.fillMaxWidth()) {
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
            Column(modifier = Modifier.weight(1f)) {
                Text(row.className, style = MaterialTheme.typography.titleMedium, color = mockColors().ink, maxLines = 1)
                val sem = row.semester
                val year = row.academicYear
                val sub = when {
                    sem.isNotBlank() && year.isNotBlank() -> "$sem · $year"
                    sem.isNotBlank() -> sem
                    year.isNotBlank() -> year
                    else -> ""
                }
                if (sub.isNotBlank()) Text(sub, color = mockColors().muted, style = MaterialTheme.typography.bodySmall)
            }
            Box(
                modifier = Modifier.background(if (row.total > 0) mockColors().fairBg else mockColors().chip, RoundedCornerShape(999.dp)).padding(horizontal = Spacing.Md, vertical = Spacing.Xxs),
            ) {
                Text("${row.total} ${if (row.total == 1) "action" else "actions"}", color = if (row.total > 0) mockColors().fairFg else mockColors().muted, style = MaterialTheme.typography.labelSmall)
            }
        }
        val metrics = listOf(
            Triple(Lucide.ClipboardCheck, "Submissions to review", row.counts.pendingSubmissions) to "assignments",
            Triple(Lucide.ClipboardList, "Absence requests", row.counts.pendingLeave) to "absences",
            Triple(Lucide.CalendarClock, "Sessions today", row.counts.todaysSessions) to "attendance",
        )
        metrics.chunked(2).forEach { pair ->
            Row(modifier = Modifier.fillMaxWidth().padding(top = Spacing.Md), horizontalArrangement = Arrangement.spacedBy(Spacing.Md)) {
                pair.forEach { (triple, targetTab) ->
                    val (icon, label, value) = triple
                    Row(
                        modifier = Modifier.weight(1f)
                            .border(1.dp, mockColors().cardBorder, RoundedCornerShape(12.dp))
                            .clickable { onNavigate(targetTab, row.classId) }
                            .padding(horizontal = Spacing.Md, vertical = Spacing.Md),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Icon(icon, contentDescription = null, tint = mockColors().muted, modifier = Modifier.size(Spacing.Section))
                        Text(label, color = mockColors().muted, style = MaterialTheme.typography.bodySmall, modifier = Modifier.weight(1f).padding(horizontal = Spacing.Sm), maxLines = 1)
                        Text(value.toString(), style = MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight.SemiBold), color = if (value > 0) mockColors().ink else mockColors().muted)
                    }
                }
            }
        }
        Row(
            modifier = Modifier.fillMaxWidth().padding(top = Spacing.Md)
                .border(1.dp, mockColors().cardBorder, RoundedCornerShape(12.dp))
                .clickable { onOpenReports(row.classId) }
                .padding(horizontal = Spacing.Md, vertical = Spacing.Md),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Icon(Lucide.FileWarning, contentDescription = null, tint = mockColors().muted, modifier = Modifier.size(Spacing.Section))
            Text("Open reader reports", color = mockColors().muted, style = MaterialTheme.typography.bodySmall, modifier = Modifier.weight(1f).padding(horizontal = Spacing.Sm), maxLines = 1)
            Text(row.counts.openReports.toString(), style = MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight.SemiBold), color = if (row.counts.openReports > 0) mockColors().ink else mockColors().muted)
        }
        Row(modifier = Modifier.padding(top = Spacing.Md).clickable { onManageClass(row.classId) }, verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Spacing.Xs)) {
            Text("Manage this class", color = mockColors().accent, style = MaterialTheme.typography.bodySmall)
            Icon(Lucide.ArrowRight, contentDescription = null, tint = mockColors().accent, modifier = Modifier.size(Spacing.Xl))
        }
    }
}

@Composable
private fun ActionAssignmentsTab(
    scope: WorkspaceScope,
    requests: List<WorkspaceRequest>,
    initialClassFilter: String?,
    onReview: (WorkspaceRequest) -> Unit,
    onOpenDetail: (Assignment) -> Unit,
) {
    var query by remember { mutableStateOf("") }
    var classFilter by remember(initialClassFilter) { mutableStateOf<String?>(initialClassFilter) }
    var courseFilter by remember { mutableStateOf<String?>(null) }
    var statusFilter by remember { mutableStateOf("all") }
    val classes = scope.classes.filter { it.isAdmin }
    val courses = classFilter?.let { cid -> scope.classes.firstOrNull { it.id == cid }?.subjects ?: emptyList() } ?: emptyList()
    val filtered = requests.filter { req ->
        if (classFilter != null && req.classId != classFilter) return@filter false
        if (courseFilter != null && req.subjectId != courseFilter) return@filter false
        if (statusFilter != "all") {
            val statusKey = when (req.displayStatus) {
                id.starstask.mobile.data.RequestDisplayStatus.PENDING -> "pending"
                id.starstask.mobile.data.RequestDisplayStatus.APPROVED -> "approved"
                id.starstask.mobile.data.RequestDisplayStatus.REJECTED -> "rejected"
                id.starstask.mobile.data.RequestDisplayStatus.REVISION_REQUESTED -> "revision_requested"
            }
            if (statusKey != statusFilter) return@filter false
        }
        if (query.isNotBlank()) {
            val q = query.trim().lowercase()
            if (!req.title.lowercase().contains(q) && !(req.submitterName?.lowercase()?.contains(q) == true)) return@filter false
        }
        true
    }
    val pending = filtered.filter { it.displayStatus.name == "PENDING" }
    val decided = filtered.filter { it.displayStatus.name != "PENDING" }

    Column(modifier = Modifier.fillMaxSize().padding(bottom = 104.dp).verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(Spacing.Section)) {
        WebCard(modifier = Modifier.fillMaxWidth()) {
            Text("Search", style = MaterialTheme.typography.labelMedium, color = mockColors().ink)
            WebInput(value = query, onValueChange = { query = it }, label = "Student or title…", modifier = Modifier.padding(top = Spacing.Xs))
            Row(modifier = Modifier.fillMaxWidth().padding(top = Spacing.Md), horizontalArrangement = Arrangement.spacedBy(Spacing.Md)) {
                Column(modifier = Modifier.weight(1f)) {
                    Text("Class", style = MaterialTheme.typography.labelMedium, color = mockColors().ink)
                    FilterDropdown(
                        options = listOf("all" to "All classes") + classes.map { it.id to (it.classCode ?: it.name) },
                        selected = classFilter ?: "all",
                        onSelect = { classFilter = if (it == "all") null else it; courseFilter = null },
                    )
                }
                Column(modifier = Modifier.weight(1f)) {
                    Text("Course", style = MaterialTheme.typography.labelMedium, color = mockColors().ink)
                    FilterDropdown(
                        options = listOf("all" to "All courses") + courses.map { it.id to (it.code ?: it.name) },
                        selected = courseFilter ?: "all",
                        onSelect = { courseFilter = if (it == "all") null else it },
                        enabled = courses.isNotEmpty(),
                    )
                }
            }
            Text("Status", style = MaterialTheme.typography.labelMedium, color = mockColors().ink, modifier = Modifier.padding(top = Spacing.Md))
            FilterDropdown(
                options = listOf("all" to "All statuses", "pending" to "Pending", "approved" to "Approved", "rejected" to "Rejected", "revision_requested" to "Revision Requested"),
                selected = statusFilter,
                onSelect = { statusFilter = it },
            )
        }

        Text("Waiting for review (${pending.size})", style = MaterialTheme.typography.titleMedium, color = mockColors().ink)
        if (pending.isEmpty()) {
            Text("No publication requests are waiting for review.", color = mockColors().muted, style = MaterialTheme.typography.bodySmall)
        } else {
            pending.forEach { req ->
                WebCard(modifier = Modifier.fillMaxWidth()) {
                    Row(horizontalArrangement = Arrangement.spacedBy(Spacing.Sm), verticalAlignment = Alignment.CenterVertically) {
                        StarsTaskBadge("Pending", BadgeVariant.WARNING)
                        Text("${req.classCode ?: req.className} · ${req.courseName}", color = mockColors().muted, style = MaterialTheme.typography.bodySmall, maxLines = 1)
                    }
                    Text("by ${req.submitterName ?: "Student"}", color = mockColors().muted, style = MaterialTheme.typography.bodySmall, modifier = Modifier.padding(top = Spacing.Xs))
                    Text(req.title, style = MaterialTheme.typography.titleMedium, color = mockColors().ink, modifier = Modifier.padding(top = Spacing.Sm))
                    Text("${req.classCode ?: req.className}  ·  Proposed ${formatLeaveDate(req.createdAt.take(10))} · Submitted ${formatLeaveDate(req.createdAt.take(10))}", color = mockColors().muted, style = MaterialTheme.typography.bodySmall)
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(top = Spacing.Sm)
                            .border(1.dp, mockColors().cardBorder, RoundedCornerShape(12.dp))
                            .clickable { onReview(req) }
                            .padding(horizontal = Spacing.Xl, vertical = Spacing.Md),
                        horizontalArrangement = Arrangement.spacedBy(Spacing.Md),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Icon(Lucide.FileCheck2, contentDescription = null, tint = mockColors().muted, modifier = Modifier.size(Spacing.Section))
                        Text("Review request", style = MaterialTheme.typography.bodyMedium, color = mockColors().ink)
                    }
                }
            }
        }

        if (decided.isNotEmpty()) {
            Text("Recently decided", style = MaterialTheme.typography.titleMedium, color = mockColors().ink)
            decided.forEach { req ->
                val (label, variant) = when (req.displayStatus) {
                    id.starstask.mobile.data.RequestDisplayStatus.APPROVED -> "Approved" to BadgeVariant.SUCCESS
                    id.starstask.mobile.data.RequestDisplayStatus.REJECTED -> "Rejected" to BadgeVariant.DANGER
                    id.starstask.mobile.data.RequestDisplayStatus.REVISION_REQUESTED -> "Revision" to BadgeVariant.WARNING
                    else -> "Pending" to BadgeVariant.ACCENT
                }
                WebCard(modifier = Modifier.fillMaxWidth().clickable { onOpenDetail(Assignment(id = req.id, title = req.title, status = req.status, deadline = req.deadline, className = req.className)) }) {
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Spacing.Sm)) {
                            StarsTaskBadge(label, variant)
                            Text("${req.classCode ?: ""} · ${req.courseName}", color = mockColors().muted, style = MaterialTheme.typography.bodySmall)
                        }
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Text("View", color = mockColors().accent, style = MaterialTheme.typography.bodySmall)
                            Icon(Lucide.ArrowRight, contentDescription = null, tint = mockColors().accent, modifier = Modifier.size(Spacing.Xl))
                        }
                    }
                    Text("by ${req.submitterName ?: "Student"}", color = mockColors().muted, style = MaterialTheme.typography.bodySmall, modifier = Modifier.padding(top = Spacing.Xs))
                    Text(req.title, style = MaterialTheme.typography.titleMedium, color = mockColors().ink, modifier = Modifier.padding(top = Spacing.Sm))
                    Text("${req.classCode ?: req.className}  ·  Proposed ${formatLeaveDate(req.createdAt.take(10))} · Submitted ${formatLeaveDate(req.createdAt.take(10))}", color = mockColors().muted, style = MaterialTheme.typography.bodySmall)
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun FilterDropdown(
    options: List<Pair<String, String>>,
    selected: String,
    onSelect: (String) -> Unit,
    enabled: Boolean = true,
) {
    var expanded by remember { mutableStateOf(false) }
    val label = options.firstOrNull { it.first == selected }?.second ?: ""
    ExposedDropdownMenuBox(expanded = expanded && enabled, onExpandedChange = { if (enabled) expanded = !expanded }) {
        OutlinedTextField(
            value = label,
            onValueChange = {},
            readOnly = true,
            enabled = enabled,
            trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded) },
            modifier = Modifier.fillMaxWidth().menuAnchor(ExposedDropdownMenuAnchorType.PrimaryNotEditable, true).padding(top = Spacing.Xs),
            shape = RoundedCornerShape(8.dp),
            colors = TextFieldDefaults.colors(unfocusedIndicatorColor = id.starstask.mobile.ui.theme.Input),
            textStyle = MaterialTheme.typography.bodySmall,
        )
        ExposedDropdownMenu(expanded = expanded && enabled, onDismissRequest = { expanded = false }) {
            options.forEach { (id, text) ->
                DropdownMenuItem(text = { Text(text) }, onClick = { onSelect(id); expanded = false })
            }
        }
    }
}

@Composable
private fun ActionAbsencesTab(scope: WorkspaceScope, onOpenLeaveDetail: (String) -> Unit) {
    var items by remember { mutableStateOf(emptyList<id.starstask.mobile.data.ManagedLeaveRequest>()) }
    var loading by remember { mutableStateOf(true) }
    LaunchedEffect(scope) {
        items = listManagedLeaveRequests(scope, page = 1, pageSize = 50)
        loading = false
    }
    Column(modifier = Modifier.fillMaxSize().padding(bottom = 104.dp).verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(Spacing.Section)) {
        if (loading) CircularProgressIndicator(color = mockColors().accent)
        else if (items.isEmpty()) {
            WebEmptyState(title = "No absence requests", description = "New requests appear here as students submit them.")
        } else {
            items.forEach { req ->
                val variant = when (req.status) {
                    "submitted" -> BadgeVariant.ACCENT
                    "approved", "forwarded" -> BadgeVariant.SUCCESS
                    "rejected" -> BadgeVariant.DANGER
                    "revision_requested" -> BadgeVariant.WARNING
                    else -> BadgeVariant.NEUTRAL
                }
                val label = id.starstask.mobile.data.leaveStatusLabel(req.status)
                val courseLabel = if (req.subjectIds.isEmpty()) "Whole class" else req.subjectNames.joinToString(", ").ifBlank { "${req.subjectIds.size} courses" }
                val reasonLabel = id.starstask.mobile.data.leaveReasonLabel(req.reasonCategory)
                val dayCount = id.starstask.mobile.data.leaveDayCount(req.leaveStartDate, req.leaveEndDate)
                val dateRange = req.leaveStartDate?.let { formatLeaveDate(it.take(10)) }?.let { s ->
                    val e = req.leaveEndDate?.take(10)
                    if (e != null && e != req.leaveStartDate?.take(10)) "$s–${formatLeaveDate(e)}" else s
                } ?: "—"
                WebCard(modifier = Modifier.fillMaxWidth().clickable { onOpenLeaveDetail(req.id) }) {
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                        StarsTaskBadge(label, variant)
                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Spacing.Xs)) {
                            Icon(Lucide.FileCheck2, contentDescription = null, tint = mockColors().muted, modifier = Modifier.size(Spacing.Xl))
                            Text("Submitted ${formatLeaveDate((req.submittedAt ?: req.createdAt).take(10))}", color = mockColors().muted, style = MaterialTheme.typography.bodySmall)
                        }
                    }
                    Text(req.reference.ifBlank { req.id.take(12).uppercase() }, color = mockColors().muted, style = MaterialTheme.typography.labelSmall, modifier = Modifier.padding(top = Spacing.Sm))
                    Text(req.studentName, style = MaterialTheme.typography.titleMedium, color = mockColors().ink, modifier = Modifier.padding(top = Spacing.Xxs))
                    Text("${req.className} · $reasonLabel", color = mockColors().muted, style = MaterialTheme.typography.bodySmall)
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Spacing.Xs), modifier = Modifier.padding(top = Spacing.Sm)) {
                        Icon(Lucide.CalendarDays, contentDescription = null, tint = mockColors().muted, modifier = Modifier.size(Spacing.Xl))
                        Text("$dateRange · $dayCount ${if (dayCount == 1) "day" else "days"}", color = mockColors().muted, style = MaterialTheme.typography.bodySmall)
                    }
                    Text(courseLabel, color = mockColors().muted, style = MaterialTheme.typography.bodySmall, modifier = Modifier.padding(top = Spacing.Xs))
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Spacing.Xs), modifier = Modifier.padding(top = Spacing.Xs)) {
                        Icon(Lucide.Paperclip, contentDescription = null, tint = mockColors().muted, modifier = Modifier.size(Spacing.Xl))
                        Text("${req.evidenceCount} ${if (req.evidenceCount == 1) "file" else "files"}", color = mockColors().muted, style = MaterialTheme.typography.bodySmall)
                    }
                }
            }
        }
    }
}

@Composable
private fun ActionAttendanceTab(
    scope: WorkspaceScope,
    center: ActionCenterData?,
    initialClassId: String?,
    onOpenAttendanceCourse: (subjectId: String, name: String, code: String?, className: String?) -> Unit,
) {
    val managedOptions = scope.classes.filter { it.isAdmin }
    var selectedClassId by remember(initialClassId, managedOptions) {
        mutableStateOf(initialClassId?.takeIf { id -> managedOptions.any { it.id == id } } ?: managedOptions.firstOrNull()?.id)
    }
    var courses by remember(selectedClassId) { mutableStateOf(emptyList<ActionAttendanceCourse>()) }
    var totalStudents by remember(selectedClassId) { mutableStateOf(0) }
    var loading by remember(selectedClassId) { mutableStateOf(true) }
    var exportError by remember { mutableStateOf<String?>(null) }
    var exportingCourseId by remember { mutableStateOf<String?>(null) }
    val context = LocalContext.current
    val coroutineScope = androidx.compose.runtime.rememberCoroutineScope()
    LaunchedEffect(selectedClassId) {
        val id = selectedClassId
        if (id != null) {
            courses = listClassSubjectsForAttendance(id)
            totalStudents = listClassMembersCount(id)
        }
        loading = false
    }
    val selected = managedOptions.firstOrNull { it.id == selectedClassId } ?: managedOptions.firstOrNull()
    val sidebarRow = selected?.let { sel -> center?.rows?.firstOrNull { it.classId == sel.id } }
    val pendingForClass = (sidebarRow?.counts?.pendingSubmissions ?: 0) + (sidebarRow?.counts?.pendingLeave ?: 0)
    val allMeetings = courses.flatMap { it.meetings }
    val latestActivity = allMeetings.maxByOrNull { it.startsAt }

    Column(modifier = Modifier.fillMaxSize().padding(bottom = 104.dp).verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(Spacing.Section)) {
        if (selected == null) {
            WebEmptyState(title = "No classes to show yet", description = "Administer an active class to see its attendance overview here.")
            return@Column
        }
        WebCard(modifier = Modifier.fillMaxWidth()) {
            Text("Class", style = MaterialTheme.typography.labelMedium, color = mockColors().ink)
            ActionClassDropdown(
                options = managedOptions.map { it.id to "${it.classCode ?: it.name} — Semester ${it.semester ?: ""} (${it.academicYear ?: ""})" },
                selected = selected.id,
                onSelect = { selectedClassId = it },
            )
        }
        if (loading) {
            CircularProgressIndicator(color = mockColors().accent)
        } else {
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(Spacing.Lg)) {
                OverviewStatCard("Total courses", courses.size, Lucide.BookOpen, modifier = Modifier.weight(1f))
                OverviewStatCard("Recorded sessions", allMeetings.size, Lucide.CalendarDays, modifier = Modifier.weight(1f))
            }
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(Spacing.Lg)) {
                OverviewStatCard("Total students", totalStudents, Lucide.Users, modifier = Modifier.weight(1f))
                OverviewStatCard("Pending requests", pendingForClass, Lucide.Clock3, modifier = Modifier.weight(1f))
            }
            Box(modifier = Modifier.fillMaxWidth().background(mockColors().chip, RoundedCornerShape(12.dp)).padding(horizontal = Spacing.Xl, vertical = Spacing.Md)) {
                val text = if (latestActivity != null) {
                    val phaseLabel = when (latestActivity.phase) {
                        "scheduled" -> "Scheduled"
                        "open" -> "In progress"
                        "closed" -> "Closed"
                        "finalized" -> "Completed"
                        else -> latestActivity.phase
                    }
                    "Latest attendance activity: Meeting ${latestActivity.meetingNumber} in ${latestActivity.subjectName} on ${formatLeaveDate(latestActivity.startsAt.take(10))}($phaseLabel)"
                } else {
                    "No attendance recorded for this class yet."
                }
                Text(text, color = mockColors().ink, style = MaterialTheme.typography.bodySmall)
            }
            if (exportError != null) WebAlert(message = exportError!!)
            if (courses.isEmpty()) {
                WebEmptyState(title = "No courses in this class", description = "Add a course from Manage Class before exporting attendance.")
            } else {
                courses.forEach { course ->
                    val latest = course.meetings.maxByOrNull { it.startsAt }
                    WebCard(modifier = Modifier.fillMaxWidth()) {
                        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                            Column(modifier = Modifier.weight(1f)) {
                                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Spacing.Sm)) {
                                    Text(course.name, style = MaterialTheme.typography.titleMedium, color = mockColors().ink, maxLines = 1)
                                    if (latest != null) {
                                        val (label, variant) = when (latest.phase) {
                                            "finalized" -> "Completed" to BadgeVariant.SUCCESS
                                            "open" -> "In progress" to BadgeVariant.ACCENT
                                            else -> when (latest.phase) {
                                                "closed" -> "Closed" to BadgeVariant.NEUTRAL
                                                else -> "Scheduled" to BadgeVariant.NEUTRAL
                                            }
                                        }
                                        StarsTaskBadge(label, variant)
                                    }
                                }
                                Text(course.code ?: "No code", color = mockColors().muted, style = MaterialTheme.typography.bodySmall)
                            }
                            Icon(Lucide.ArrowUpRight, contentDescription = null, tint = mockColors().muted, modifier = Modifier.size(Spacing.Section).clickable { onOpenAttendanceCourse(course.id, course.name, course.code, selected?.name) })
                        }
                        Row(modifier = Modifier.fillMaxWidth().padding(top = Spacing.Md), horizontalArrangement = Arrangement.spacedBy(Spacing.Md)) {
                            Column(modifier = Modifier.weight(1f)) {
                                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Spacing.Xs)) {
                                    Icon(Lucide.Users, contentDescription = null, tint = mockColors().muted, modifier = Modifier.size(Spacing.Xl))
                                    Text("Lecturer", color = mockColors().muted, style = MaterialTheme.typography.labelSmall)
                                }
                                Text(course.lecturerName ?: "Not set", style = MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight.Medium), color = mockColors().ink, modifier = Modifier.padding(top = Spacing.Xs))
                            }
                            Column(modifier = Modifier.weight(1f).padding(start = Spacing.Md)) {
                                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Spacing.Xs)) {
                                    Icon(Lucide.CalendarDays, contentDescription = null, tint = mockColors().muted, modifier = Modifier.size(Spacing.Xl))
                                    Text("Recorded", color = mockColors().muted, style = MaterialTheme.typography.labelSmall)
                                }
                                Text("${course.meetings.size} ${if (course.meetings.size == 1) "meeting" else "meetings"}", style = MaterialTheme.typography.bodyMedium.copy(fontWeight = FontWeight.Medium), color = mockColors().ink, modifier = Modifier.padding(top = Spacing.Xs))
                            }
                        }
                        Row(modifier = Modifier.fillMaxWidth().padding(top = Spacing.Md), horizontalArrangement = Arrangement.spacedBy(Spacing.Md)) {
                            if (exportingCourseId == course.id) {
                                CircularProgressIndicator(modifier = Modifier.size(Spacing.Section))
                                Text("Exporting…", style = MaterialTheme.typography.bodySmall, color = mockColors().muted)
                            } else {
                                QuickActionRow(icon = Lucide.BookOpen, label = "View attendance") {
                                    onOpenAttendanceCourse(course.id, course.name, course.code, selected?.name)
                                }
                                QuickActionRow(icon = Lucide.Download, label = "Export Attendance") {
                                    exportError = null
                                    exportingCourseId = course.id
                                    coroutineScope.launch {
                                        try {
                                            val result = downloadAttendanceExport(context, selected.slug, course.id, ExportFormat.Xlsx)
                                            shareFile(context, result.file, result.mimeType, "Attendance recap — ${course.name}")
                                        } catch (_: Exception) {
                                            exportError = "The export could not be completed."
                                        } finally {
                                            exportingCourseId = null
                                        }
                                    }
                                }
                            }
                        }
                        if (latest != null) {
                            Text("Latest Meeting ${latest.meetingNumber} on ${formatLeaveDate(latest.startsAt.take(10))}", color = mockColors().muted, style = MaterialTheme.typography.bodySmall, modifier = Modifier.padding(top = Spacing.Sm))
                        }
                    }
                }
            }
        }
    }
}
