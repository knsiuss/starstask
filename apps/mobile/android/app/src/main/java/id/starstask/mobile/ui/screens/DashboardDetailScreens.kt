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
import androidx.compose.material3.CircularProgressIndicator
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
import id.starstask.mobile.data.AcademicCard
import id.starstask.mobile.data.ClassDetail
import id.starstask.mobile.data.CourseOption
import id.starstask.mobile.data.LeaveRequest
import id.starstask.mobile.data.NotificationRow
import id.starstask.mobile.data.createSession
import id.starstask.mobile.data.loadCourses
import id.starstask.mobile.data.loadManageableClasses
import id.starstask.mobile.data.submitAssignment
import id.starstask.mobile.ui.components.BadgeVariant
import id.starstask.mobile.ui.components.StarsTaskBadge
import id.starstask.mobile.ui.components.WebAlert
import id.starstask.mobile.ui.components.WebAlertVariant
import id.starstask.mobile.ui.components.WebButton
import id.starstask.mobile.ui.components.WebButtonVariant
import id.starstask.mobile.ui.components.WebInput
import id.starstask.mobile.ui.theme.Foreground
import id.starstask.mobile.ui.theme.MutedForeground
import kotlinx.coroutines.launch

/** Academic identity detail (web /university). */
@Composable
fun UniversityScreen(card: AcademicCard, onBack: () -> Unit) {
    Column(modifier = Modifier.fillMaxSize().padding(Spacing.Section), verticalArrangement = Arrangement.spacedBy(Spacing.Xl)) {
        WebButton(label = "← Back", onClick = onBack, variant = WebButtonVariant.SECONDARY)
        Text("University & academic identity", style = MaterialTheme.typography.headlineSmall, color = Foreground)
        if (card.linked) {
            Text(card.universityName ?: "-", color = Foreground, style = MaterialTheme.typography.titleMedium)
            Text("Student ID: ${card.studentId ?: "—"}", color = MutedForeground)
            Text("Home class: ${card.homeClassName ?: "No home class assigned yet"}", color = MutedForeground)
        } else {
            Text("Not linked to a university yet", color = Foreground)
            Text(
                "Find your university and request access from its operator. " +
                    "Open StarsTask on web to link your academic identity.",
                color = MutedForeground,
                style = MaterialTheme.typography.bodySmall,
            )
        }
    }
}

/** Submit an assignment brief (web /submit). */
@Composable
fun SubmitAssignmentScreen(userId: String, onBack: () -> Unit, onSubmitted: () -> Unit) {
    var courses by remember { mutableStateOf<List<CourseOption>>(emptyList()) }
    var courseId by remember { mutableStateOf("") }
    var title by remember { mutableStateOf("") }
    var description by remember { mutableStateOf("") }
    var deadline by remember { mutableStateOf("") }
    var message by remember { mutableStateOf<String?>(null) }
    var busy by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()

    LaunchedEffect(Unit) {
        courses = loadCourses()
        courseId = courses.firstOrNull()?.id ?: ""
    }

    Column(modifier = Modifier.fillMaxSize().padding(Spacing.Section), verticalArrangement = Arrangement.spacedBy(Spacing.Xl)) {
        WebButton(label = "← Back", onClick = onBack, variant = WebButtonVariant.SECONDARY)
        Text("Submit an assignment", style = MaterialTheme.typography.headlineSmall, color = Foreground)
        Text(
            "Share the brief exactly as you received it. Remove personal data " +
                "such as student names, grades, or private contact details.",
            color = MutedForeground,
            style = MaterialTheme.typography.bodySmall,
        )
        Text("Course", color = MutedForeground, style = MaterialTheme.typography.bodySmall)
        courses.forEach { course ->
            WebButton(
                label = (course.code?.let { "$it · " } ?: "") + course.name,
                onClick = { courseId = course.id },
                modifier = Modifier.fillMaxWidth(),
                variant = WebButtonVariant.SECONDARY,
            )
        }
        WebInput(value = title, onValueChange = { title = it }, label = "Title")
        WebInput(value = description, onValueChange = { description = it }, label = "Description", singleLine = false, minLines = 3)
        WebInput(value = deadline, onValueChange = { deadline = it }, label = "Deadline (YYYY-MM-DD HH:mm, optional)")
        if (message != null) WebAlert(message = message!!, variant = WebAlertVariant.INFO)
        WebButton(
            label = if (busy) "Submitting…" else "Submit assignment",
            onClick = {
                if (courseId.isBlank() || title.isBlank()) {
                    message = "Pick a course and enter a title."
                    return@WebButton
                }
                busy = true
                scope.launch {
                    runCatching {
                        val deadlineIso = deadline.trim().takeIf { it.isNotBlank() }?.let {
                            val normalized = it.replace(" ", "T")
                            java.time.LocalDateTime.parse(normalized)
                                .atZone(java.time.ZoneId.of("Asia/Jakarta"))
                                .toInstant().toString()
                        }
                        submitAssignment(userId, courseId, title.trim(), description.trim(), deadlineIso)
                    }.onSuccess {
                        message = "Submitted."
                        onSubmitted()
                    }.onFailure {
                        message = "Could not submit. Check the fields and try again."
                    }
                    busy = false
                }
            },
            enabled = !busy,
        )
    }
}

/** Schedule a session (web /sessions/new) — class admins only. */
@Composable
fun NewSessionScreen(userId: String, onBack: () -> Unit, onCreated: () -> Unit) {
    var classes by remember { mutableStateOf<List<ClassDetail>>(emptyList()) }
    var classId by remember { mutableStateOf("") }
    var title by remember { mutableStateOf("") }
    var startsAt by remember { mutableStateOf("") }
    var endsAt by remember { mutableStateOf("") }
    var message by remember { mutableStateOf<String?>(null) }
    var busy by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()

    LaunchedEffect(Unit) {
        classes = loadManageableClasses(userId)
        classId = classes.firstOrNull()?.id ?: ""
    }

    Column(modifier = Modifier.fillMaxSize().padding(Spacing.Section), verticalArrangement = Arrangement.spacedBy(Spacing.Xl)) {
        WebButton(label = "← Back", onClick = onBack, variant = WebButtonVariant.SECONDARY)
        Text("Schedule a session", style = MaterialTheme.typography.headlineSmall, color = Foreground)
        if (classes.isEmpty()) {
            Text(
                "You cannot schedule sessions for any class yet. " +
                    "Sessions are created by a class admin.",
                color = MutedForeground,
            )
        } else {
            Text("Class", color = MutedForeground, style = MaterialTheme.typography.bodySmall)
            classes.forEach { clazz ->
                WebButton(
                    label = clazz.name,
                    onClick = { classId = clazz.id },
                    modifier = Modifier.fillMaxWidth(),
                    variant = WebButtonVariant.SECONDARY,
                )
            }
            WebInput(value = title, onValueChange = { title = it }, label = "Title")
            WebInput(value = startsAt, onValueChange = { startsAt = it }, label = "Starts at (YYYY-MM-DD HH:mm)")
            WebInput(value = endsAt, onValueChange = { endsAt = it }, label = "Ends at (YYYY-MM-DD HH:mm)")
            if (message != null) WebAlert(message = message!!, variant = WebAlertVariant.INFO)
            WebButton(
                label = if (busy) "Scheduling…" else "Schedule session",
                onClick = {
                    if (classId.isBlank() || title.isBlank() || startsAt.isBlank() || endsAt.isBlank()) {
                        message = "Fill in class, title, and times."
                        return@WebButton
                    }
                    busy = true
                    scope.launch {
                        runCatching {
                            fun toIso(value: String): String =
                                java.time.LocalDateTime.parse(value.trim().replace(" ", "T"))
                                    .atZone(java.time.ZoneId.of("Asia/Jakarta"))
                                    .toInstant().toString()
                            createSession(classId, title.trim(), toIso(startsAt), toIso(endsAt))
                        }.onSuccess {
                            message = "Session scheduled."
                            onCreated()
                        }.onFailure {
                            message = "Could not schedule. Check the times and try again."
                        }
                        busy = false
                    }
                },
                enabled = !busy,
            )
        }
    }
}

// Leave request detail and list now live in LeaveRequestsScreens.kt and
// LeaveRequestDetailScreen.kt, wired through the leave RPCs.

/** Notification detail; marks the notification as read on open. */
@Composable
fun NotificationDetailScreen(
    notification: NotificationRow,
    onBack: () -> Unit,
) {
    val scope = rememberCoroutineScope()
    LaunchedEffect(notification.id) {
        if (notification.readAt == null) {
            scope.launch { runCatching { id.starstask.mobile.data.markNotificationRead(notification.id) } }
        }
    }
    Column(modifier = Modifier.fillMaxSize().padding(Spacing.Section), verticalArrangement = Arrangement.spacedBy(Spacing.Xl)) {
        WebButton(label = "← Back", onClick = onBack, variant = WebButtonVariant.SECONDARY)
        Text(notification.title, style = MaterialTheme.typography.headlineSmall, color = Foreground)
        if (notification.body.isNotEmpty()) Text(notification.body, color = MutedForeground)
        StarsTaskBadge(
            label = if (notification.readAt == null) "Unread" else "Read",
            variant = if (notification.readAt == null) BadgeVariant.ACCENT else BadgeVariant.NEUTRAL,
        )
    }
}


