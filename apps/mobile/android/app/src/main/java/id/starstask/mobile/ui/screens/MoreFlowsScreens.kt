package id.starstask.mobile.ui.screens

import id.starstask.mobile.ui.theme.Spacing

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
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
import id.starstask.mobile.data.ApplicationRow
import id.starstask.mobile.data.createSession
import id.starstask.mobile.data.loadMyApplications
import id.starstask.mobile.data.reviseSubmission
import id.starstask.mobile.data.submitApplication
import id.starstask.mobile.ui.components.BadgeVariant
import id.starstask.mobile.ui.components.StarsTaskBadge
import id.starstask.mobile.ui.components.WebAlert
import id.starstask.mobile.ui.components.WebButton
import id.starstask.mobile.ui.components.WebButtonVariant
import id.starstask.mobile.ui.components.WebCard
import id.starstask.mobile.ui.components.WebCardHeader
import id.starstask.mobile.ui.components.WebEmptyState
import id.starstask.mobile.ui.components.WebInput
import id.starstask.mobile.ui.components.WebScreenHeader
import id.starstask.mobile.ui.theme.Foreground
import id.starstask.mobile.ui.theme.MutedForeground
import kotlinx.coroutines.launch

// Applications (/app/applications), Submissions revise, Sessions new, Class join.

@Composable
fun ApplicationsScreen(userId: String, onBack: () -> Unit) {
    var rows by remember { mutableStateOf<List<ApplicationRow>>(emptyList()) }
    var error by remember { mutableStateOf<String?>(null) }
    var slug by remember { mutableStateOf("") }
    var name by remember { mutableStateOf("") }
    var course by remember { mutableStateOf("") }
    var reason by remember { mutableStateOf("") }
    var busy by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()

    LaunchedEffect(userId) {
        runCatching { rows = loadMyApplications(userId) }
            .onFailure { error = "Could not load applications: ${it.message}" }
    }

    Column(modifier = Modifier.fillMaxSize().padding(Spacing.Section), verticalArrangement = Arrangement.spacedBy(Spacing.Xl)) {
        WebButton(label = "← Back", onClick = onBack, variant = WebButtonVariant.GHOST)
        WebScreenHeader(title = "Class applications", subtitle = "Propose a new class group")
        WebCard {
            WebInput(value = slug, onValueChange = { slug = it }, label = "Slug")
            WebInput(value = name, onValueChange = { name = it }, label = "Class name")
            WebInput(value = course, onValueChange = { course = it }, label = "Course name")
            WebInput(value = reason, onValueChange = { reason = it }, label = "Reason", singleLine = false)
            WebButton(
                label = if (busy) "Submitting…" else "Submit application",
                onClick = {
                    busy = true; error = null
                    scope.launch {
                        runCatching { submitApplication(slug, name, course, reason) }
                            .onSuccess { rows = loadMyApplications(userId) }
                            .onFailure { error = "Submit failed: ${it.message}" }
                        busy = false
                    }
                },
                enabled = !busy,
            )
            if (error != null) WebAlert(message = error!!)
        }
        if (rows.isEmpty()) {
            WebEmptyState(title = "No applications yet.", description = "Your proposals will appear here.")
        }
        LazyColumn(verticalArrangement = Arrangement.spacedBy(Spacing.Md)) {
            items(rows.size, key = { rows[it].id }) { index ->
                val row = rows[index]
                WebCard {
                    androidx.compose.foundation.layout.Row(horizontalArrangement = Arrangement.spacedBy(Spacing.Sm)) {
                        Text("${row.name} (${row.slug})", color = Foreground, modifier = Modifier.weight(1f))
                        StarsTaskBadge(label = row.status, variant = BadgeVariant.ACCENT)
                    }
                    Text(row.courseName ?: "", color = MutedForeground, style = MaterialTheme.typography.bodySmall)
                }
            }
        }
    }
}

@Composable
fun SubmissionReviseScreen(assignmentId: String, onBack: () -> Unit) {
    var title by remember { mutableStateOf("") }
    var description by remember { mutableStateOf("") }
    var error by remember { mutableStateOf<String?>(null) }
    var done by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()

    Column(modifier = Modifier.fillMaxSize().padding(Spacing.Section), verticalArrangement = Arrangement.spacedBy(Spacing.Xl)) {
        WebButton(label = "← Back", onClick = onBack, variant = WebButtonVariant.GHOST)
        WebScreenHeader(title = "Revise submission", subtitle = "Update title and description")
        if (done) WebAlert(message = "Revision saved.", variant = id.starstask.mobile.ui.components.WebAlertVariant.SUCCESS)
        WebCard {
            WebInput(value = title, onValueChange = { title = it }, label = "Title")
            WebInput(value = description, onValueChange = { description = it }, label = "Description", singleLine = false)
            WebButton(
                label = "Save revision",
                onClick = {
                    scope.launch {
                        runCatching { reviseSubmission(assignmentId, title, description) }
                            .onSuccess { done = true }
                            .onFailure { error = "Revise failed: ${it.message}" }
                    }
                },
            )
            if (error != null) WebAlert(message = error!!)
        }
    }
}

@Composable
fun NewClassSessionScreen(classId: String, onBack: () -> Unit, onCreated: () -> Unit) {
    var title by remember { mutableStateOf("") }
    var startsAt by remember { mutableStateOf("") }
    var endsAt by remember { mutableStateOf("") }
    var error by remember { mutableStateOf<String?>(null) }
    var busy by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()

    Column(modifier = Modifier.fillMaxSize().padding(Spacing.Section), verticalArrangement = Arrangement.spacedBy(Spacing.Xl)) {
        WebButton(label = "← Back", onClick = onBack, variant = WebButtonVariant.GHOST)
        WebScreenHeader(title = "New session", subtitle = "Times in ISO (e.g. 2026-11-07T09:00:00+07:00)")
        WebCard {
            WebCardHeader(title = "Session details")
            WebInput(value = title, onValueChange = { title = it }, label = "Title")
            WebInput(value = startsAt, onValueChange = { startsAt = it }, label = "Starts at (ISO)")
            WebInput(value = endsAt, onValueChange = { endsAt = it }, label = "Ends at (ISO)")
            WebButton(
                label = if (busy) "Creating…" else "Create session",
                onClick = {
                    busy = true; error = null
                    scope.launch {
                        runCatching { createSession(classId, title, startsAt, endsAt) }
                            .onSuccess { onCreated() }
                            .onFailure { error = "Create failed: ${it.message}" }
                        busy = false
                    }
                },
                enabled = !busy,
            )
            if (error != null) WebAlert(message = error!!)
        }
    }
}

@Composable
fun ClassJoinScreen(onJoined: (String) -> Unit) {
    var code by remember { mutableStateOf("") }
    var error by remember { mutableStateOf<String?>(null) }
    var busy by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()

    Column(modifier = Modifier.fillMaxSize().padding(Spacing.Section), verticalArrangement = Arrangement.spacedBy(Spacing.Xl)) {
        WebScreenHeader(title = "Join a class", subtitle = "Paste the invitation code or ID you received.")
        WebCard {
            WebInput(value = code, onValueChange = { code = it }, label = "Invitation code / ID")
            WebButton(
                label = if (busy) "Joining…" else "Join class",
                onClick = {
                    busy = true; error = null
                    scope.launch {
                        runCatching { id.starstask.mobile.data.joinClassByCode(code) }
                            .onSuccess { onJoined(it) }
                            .onFailure { error = "Join failed: ${it.message}" }
                        busy = false
                    }
                },
                enabled = !busy,
            )
            if (error != null) WebAlert(message = error!!)
        }
    }
}
