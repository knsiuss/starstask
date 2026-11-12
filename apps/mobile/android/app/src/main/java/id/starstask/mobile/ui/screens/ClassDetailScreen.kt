package id.starstask.mobile.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
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
import id.starstask.mobile.ui.components.StaggerDots
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
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import id.starstask.mobile.data.ClassDetail
import id.starstask.mobile.data.ClassOverviewData
import id.starstask.mobile.data.ClassOverviewStats
import id.starstask.mobile.data.ExploreAssignment
import id.starstask.mobile.data.OverviewAssignmentItem
import id.starstask.mobile.data.OverviewPostItem
import id.starstask.mobile.data.getDeadlineState
import id.starstask.mobile.data.listAssignmentPage
import id.starstask.mobile.data.loadClassMembers
import id.starstask.mobile.data.loadClassOverview
import id.starstask.mobile.data.pluralize
import id.starstask.mobile.ui.icons.Lucide
import id.starstask.mobile.ui.theme.AssignmentAccent
import id.starstask.mobile.ui.theme.AssignmentBackground
import id.starstask.mobile.ui.theme.AssignmentForeground
import id.starstask.mobile.ui.theme.AssignmentSecondary
import id.starstask.mobile.ui.theme.AssignmentBorder
import id.starstask.mobile.ui.theme.SoftFill

// Class detail — Apple-clean like Assignments/Schedule/Profile.
// One LazyColumn on #F7F8FA, grouped white lists, plain ListItem rows.
// Every number is real (loadClassOverview / listAssignmentPage).

private val CLASS_TABS = listOf(
    "Overview" to "overview",
    "Courses" to "courses",
    "Assignments" to "assignments",
    "Members" to "members",
    "Schedule" to "schedule",
    "Attendance" to "attendance",
    "Class Info" to "info",
)

@Composable
fun ClassDetailScreen(
    clazz: ClassDetail,
    members: List<String>,
    userId: String = "",
    onBack: () -> Unit = {},
    onOpenGrades: (String) -> Unit = {},
    onOpenManage: (ClassDetail) -> Unit = {},
) {
    var activeTab by remember { mutableStateOf("overview") }
    var overview by remember { mutableStateOf<ClassOverviewData?>(null) }
    var loadingOverview by remember { mutableStateOf(true) }
    var assignments by remember { mutableStateOf<List<ExploreAssignment>>(emptyList()) }
    var loadingAssignments by remember { mutableStateOf(false) }
    var selectedCourse by remember { mutableStateOf<id.starstask.mobile.data.ClassCourse?>(null) }
    var manageOpen by remember { mutableStateOf(false) }
    var liveMembers by remember(members, clazz.id) { mutableStateOf(members) }
    var loadingMembers by remember { mutableStateOf(false) }

    val detailCourse = selectedCourse
    if (detailCourse != null) {
        CourseWorkspaceScreen(clazz = clazz, course = detailCourse, onBack = { selectedCourse = null })
        return
    }
    if (manageOpen) {
        ClassManageScreen(clazz = clazz, onBack = { manageOpen = false }, onOpenGrades = { classId -> onOpenGrades(classId) })
        return
    }

    LaunchedEffect(clazz.id) {
        loadingMembers = true
        runCatching {
            val loaded = loadClassMembers(clazz.id)
            if (loaded.isNotEmpty()) liveMembers = loaded
        }
        loadingMembers = false
    }

    LaunchedEffect(clazz.id, userId) {
        loadingOverview = true
        runCatching {
            overview = loadClassOverview(userId, clazz.id)
        }
        loadingOverview = false
    }

    LaunchedEffect(clazz.id) {
        loadingAssignments = true
        runCatching {
            val page = listAssignmentPage(classId = clazz.id, sort = "newest", page = 1, pageSize = 20)
            assignments = page.items
        }
        loadingAssignments = false
    }

    val title = when {
        clazz.classCode.isNotBlank() -> clazz.classCode
        clazz.slug.isNotBlank() -> clazz.slug
        else -> clazz.name
    }

    LazyColumn(
        modifier = Modifier.fillMaxSize().background(AssignmentBackground),
        contentPadding = PaddingValues(horizontal = 20.dp, vertical = 20.dp),
        verticalArrangement = Arrangement.spacedBy(24.dp),
    ) {
        item(key = "header") {
            Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text(
                    title,
                    color = AssignmentForeground,
                    fontSize = 28.sp,
                    fontWeight = FontWeight.SemiBold,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis,
                )
                MetaLineClean(clazz = clazz)
            }
        }

        item(key = "tabs") {
            ClassTabStripClean(items = CLASS_TABS, activeKey = activeTab, onSelect = { activeTab = it })
        }

        when (activeTab) {
            "overview" -> item {
                ClassOverviewContentClean(
                    clazz = clazz,
                    members = liveMembers,
                    overview = overview,
                    loadingOverview = loadingOverview,
                    onOpenAssignments = { activeTab = "assignments" },
                    onOpenMembers = { activeTab = "members" },
                    onOpenCourses = { activeTab = "courses" },
                    onOpenSchedule = { activeTab = "schedule" },
                    onOpenInfo = { activeTab = "info" },
                    onOpenManage = { manageOpen = true },
                )
            }
            "courses" -> item { ClassCoursesTab(clazz = clazz, onOpenCourse = { selectedCourse = it }) }
            "assignments" -> item { ClassAssignmentsTabClean(assignments = assignments, loading = loadingAssignments) }
            "members" -> item { ClassMembersTabClean(members = liveMembers, loading = loadingMembers) }
            "info" -> item { ClassInfoTabClean(clazz = clazz, memberCount = clazz.memberCount) }
            "schedule" -> item {
                ClassEmptyBox(
                    title = "No schedule entries yet.",
                    description = "Sessions and events for this class will appear here.",
                )
            }
            "attendance" -> item {
                ClassEmptyBox(
                    title = "Attendance is managed in Sessions.",
                    description = "Use Sessions to start and check in.",
                )
            }
        }
    }
}

@Composable
private fun MetaLineClean(clazz: ClassDetail) {
    val parts = buildList {
        clazz.semester.takeIf { it.isNotBlank() }?.let { add("${clazz.semester} ${clazz.academicYear}".trim()) }
        if (clazz.memberCount > 0) add("${clazz.memberCount} ${pluralize(clazz.memberCount.toLong(), "member")}")
        clazz.lecturerName.takeIf { it.isNotBlank() }?.let { add(it) }
    }
    if (parts.isEmpty()) return
    Text(
        parts.joinToString(" · "),
        color = AssignmentSecondary,
        fontSize = 14.sp,
    )
}

@Composable
private fun ClassTabStripClean(
    items: List<Pair<String, String>>,
    activeKey: String,
    onSelect: (String) -> Unit,
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .horizontalScroll(androidx.compose.foundation.rememberScrollState()),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        items.forEach { (label, key) ->
            val active = activeKey == key
            Box(
                modifier = Modifier
                    .clip(RoundedCornerShape(999.dp))
                    .background(if (active) AssignmentAccent else Color.White)
                    .border(0.5.dp, AssignmentBorder, RoundedCornerShape(999.dp))
                    .clickable { onSelect(key) }
                    .padding(horizontal = 16.dp, vertical = 12.dp),
            ) {
                Text(
                    label,
                    color = if (active) Color.White else AssignmentForeground,
                    fontSize = 14.sp,
                    fontWeight = FontWeight.SemiBold,
                )
            }
        }
    }
}

@Composable
private fun ClassOverviewContentClean(
    clazz: ClassDetail,
    members: List<String>,
    overview: ClassOverviewData?,
    loadingOverview: Boolean,
    onOpenAssignments: () -> Unit,
    onOpenMembers: () -> Unit,
    onOpenCourses: () -> Unit,
    onOpenSchedule: () -> Unit,
    onOpenInfo: () -> Unit,
    onOpenManage: () -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(24.dp)) {
        OverviewStatsClean(stats = overview?.stats ?: ClassOverviewStats(total = 0, upcoming = 0, dueToday = 0, completed = 0))
        QuickActionsClean(
            isAdmin = clazz.isAdmin,
            onOpenAssignments = onOpenAssignments,
            onOpenMembers = onOpenMembers,
            onOpenCourses = onOpenCourses,
            onOpenSchedule = onOpenSchedule,
            onOpenInfo = onOpenInfo,
            onOpenManage = onOpenManage,
        )
        RecentAssignmentsClean(
            assignments = overview?.recent.orEmpty(),
            onViewAll = onOpenAssignments,
        )
        ClassPostsClean(
            posts = overview?.posts.orEmpty(),
            isAdmin = clazz.isAdmin,
            onViewAll = onOpenAssignments,
        )
    }
}

@Composable
private fun OverviewStatsClean(stats: ClassOverviewStats) {
    Column(modifier = Modifier.fillMaxWidth()) {
        SectionTitle("Overview")
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(20.dp))
                .background(Color.White)
                .border(0.5.dp, AssignmentBorder, RoundedCornerShape(20.dp)),
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
            ) {
                // Real numbers only — no invented deltas.
                StatsColumn("Total", stats.total.toString())
                StatsColumn("Upcoming", stats.upcoming.toString())
                StatsColumn("Due today", stats.dueToday.toString())
                StatsColumn("Done", stats.completed.toString())
            }
        }
    }
}

@Composable
private fun StatsColumn(label: String, value: String) {
    Column(
        modifier = Modifier
            .padding(horizontal = 16.dp, vertical = 16.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text(value, color = AssignmentForeground, fontSize = 22.sp, fontWeight = FontWeight.Bold)
        Text(label, color = AssignmentSecondary, fontSize = 12.sp)
    }
}

@Composable
private fun QuickActionsClean(
    isAdmin: Boolean,
    onOpenAssignments: () -> Unit,
    onOpenMembers: () -> Unit,
    onOpenCourses: () -> Unit,
    onOpenSchedule: () -> Unit,
    onOpenInfo: () -> Unit,
    onOpenManage: () -> Unit = {},
) {
    Column(modifier = Modifier.fillMaxWidth()) {
        SectionTitle("Actions")
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(20.dp))
                .background(Color.White)
                .border(0.5.dp, AssignmentBorder, RoundedCornerShape(20.dp)),
        ) {
            QuickRowClean(icon = Lucide.BookOpen, label = "Courses", onClick = onOpenCourses)
            androidx.compose.material3.HorizontalDivider(color = AssignmentBorder, modifier = Modifier.padding(start = 16.dp))
            QuickRowClean(icon = Lucide.ClipboardList, label = "Assignments", onClick = onOpenAssignments)
            androidx.compose.material3.HorizontalDivider(color = AssignmentBorder, modifier = Modifier.padding(start = 16.dp))
            QuickRowClean(icon = Lucide.Users, label = "Members", onClick = onOpenMembers)
            androidx.compose.material3.HorizontalDivider(color = AssignmentBorder, modifier = Modifier.padding(start = 16.dp))
            QuickRowClean(icon = Lucide.CalendarDays, label = "Schedule", onClick = onOpenSchedule)
            androidx.compose.material3.HorizontalDivider(color = AssignmentBorder, modifier = Modifier.padding(start = 16.dp))
            QuickRowClean(icon = Lucide.Info, label = "Class info", onClick = onOpenInfo)
            if (isAdmin) {
                androidx.compose.material3.HorizontalDivider(color = AssignmentBorder, modifier = Modifier.padding(start = 16.dp))
                QuickRowClean(icon = Lucide.Settings, label = "Manage class", onClick = onOpenManage)
            }
        }
    }
}

@Composable
private fun RecentAssignmentsClean(
    assignments: List<OverviewAssignmentItem>,
    onViewAll: () -> Unit,
) {
    Column(modifier = Modifier.fillMaxWidth()) {
        SectionTitle("Assignments")
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(20.dp))
                .background(Color.White)
                .border(0.5.dp, AssignmentBorder, RoundedCornerShape(20.dp)),
        ) {
            if (assignments.isEmpty()) {
                Text(
                    "No assignments yet.",
                    color = AssignmentSecondary,
                    fontSize = 13.sp,
                    modifier = Modifier.padding(horizontal = 16.dp, vertical = 16.dp),
                )
            } else {
                assignments.forEachIndexed { index, item ->
                    if (index > 0) androidx.compose.material3.HorizontalDivider(color = AssignmentBorder, modifier = Modifier.padding(start = 16.dp))
                    val state = getDeadlineState(item.deadline)
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable { onViewAll() }
                            .padding(horizontal = 16.dp, vertical = 14.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Column(modifier = Modifier.weight(1f)) {
                            Text(item.title, color = AssignmentForeground, fontSize = 15.sp, fontWeight = FontWeight.SemiBold, maxLines = 2, overflow = TextOverflow.Ellipsis)
                            Text(
                                item.courseName,
                                color = AssignmentSecondary,
                                fontSize = 13.sp,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis,
                            )
                        }
                        Text(
                            when {
                                state == id.starstask.mobile.data.DeadlineState.OVERDUE -> "Overdue"
                                state == id.starstask.mobile.data.DeadlineState.DUE_TODAY -> "Today"
                                else -> "Upcoming"
                            },
                            color = AssignmentAccent,
                            fontSize = 13.sp,
                            fontWeight = FontWeight.Medium,
                        )
                    }
                }
            }
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .clickable { onViewAll() }
                    .padding(horizontal = 16.dp, vertical = 12.dp),
                horizontalArrangement = Arrangement.End,
            ) {
                Text("View all", color = AssignmentAccent, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
            }
        }
    }
}

@Composable
private fun ClassPostsClean(
    posts: List<OverviewPostItem>,
    isAdmin: Boolean,
    onViewAll: () -> Unit,
) {
    if (posts.isEmpty()) return
    Column(modifier = Modifier.fillMaxWidth()) {
        SectionTitle("Posts")
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(20.dp))
                .background(Color.White)
                .border(0.5.dp, AssignmentBorder, RoundedCornerShape(20.dp)),
        ) {
            posts.forEachIndexed { index, post ->
                if (index > 0) androidx.compose.material3.HorizontalDivider(color = AssignmentBorder, modifier = Modifier.padding(start = 16.dp))
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable { onViewAll() }
                        .padding(horizontal = 16.dp, vertical = 14.dp),
                ) {
                    Text(post.title, color = AssignmentForeground, fontSize = 15.sp, fontWeight = FontWeight.SemiBold, maxLines = 2, overflow = TextOverflow.Ellipsis)
                    Text(
                        post.authorName,
                        color = AssignmentSecondary,
                        fontSize = 13.sp,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                }
            }
        }
    }
}

@Composable
internal fun ClassAssignmentsTabClean(assignments: List<ExploreAssignment>, loading: Boolean) {
    Column(modifier = Modifier.fillMaxWidth()) {
        SectionTitle("Assignments")
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(20.dp))
                .background(Color.White)
                .border(0.5.dp, AssignmentBorder, RoundedCornerShape(20.dp)),
        ) {
            if (loading) {
                Box(modifier = Modifier.padding(24.dp), contentAlignment = Alignment.Center) {
                }
            } else if (assignments.isEmpty()) {
                Text(
                    "No assignments yet.",
                    color = AssignmentSecondary,
                    fontSize = 13.sp,
                    modifier = Modifier.padding(horizontal = 16.dp, vertical = 16.dp),
                )
            } else {
                assignments.forEachIndexed { index, item ->
                    if (index > 0) androidx.compose.material3.HorizontalDivider(color = AssignmentBorder, modifier = Modifier.padding(start = 16.dp))
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 16.dp, vertical = 14.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Column(modifier = Modifier.weight(1f)) {
                            Text(item.title, color = AssignmentForeground, fontSize = 15.sp, fontWeight = FontWeight.SemiBold, maxLines = 2, overflow = TextOverflow.Ellipsis)
                            Text(
                                item.courseName ?: item.courseCode ?: "Assignment",
                                color = AssignmentSecondary,
                                fontSize = 13.sp,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis,
                            )
                        }
                        Text(
                            item.deadline?.let { id.starstask.mobile.data.formatShortDayMonth(it.take(10)) } ?: "No deadline",
                            color = AssignmentAccent,
                            fontSize = 13.sp,
                            fontWeight = FontWeight.Medium,
                        )
                    }
                }
            }
        }
    }
}

@Composable
internal fun ClassMembersTabClean(members: List<String>, loading: Boolean = false) {
    Column(modifier = Modifier.fillMaxWidth()) {
        SectionTitle("Members")
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(20.dp))
                .background(Color.White)
                .border(0.5.dp, AssignmentBorder, RoundedCornerShape(20.dp)),
        ) {
            if (loading) {
                Box(modifier = Modifier.padding(24.dp), contentAlignment = Alignment.Center) {
                }
            } else if (members.isEmpty()) {
                Text(
                    "No members yet.",
                    color = AssignmentSecondary,
                    fontSize = 13.sp,
                    modifier = Modifier.padding(horizontal = 16.dp, vertical = 16.dp),
                )
            } else {
                members.forEachIndexed { index, name ->
                    if (index > 0) androidx.compose.material3.HorizontalDivider(color = AssignmentBorder, modifier = Modifier.padding(start = 16.dp))
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 16.dp, vertical = 14.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Box(
                            modifier = Modifier
                                .size(36.dp)
                                .clip(RoundedCornerShape(999.dp))
                                .background(SoftFill),
                            contentAlignment = Alignment.Center,
                        ) {
                            Text(
                                name.take(1).uppercase(),
                                color = AssignmentAccent,
                                fontSize = 14.sp,
                                fontWeight = FontWeight.SemiBold,
                            )
                        }
                        Text(
                            name,
                            color = AssignmentForeground,
                            fontSize = 15.sp,
                            fontWeight = FontWeight.Medium,
                            modifier = Modifier.padding(start = 12.dp),
                        )
                    }
                }
            }
        }
    }
}

@Composable
internal fun ClassInfoTabClean(clazz: ClassDetail, memberCount: Int) {
    Column(modifier = Modifier.fillMaxWidth()) {
        SectionTitle("Class info")
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(20.dp))
                .background(Color.White)
                .border(0.5.dp, AssignmentBorder, RoundedCornerShape(20.dp)),
        ) {
            InfoRow("Class code", clazz.classCode.ifBlank { "—" })
            androidx.compose.material3.HorizontalDivider(color = AssignmentBorder, modifier = Modifier.padding(start = 16.dp))
            InfoRow("Semester", clazz.semester.ifBlank { "—" })
            androidx.compose.material3.HorizontalDivider(color = AssignmentBorder, modifier = Modifier.padding(start = 16.dp))
            InfoRow("Academic year", clazz.academicYear.ifBlank { "—" })
            androidx.compose.material3.HorizontalDivider(color = AssignmentBorder, modifier = Modifier.padding(start = 16.dp))
            InfoRow("Members", memberCount.toString())
            androidx.compose.material3.HorizontalDivider(color = AssignmentBorder, modifier = Modifier.padding(start = 16.dp))
            InfoRow("Lecturer", clazz.lecturerName.ifBlank { "—" })
            androidx.compose.material3.HorizontalDivider(color = AssignmentBorder, modifier = Modifier.padding(start = 16.dp))
            InfoRow("Status", clazz.status.ifBlank { "Active" })
        }
    }
}

@Composable
private fun InfoRow(label: String, value: String) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 14.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(label, color = AssignmentForeground, fontSize = 15.sp, modifier = Modifier.weight(1f))
        Text(value, color = AssignmentSecondary, fontSize = 15.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
    }
}

@Composable
private fun SectionTitle(text: String) {
    Text(
        text,
        color = AssignmentForeground,
        fontSize = 20.sp,
        fontWeight = FontWeight.SemiBold,
        modifier = Modifier.padding(bottom = 12.dp),
    )
}

@Composable
private fun QuickRowClean(icon: ImageVector, label: String, onClick: () -> Unit) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .padding(horizontal = 16.dp, vertical = 14.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(icon, contentDescription = label, tint = AssignmentAccent, modifier = Modifier.size(20.dp))
        Text(
            label,
            color = AssignmentForeground,
            fontSize = 15.sp,
            fontWeight = FontWeight.Medium,
            modifier = Modifier.padding(start = 12.dp).weight(1f),
        )
        Icon(Lucide.ChevronRight, contentDescription = null, tint = AssignmentSecondary, modifier = Modifier.size(18.dp))
    }
}

@Composable
internal fun ClassEmptyBox(title: String, description: String, modifier: Modifier = Modifier) {
    Column(
        modifier = modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(20.dp))
            .background(Color.White)
            .border(0.5.dp, AssignmentBorder, RoundedCornerShape(20.dp))
            .padding(horizontal = 24.dp, vertical = 32.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        Text(title, color = AssignmentForeground, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold)
        Text(description, color = AssignmentSecondary, style = MaterialTheme.typography.bodySmall)
    }
}
