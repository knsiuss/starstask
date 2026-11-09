package id.starstask.mobile.ui.screens

import id.starstask.mobile.ui.theme.Spacing

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
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
import id.starstask.mobile.data.countPublishedAssignmentsBySubject
import id.starstask.mobile.data.createClassCourse
import id.starstask.mobile.data.listClassCourses
import id.starstask.mobile.data.pluralize
import id.starstask.mobile.ui.components.WebAlert
import id.starstask.mobile.ui.components.WebButton
import id.starstask.mobile.ui.components.WebButtonVariant
import id.starstask.mobile.ui.components.WebCard
import id.starstask.mobile.ui.components.WebCardHeader
import id.starstask.mobile.ui.components.WebEmptyState
import id.starstask.mobile.ui.components.WebInput
import id.starstask.mobile.ui.icons.Lucide
import id.starstask.mobile.ui.theme.Accent
import id.starstask.mobile.ui.theme.AssignmentAccent
import id.starstask.mobile.ui.theme.AssignmentForeground
import id.starstask.mobile.ui.theme.AssignmentSecondary
import id.starstask.mobile.ui.theme.Foreground
import id.starstask.mobile.ui.theme.MutedForeground
import kotlinx.coroutines.launch

// Mirrors web CoursesPage (/app/classes/[slug]/courses):
// "X active course in {name}" + member/manager copy, course rows with
// code chip + archived badge + lecturer + assignment count, empty states,
// and CreateSubjectForm (Add subject / Create subject) for managers.

@Composable
fun ClassCoursesTab(
    clazz: ClassDetail,
    onOpenCourse: (ClassCourse) -> Unit,
) {
    var courses by remember { mutableStateOf<List<ClassCourse>>(emptyList()) }
    var counts by remember { mutableStateOf<Map<String, Int>>(emptyMap()) }
    var loading by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    var formOpen by remember { mutableStateOf(false) }

    LaunchedEffect(clazz.id) {
        loading = true
        error = null
        try {
            val canManage = clazz.isAdmin
            courses = listClassCourses(clazz.id, includeArchived = canManage)
            counts = countPublishedAssignmentsBySubject(clazz.id)
        } catch (_: Exception) {
            error = "Could not load courses."
        }
        loading = false
    }

    val activeCount = courses.count { it.status == "active" }

    Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically, modifier = Modifier.fillMaxWidth()) {
            Column(modifier = Modifier.weight(1f)) {
                Text("Courses", color = AssignmentForeground, fontSize = 28.sp, fontWeight = FontWeight.SemiBold)
                val membershipCopy = if (clazz.isAdmin) {
                    ". Members of this class group get access to every course automatically."
                } else {
                    ". You have access to every course here because you are a member of this class group."
                }
                Text(
                    "$activeCount ${pluralize(activeCount.toLong(), "active course")} in ${clazz.name}$membershipCopy",
                    color = AssignmentSecondary,
                    fontSize = 14.sp,
                )
            }
            if (clazz.isAdmin && clazz.status != "archived") {
                WebButton(
                    label = if (formOpen) "Close" else "+ Add subject",
                    onClick = { formOpen = !formOpen },
                    variant = WebButtonVariant.SECONDARY,
                )
            }
        }

        if (formOpen) {
            CreateSubjectForm(
                classId = clazz.id,
                onCreated = { created ->
                    courses = courses + created
                    formOpen = false
                },
                onClose = { formOpen = false },
            )
        }

        when {
            loading -> CircularProgressIndicator(color = AssignmentAccent)
            error != null -> WebAlert(message = error!!)
            courses.isEmpty() -> WebEmptyState(
                title = "No courses yet",
                description = if (clazz.isAdmin) {
                    "Add the first course to this class group. Its assignments, attendance sessions, and schedule will live inside it."
                } else {
                    "A class admin has not added any course to this class group yet."
                },
            )
            else -> Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(20.dp))
                    .background(Color.White)
                    .border(0.5.dp, Color(0xFFE9EBF0), RoundedCornerShape(20.dp)),
            ) {
                courses.forEachIndexed { index, course ->
                    if (index > 0) androidx.compose.material3.HorizontalDivider(color = Color(0xFFE9EBF0), modifier = Modifier.padding(start = 16.dp))
                    val assignmentCount = counts[course.id] ?: 0
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clickable { onOpenCourse(course) }
                            .padding(horizontal = 16.dp, vertical = 14.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Box(
                            modifier = Modifier
                                .size(36.dp)
                                .clip(RoundedCornerShape(10.dp))
                                .background(Color(0xFFEEF1F7)),
                            contentAlignment = Alignment.Center,
                        ) {
                            Icon(
                                Lucide.BookOpen,
                                contentDescription = null,
                                tint = AssignmentAccent,
                                modifier = Modifier.size(18.dp),
                            )
                        }
                        Column(modifier = Modifier.weight(1f).padding(start = 12.dp)) {
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(6.dp),
                            ) {
                                Text(
                                    course.name,
                                    color = AssignmentForeground,
                                    fontSize = 15.sp,
                                    fontWeight = FontWeight.SemiBold,
                                    maxLines = 1,
                                    overflow = TextOverflow.Ellipsis,
                                    modifier = Modifier.weight(1f, fill = false),
                                )
                                if (!course.code.isNullOrBlank()) {
                                    Text(
                                        course.code,
                                        color = AssignmentSecondary,
                                        fontSize = 11.sp,
                                        modifier = Modifier
                                            .clip(RoundedCornerShape(6.dp))
                                            .background(Color(0xFFF0F1F3))
                                            .padding(horizontal = 6.dp, vertical = 3.dp),
                                    )
                                }
                            }
                            Text(
                                "${course.lecturerName ?: "No lecturer set"} · $assignmentCount ${pluralize(assignmentCount.toLong(), "assignment")}",
                                color = AssignmentSecondary,
                                fontSize = 13.sp,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis,
                            )
                            if (!course.description.isNullOrBlank()) {
                                Text(course.description, color = AssignmentSecondary, fontSize = 13.sp, maxLines = 2, overflow = TextOverflow.Ellipsis)
                            }
                        }
                        Icon(Lucide.ChevronRight, contentDescription = null, tint = AssignmentSecondary, modifier = Modifier.size(18.dp))
                    }
                }
            }
        }

        if (clazz.isAdmin) {
            Text(
                "Archived courses keep their assignments, submissions, and attendance history. Only their status changes.",
                color = AssignmentSecondary,
                fontSize = 13.sp,
            )
        }
    }
}

@Composable
private fun CreateSubjectForm(
    classId: String,
    onCreated: (ClassCourse) -> Unit,
    onClose: () -> Unit,
) {
    var name by remember { mutableStateOf("") }
    var code by remember { mutableStateOf("") }
    var lecturer by remember { mutableStateOf("") }
    var description by remember { mutableStateOf("") }
    var busy by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()

    WebCard {
        WebCardHeader(title = "Create new subject / course", description = "This subject will automatically become available to all members of this class group.")
        WebInput(value = name, onValueChange = { name = it }, label = "Subject name *")
        WebInput(value = code, onValueChange = { code = it }, label = "Subject code (optional)")
        WebInput(value = lecturer, onValueChange = { lecturer = it }, label = "Lecturer name (optional)")
        WebInput(value = description, onValueChange = { description = it }, label = "Description (optional)", singleLine = false)
        if (error != null) WebAlert(message = error!!)
        Row(horizontalArrangement = Arrangement.spacedBy(Spacing.Md)) {
            WebButton(label = "Cancel", onClick = onClose, variant = WebButtonVariant.SECONDARY)
            WebButton(
                label = if (busy) "Creating…" else "Create subject",
                onClick = {
                    busy = true
                    error = null
                    scope.launch {
                        runCatching {
                            createClassCourse(classId, name, code.ifBlank { null }, lecturer.ifBlank { null }, description.ifBlank { null })
                        }.onSuccess { onCreated(it) }
                            .onFailure { error = "Could not create subject." }
                        busy = false
                    }
                },
                enabled = !busy && name.isNotBlank(),
            )
        }
    }
}
