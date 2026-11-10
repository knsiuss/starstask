package id.starstask.mobile.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import id.starstask.mobile.data.ClassCourse
import id.starstask.mobile.data.ClassDetail
import id.starstask.mobile.data.countCourseContent
import id.starstask.mobile.data.createCourseMaterial
import id.starstask.mobile.data.formatShortDayMonth
import id.starstask.mobile.data.listAssignmentPage
import id.starstask.mobile.data.listCourseMaterials
import id.starstask.mobile.data.loadClassAdmins
import id.starstask.mobile.data.loadClassMembers
import id.starstask.mobile.data.updateClassCourse
import id.starstask.mobile.ui.components.WebAlert
import id.starstask.mobile.ui.components.WebButton
import id.starstask.mobile.ui.components.WebButtonVariant
import id.starstask.mobile.ui.components.WebCard
import id.starstask.mobile.ui.components.WebCardHeader
import id.starstask.mobile.ui.components.WebEmptyState
import id.starstask.mobile.ui.components.WebInput
import id.starstask.mobile.ui.icons.Lucide
import id.starstask.mobile.ui.theme.AssignmentAccent
import id.starstask.mobile.ui.theme.AssignmentBackground
import id.starstask.mobile.ui.theme.AssignmentForeground
import id.starstask.mobile.ui.theme.AssignmentSecondary
import id.starstask.mobile.ui.theme.AssignmentBorder
import id.starstask.mobile.ui.theme.SoftFill
import id.starstask.mobile.ui.theme.WarningSoft
import id.starstask.mobile.ui.theme.Warning
import kotlinx.coroutines.launch

// Mirrors web COURSE_TABS exactly: Overview, Assignments, Materials, Announcements, Members, Attendance, Schedule.
// CourseOverviewStats tiles, Course information card, upcoming groups.
private val COURSE_TABS = listOf(
    "Overview" to "overview",
    "Assignments" to "assignments",
    "Materials" to "materials",
    "Announcements" to "announcements",
    "Members" to "members",
    "Attendance" to "attendance",
    "Schedule" to "schedule",
)

@Composable
fun CourseWorkspaceScreen(clazz: ClassDetail, course: ClassCourse, onBack: () -> Unit) {
    var activeTab by remember { mutableStateOf("overview") }
    var assignments by remember { mutableStateOf<List<id.starstask.mobile.data.ExploreAssignment>>(emptyList()) }
    var materials by remember { mutableStateOf<List<id.starstask.mobile.data.CourseMaterial>>(emptyList()) }
    var counts by remember { mutableStateOf<id.starstask.mobile.data.CourseContentCounts?>(null) }
    var admins by remember { mutableStateOf<List<id.starstask.mobile.data.ClassAdminRow>>(emptyList()) }
    var members by remember { mutableStateOf<List<String>>(emptyList()) }

    LaunchedEffect(clazz.id, course.id) {
        runCatching {
            val page = listAssignmentPage(classId = clazz.id, courseId = course.courseId, sort = "newest", page = 1, pageSize = 50)
            assignments = page.items
        }
        runCatching { materials = listCourseMaterials(clazz.id, course.id) }
        runCatching { counts = countCourseContent(clazz.id, course.id) }
        runCatching { admins = loadClassAdmins(clazz.id) }
        members = runCatching { loadClassMembers(clazz.id) }.getOrDefault(emptyList())
    }

    val announcements = assignments.filter { it.contentType == "class_announcement" }
    val tasks = assignments.filter { it.contentType != "class_announcement" }

    LazyColumn(
        modifier = Modifier.fillMaxSize().background(AssignmentBackground),
        contentPadding = PaddingValues(horizontal = 20.dp, vertical = 20.dp),
        verticalArrangement = Arrangement.spacedBy(24.dp),
    ) {
        item(key = "header") {
            Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.fillMaxWidth()) {
                    Icon(
                        Lucide.ArrowLeft,
                        contentDescription = "Back to class",
                        tint = AssignmentForeground,
                        modifier = Modifier
                            .size(48.dp)
                            .clip(RoundedCornerShape(12.dp))
                            .background(Color.White)
                            .border(0.5.dp, AssignmentBorder, RoundedCornerShape(12.dp))
                            .clickable { onBack() }
                            .padding(12.dp),
                    )
                    Text(
                        "Back to class",
                        color = AssignmentSecondary,
                        fontSize = 14.sp,
                        modifier = Modifier.padding(start = 8.dp),
                    )
                    Box(Modifier.weight(1f))
                    Icon(
                        Lucide.MoreHorizontal,
                        contentDescription = "More",
                        tint = AssignmentSecondary,
                        modifier = Modifier
                            .size(48.dp)
                            .clip(RoundedCornerShape(12.dp))
                            .padding(12.dp),
                    )
                }
                Text(course.name, color = AssignmentForeground, fontSize = 28.sp, fontWeight = FontWeight.SemiBold, maxLines = 1, overflow = TextOverflow.Ellipsis)
                Text(
                    "${clazz.classCode} ${clazz.academicYear}".trim(),
                    color = AssignmentSecondary,
                    fontSize = 14.sp,
                )
            }
        }

        item(key = "tabs") {
            CourseTabStripClean(items = COURSE_TABS, activeKey = activeTab, onSelect = { activeTab = it })
        }

        when (activeTab) {
            "overview" -> {
                item(key = "ov-stats") { CourseOverviewStatsClean(counts = counts) }
                item(key = "ov-info") { CourseInfoCardClean(clazz = clazz, course = course) }
                item(key = "ov-upcoming") { CourseUpcomingSection(tasks = tasks) }
                item(key = "ov-announcements") { CourseAnnouncementsSection(announcements = announcements) }
                item(key = "ov-recent") { CourseRecentSection(tasks = tasks) }
                item(key = "ov-materials") { CourseMaterialsSection(materials = materials) }
            }
            "assignments" -> item(key = "assignments") { CourseAssignmentsTabClean(tasks = tasks) }
            "materials" -> item(key = "materials") { CourseMaterialsTabClean(clazz = clazz, course = course, materials = materials, onMaterialsChange = { materials = it }) }
            "announcements" -> item(key = "ann") { CourseAnnouncementsSection(announcements = announcements) }
            "members" -> item(key = "members") { CourseMembersTabClean(members = members, admins = admins) }
            "attendance" -> item(key = "attendance") {
                CourseAttendanceTabClean(
                    isAdmin = clazz.isAdmin,
                    courseStatus = course.status,
                    onNewMeeting = { /* TODO: wire createMeeting(); admin-only */ },
                    onShowHistory = { /* TODO: navigate to /attendance?view=history */ },
                )
            }
            "schedule" -> item(key = "schedule") {
                CourseEmptyBoxClean(
                    title = "No schedule entries yet.",
                    description = "Sessions and events for this course will appear here.",
                )
            }
        }
    }
}

@Composable
private fun CourseOverviewStatsClean(counts: id.starstask.mobile.data.CourseContentCounts?) {
    Column(modifier = Modifier.fillMaxWidth()) {
        SectionTitleClean("Course Overview")
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(20.dp))
                .background(Color.White)
                .border(0.5.dp, AssignmentBorder, RoundedCornerShape(20.dp)),
        ) {
            Row(modifier = Modifier.fillMaxWidth().padding(12.dp)) {
                StatTileClean(icon = Lucide.ClipboardList, label = "Assignments", value = counts?.assignments ?: 0, bg = SoftFill, tint = AssignmentAccent)
                StatTileClean(icon = Lucide.BookOpen, label = "Materials", value = counts?.materials ?: 0, bg = Color(0xFFEAF5EE), tint = Color(0xFF2E7D4F))
                StatTileClean(icon = Lucide.Megaphone, label = "Announcements", value = counts?.announcements ?: 0, bg = WarningSoft, tint = Warning)
                StatTileClean(icon = Lucide.Activity, label = "Activities", value = (counts?.assignments ?: 0) + (counts?.announcements ?: 0), bg = SoftFill, tint = AssignmentAccent)
            }
        }
    }
}

@Composable
private fun RowScope.StatTileClean(icon: androidx.compose.ui.graphics.vector.ImageVector, label: String, value: Int, bg: Color, tint: Color) {
    Row(
        modifier = Modifier
            .weight(1f)
            .clip(RoundedCornerShape(16.dp))
            .background(bg)
            .padding(12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(
            modifier = Modifier
                .size(36.dp)
                .clip(RoundedCornerShape(10.dp))
                .background(Color.White),
            contentAlignment = Alignment.Center,
        ) {
            Icon(icon, contentDescription = null, tint = tint, modifier = Modifier.size(18.dp))
        }
        Column(modifier = Modifier.padding(start = 8.dp)) {
            Text(label, color = AssignmentSecondary, fontSize = 11.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
            Text(value.toString(), color = AssignmentForeground, fontSize = 20.sp, fontWeight = FontWeight.Bold)
        }
    }
}

@Composable
private fun CourseInfoCardClean(clazz: ClassDetail, course: ClassCourse) {
    Column(modifier = Modifier.fillMaxWidth()) {
        SectionTitleClean("Course information")
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(20.dp))
                .background(Color.White)
                .border(0.5.dp, AssignmentBorder, RoundedCornerShape(20.dp)),
        ) {
            InfoRowClean("Code", course.code ?: "Not set")
            HorizontalDivider(color = AssignmentBorder, modifier = Modifier.padding(start = 16.dp))
            InfoRowClean("Semester", clazz.semester.ifBlank { "Not set" })
            HorizontalDivider(color = AssignmentBorder, modifier = Modifier.padding(start = 16.dp))
            InfoRowClean("Lecturer", course.lecturerName ?: "Not set")
            HorizontalDivider(color = AssignmentBorder, modifier = Modifier.padding(start = 16.dp))
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 14.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text("Status", color = AssignmentForeground, fontSize = 15.sp, modifier = Modifier.weight(1f))
                Text(
                    "● ${course.status.replaceFirstChar { it.uppercase() }}",
                    color = if (course.status == "active") Color(0xFF2E7D4F) else AssignmentSecondary,
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Medium,
                )
            }
        }
    }
}

@Composable
private fun CourseUpcomingSection(tasks: List<id.starstask.mobile.data.ExploreAssignment>) {
    val nowMs = System.currentTimeMillis()
    val upcoming = tasks.filter {
        it.deadline != null && id.starstask.mobile.data.parseTime(it.deadline) > nowMs
    }.sortedBy { id.starstask.mobile.data.parseTime(it.deadline ?: "") }
    val dueSoon = upcoming.filter {
        id.starstask.mobile.data.getJakartaDayDifference(it.deadline ?: "", nowMs) <= id.starstask.mobile.data.UPCOMING_DUE_SOON_DAYS
    }
    val later = upcoming - dueSoon.toSet()
    Column(modifier = Modifier.fillMaxWidth()) {
        SectionTitleClean("Upcoming assignments")
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(20.dp))
                .background(Color.White)
                .border(0.5.dp, AssignmentBorder, RoundedCornerShape(20.dp)),
        ) {
            if (upcoming.isEmpty()) {
                EmptyTextClean("No upcoming deadlines in this course.")
            } else {
                if (dueSoon.isNotEmpty()) {
                    SubLabelClean("Due soon")
                    dueSoon.forEachIndexed { index, item ->
                        if (index > 0) HorizontalDivider(color = AssignmentBorder, modifier = Modifier.padding(start = 16.dp))
                        CourseAssignmentRowClean(title = item.title, deadline = item.deadline)
                    }
                }
                if (later.isNotEmpty()) {
                    SubLabelClean("Later")
                    later.forEachIndexed { index, item ->
                        if (index > 0) HorizontalDivider(color = AssignmentBorder, modifier = Modifier.padding(start = 16.dp))
                        CourseAssignmentRowClean(title = item.title, deadline = item.deadline)
                    }
                }
            }
        }
    }
}

@Composable
private fun CourseAnnouncementsSection(announcements: List<id.starstask.mobile.data.ExploreAssignment>) {
    Column(modifier = Modifier.fillMaxWidth()) {
        SectionTitleClean("Announcements")
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(20.dp))
                .background(Color.White)
                .border(0.5.dp, AssignmentBorder, RoundedCornerShape(20.dp)),
        ) {
            if (announcements.isEmpty()) {
                EmptyTextClean("No announcements yet.")
            } else {
                announcements.forEachIndexed { index, item ->
                    if (index > 0) HorizontalDivider(color = AssignmentBorder, modifier = Modifier.padding(start = 16.dp))
                    Column(modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 14.dp)) {
                        Text(item.title, color = AssignmentAccent, fontSize = 15.sp, fontWeight = FontWeight.Medium)
                        if (item.description.isNotBlank()) {
                            Text(item.description, color = AssignmentSecondary, fontSize = 13.sp, maxLines = 2, overflow = TextOverflow.Ellipsis)
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun CourseRecentSection(tasks: List<id.starstask.mobile.data.ExploreAssignment>) {
    Column(modifier = Modifier.fillMaxWidth()) {
        SectionTitleClean("Recent assignments")
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(20.dp))
                .background(Color.White)
                .border(0.5.dp, AssignmentBorder, RoundedCornerShape(20.dp)),
        ) {
            if (tasks.isEmpty()) {
                EmptyTextClean("No assignments yet.")
            } else {
                tasks.take(6).forEachIndexed { index, item ->
                    if (index > 0) HorizontalDivider(color = AssignmentBorder, modifier = Modifier.padding(start = 16.dp))
                    CourseAssignmentRowClean(title = item.title, deadline = item.deadline)
                }
            }
        }
    }
}

@Composable
private fun CourseMaterialsSection(materials: List<id.starstask.mobile.data.CourseMaterial>) {
    Column(modifier = Modifier.fillMaxWidth()) {
        SectionTitleClean("Materials")
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(20.dp))
                .background(Color.White)
                .border(0.5.dp, AssignmentBorder, RoundedCornerShape(20.dp)),
        ) {
            if (materials.isEmpty()) {
                EmptyTextClean("No learning material in this course yet.")
            } else {
                materials.take(3).forEachIndexed { index, material ->
                    if (index > 0) HorizontalDivider(color = AssignmentBorder, modifier = Modifier.padding(start = 16.dp))
                    Column(modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 14.dp)) {
                        Text(material.title, color = AssignmentForeground, fontSize = 15.sp, fontWeight = FontWeight.SemiBold, maxLines = 1, overflow = TextOverflow.Ellipsis)
                        Text(material.kind, color = AssignmentSecondary, fontSize = 13.sp)
                    }
                }
            }
        }
    }
}

@Composable
private fun CourseAssignmentsTabClean(tasks: List<id.starstask.mobile.data.ExploreAssignment>) {
    Column(modifier = Modifier.fillMaxWidth()) {
        SectionTitleClean("Assignments")
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(20.dp))
                .background(Color.White)
                .border(0.5.dp, AssignmentBorder, RoundedCornerShape(20.dp)),
        ) {
            if (tasks.isEmpty()) {
                EmptyTextClean("No assignments yet.")
            } else {
                tasks.forEachIndexed { index, item ->
                    if (index > 0) HorizontalDivider(color = AssignmentBorder, modifier = Modifier.padding(start = 16.dp))
                    CourseAssignmentRowClean(title = item.title, deadline = item.deadline)
                }
            }
        }
    }
}

@Composable
private fun CourseMaterialsTabClean(
    clazz: ClassDetail,
    course: ClassCourse,
    materials: List<id.starstask.mobile.data.CourseMaterial>,
    onMaterialsChange: (List<id.starstask.mobile.data.CourseMaterial>) -> Unit,
) {
    var title by remember { mutableStateOf("") }
    var url by remember { mutableStateOf("") }
    var msg by remember { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()
    Column(modifier = Modifier.fillMaxWidth()) {
        SectionTitleClean("Materials")
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(20.dp))
                .background(Color.White)
                .border(0.5.dp, AssignmentBorder, RoundedCornerShape(20.dp)),
        ) {
            Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Text("Add material", color = AssignmentForeground, fontSize = 15.sp, fontWeight = FontWeight.SemiBold)
                WebInput(value = title, onValueChange = { title = it }, label = "Title *")
                WebInput(value = url, onValueChange = { url = it }, label = "URL (optional)")
                if (msg != null) Text(msg!!, color = AssignmentSecondary, fontSize = 13.sp)
                WebButton(
                    label = "Add material",
                    onClick = {
                        if (title.trim().length < 3) { msg = "Title at least 3 characters."; return@WebButton }
                        scope.launch {
                            try {
                                createCourseMaterial(clazz.id, course.id, title, url.ifBlank { null })
                                title = ""
                                url = ""
                                onMaterialsChange(listCourseMaterials(clazz.id, course.id))
                                msg = "Added."
                            } catch (e: Exception) {
                                msg = "Could not add: ${e.message}"
                            }
                        }
                    },
                )
            }
        }
        Spacer2()
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(20.dp))
                .background(Color.White)
                .border(0.5.dp, AssignmentBorder, RoundedCornerShape(20.dp)),
        ) {
            if (materials.isEmpty()) {
                EmptyTextClean("No materials yet.")
            } else {
                materials.forEachIndexed { index, material ->
                    if (index > 0) HorizontalDivider(color = AssignmentBorder, modifier = Modifier.padding(start = 16.dp))
                    Column(modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 14.dp)) {
                        Text(material.title, color = AssignmentForeground, fontSize = 15.sp, fontWeight = FontWeight.SemiBold)
                        Text("${material.kind} • ${material.resourceUrl ?: ""}", color = AssignmentSecondary, fontSize = 13.sp)
                    }
                }
            }
        }
    }
}

@Composable
private fun CourseMembersTabClean(members: List<String>, admins: List<id.starstask.mobile.data.ClassAdminRow>) {
    Column(modifier = Modifier.fillMaxWidth()) {
        SectionTitleClean("Members")
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(20.dp))
                .background(Color.White)
                .border(0.5.dp, AssignmentBorder, RoundedCornerShape(20.dp)),
        ) {
            if (members.isEmpty()) {
                EmptyTextClean("No members loaded.")
            } else {
                members.forEachIndexed { index, name ->
                    if (index > 0) HorizontalDivider(color = AssignmentBorder, modifier = Modifier.padding(start = 16.dp))
                    Row(
                        modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 14.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Box(
                            modifier = Modifier.size(36.dp).clip(RoundedCornerShape(999.dp)).background(SoftFill),
                            contentAlignment = Alignment.Center,
                        ) {
                            Text(name.take(1).uppercase(), color = AssignmentAccent, fontSize = 14.sp, fontWeight = FontWeight.SemiBold)
                        }
                        Text(name, color = AssignmentForeground, fontSize = 15.sp, fontWeight = FontWeight.Medium, modifier = Modifier.padding(start = 12.dp))
                    }
                }
            }
        }
        if (admins.isNotEmpty()) {
            Spacer2()
            SectionTitleClean("Admins")
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(20.dp))
                    .background(Color.White)
                    .border(0.5.dp, AssignmentBorder, RoundedCornerShape(20.dp)),
            ) {
                admins.forEachIndexed { index, admin ->
                    if (index > 0) HorizontalDivider(color = AssignmentBorder, modifier = Modifier.padding(start = 16.dp))
                    Row(
                        modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 14.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Text(admin.userId, color = AssignmentForeground, fontSize = 15.sp, fontWeight = FontWeight.Medium, modifier = Modifier.weight(1f))
                        Text(
                            "Admin",
                            color = AssignmentAccent,
                            fontSize = 12.sp,
                            fontWeight = FontWeight.SemiBold,
                            modifier = Modifier.clip(RoundedCornerShape(999.dp)).background(SoftFill).padding(horizontal = 8.dp, vertical = 4.dp),
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun CourseEmptyBoxClean(title: String, description: String) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(20.dp))
            .background(Color.White)
            .border(0.5.dp, AssignmentBorder, RoundedCornerShape(20.dp))
            .padding(horizontal = 24.dp, vertical = 40.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Text(title, color = AssignmentForeground, fontSize = 16.sp, fontWeight = FontWeight.SemiBold)
        Text(description, color = AssignmentSecondary, fontSize = 13.sp)
    }
}

@Composable
private fun CourseTabStripClean(items: List<Pair<String, String>>, activeKey: String, onSelect: (String) -> Unit) {
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
                Text(label, color = if (active) Color.White else AssignmentForeground, fontSize = 14.sp, fontWeight = FontWeight.SemiBold)
            }
        }
    }
}

@Composable
private fun SectionTitleClean(text: String) {
    Text(text, color = AssignmentForeground, fontSize = 20.sp, fontWeight = FontWeight.SemiBold, modifier = Modifier.padding(bottom = 12.dp))
}

@Composable
private fun SubLabelClean(text: String) {
    Text(text, color = AssignmentForeground, fontSize = 15.sp, fontWeight = FontWeight.SemiBold, modifier = Modifier.padding(horizontal = 16.dp, vertical = 12.dp))
}

@Composable
private fun InfoRowClean(label: String, value: String) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 14.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(label, color = AssignmentForeground, fontSize = 15.sp, modifier = Modifier.weight(1f))
        Text(value, color = AssignmentSecondary, fontSize = 15.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
    }
}

@Composable
private fun CourseAssignmentRowClean(title: String, deadline: String?) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 14.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Text(title, color = AssignmentForeground, fontSize = 15.sp, fontWeight = FontWeight.SemiBold, maxLines = 2, overflow = TextOverflow.Ellipsis)
        }
        deadline?.let {
            Text(formatShortDayMonth(it.take(10)), color = AssignmentAccent, fontSize = 13.sp, fontWeight = FontWeight.Medium)
        }
    }
}

@Composable
private fun EmptyTextClean(text: String) {
    Text(text, color = AssignmentSecondary, fontSize = 13.sp, modifier = Modifier.padding(horizontal = 16.dp, vertical = 16.dp))
}

@Composable
private fun Spacer2() {
    Box(modifier = Modifier.padding(vertical = 12.dp))
}
