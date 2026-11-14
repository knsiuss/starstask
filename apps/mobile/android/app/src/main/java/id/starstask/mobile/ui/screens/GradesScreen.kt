package id.starstask.mobile.ui.screens

import id.starstask.mobile.ui.theme.Spacing

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import id.starstask.mobile.data.ClassCourse
import id.starstask.mobile.data.ClassRosterEntry
import id.starstask.mobile.data.listClassCourses
import id.starstask.mobile.data.listClassRoster
import id.starstask.mobile.data.listCourseComponentGrades
import id.starstask.mobile.data.setCourseComponentGrade
import id.starstask.mobile.data.validateComponentGrade
import id.starstask.mobile.data.userFacingMessage
import id.starstask.mobile.ui.components.WebAlert
import id.starstask.mobile.ui.components.WebButton
import id.starstask.mobile.ui.components.WebButtonVariant
import id.starstask.mobile.ui.components.WebInput
import id.starstask.mobile.ui.components.WebCard
import id.starstask.mobile.ui.components.WebCardHeader
import id.starstask.mobile.ui.components.WebScreen
import id.starstask.mobile.ui.components.WebScreenHeader
import id.starstask.mobile.ui.components.WebSectionTitle
import id.starstask.mobile.ui.theme.MutedForeground
import kotlinx.coroutines.launch

/**
 * Grades: per-component scores for a course (web academic/grades +
 * lib/db/course-grades.ts). Manager-only writes; DB is the authority.
 */

@Composable
fun GradesScreen(classId: String, onBack: () -> Unit) {
    var courses by remember { mutableStateOf<List<ClassCourse>>(emptyList()) }
    var selected by remember { mutableStateOf<ClassCourse?>(null) }
    var grades by remember { mutableStateOf<Map<String, Double>>(emptyMap()) }
    var error by remember { mutableStateOf<String?>(null) }
    var notice by remember { mutableStateOf<String?>(null) }
    var loading by remember { mutableStateOf(true) }
    val scope = rememberCoroutineScope()

    LaunchedEffect(classId) {
        loading = true
        val err = runCatching { courses = listClassCourses(classId, false) }.exceptionOrNull()
        error = err?.let { userFacingMessage(it, "Could not load courses.") }
        loading = false
    }

    LaunchedEffect(selected?.id) {
        val course = selected ?: return@LaunchedEffect
        grades = runCatching { listCourseComponentGrades(classId, course.id) }.getOrDefault(emptyMap())
    }

    val course = selected
    if (course != null) {
        GradeEditor(
            classId = classId, course = course, grades = grades,
            onGrades = { grades = it }, error = error, notice = notice,
            onNotice = { notice = it }, onError = { error = it },
            onBack = { selected = null },
        )
        return
    }

    WebScreen {
        WebScreenHeader(title = "Grades", subtitle = "Component scores per course")
        WebButton(label = "← Back", onClick = onBack, variant = WebButtonVariant.SECONDARY)
        if (loading) Text("Loading…", color = MutedForeground)
        if (error != null) WebAlert(message = error!!)
        if (!loading && courses.isEmpty() && error == null) {
            Text("No courses yet for this class.", color = MutedForeground)
        }
        WebSectionTitle("Courses (${courses.size})")
        LazyColumn(verticalArrangement = Arrangement.spacedBy(Spacing.Md), contentPadding = androidx.compose.foundation.layout.PaddingValues(bottom = 112.dp)) {
            items(courses, key = { it.id }) { item ->
                WebCard(modifier = Modifier.fillMaxWidth()) {
                    Column(modifier = Modifier.padding(Spacing.Section), verticalArrangement = Arrangement.spacedBy(Spacing.Xs)) {
                        Text(item.name, color = id.starstask.mobile.ui.theme.Foreground)
                        WebButton(label = "Open grades", onClick = { selected = item }, variant = WebButtonVariant.SECONDARY)
                    }
                }
            }
        }
    }
}

@Composable
private fun GradeEditor(
    classId: String, course: ClassCourse, grades: Map<String, Double>,
    onGrades: (Map<String, Double>) -> Unit, error: String?, notice: String?,
    onNotice: (String) -> Unit, onError: (String) -> Unit, onBack: () -> Unit,
) {
    var studentId by remember { mutableStateOf<String?>(null) }
    var component by remember { mutableStateOf("tugas") }
    var scoreText by remember { mutableStateOf("") }
    var saving by remember { mutableStateOf(false) }
    var roster by remember { mutableStateOf<List<ClassRosterEntry>>(emptyList()) }
    val scope = rememberCoroutineScope()
    val components = listOf("tugas" to "Tugas", "uts" to "UTS", "uas" to "UAS")

    LaunchedEffect(classId) {
        roster = runCatching { listClassRoster(classId) }.getOrDefault(emptyList())
    }

    WebScreen(modifier = Modifier.padding(bottom = 112.dp)) {
        WebScreenHeader(title = course.name, subtitle = "Inline component grade")
        WebButton(label = "← Courses", onClick = onBack, variant = WebButtonVariant.SECONDARY)
        if (notice != null) WebAlert(message = notice!!, variant = id.starstask.mobile.ui.components.WebAlertVariant.SUCCESS)
        if (error != null) WebAlert(message = error!!)
        WebSectionTitle("Set score")
        WebSectionTitle("Student")
        if (roster.isEmpty()) {
            Text("No active students in this class yet.", color = MutedForeground)
        } else {
            // One AssistChip per member; selection is explicit and ids are hidden.
            roster.forEach { member ->
                androidx.compose.material3.AssistChip(
                    onClick = { studentId = member.userId },
                    label = { Text(member.displayName, color = if (studentId == member.userId) id.starstask.mobile.ui.theme.Foreground else MutedForeground) },
                )
            }
        }
        Row(horizontalArrangement = Arrangement.spacedBy(Spacing.Md)) {
            components.forEach { (value, label) ->
                androidx.compose.material3.AssistChip(
                    onClick = { component = value },
                    label = { Text(label, color = if (component == value) id.starstask.mobile.ui.theme.Foreground else MutedForeground) },
                )
            }
        }
        WebInput(value = scoreText, onValueChange = { scoreText = it }, label = "Score (0-100)")
        WebButton(
            label = if (saving) "Saving…" else "Save score",
            onClick = {
                val score = scoreText.toDoubleOrNull()
                validateComponentGrade(score)?.let { onError(it); return@WebButton }
                val sid = studentId
                if (sid.isNullOrBlank()) { onError("Pick a student."); return@WebButton }
                saving = true
                scope.launch {
                    val err = setCourseComponentGrade(classId, course.id, sid, component, score!!)
                    if (err == null) {
                        onNotice("Score saved.")
                        onGrades(grades + ("$sid:$component" to score!!))
                        scoreText = ""
                    } else onError(err)
                    saving = false
                }
            },
            enabled = !saving,
        )
        WebSectionTitle("Saved (${grades.size})")
        grades.entries.sortedBy { it.key }.forEach { (key, value) ->
            Text("$key = $value", color = MutedForeground, style = MaterialTheme.typography.bodySmall)
        }
    }
}
