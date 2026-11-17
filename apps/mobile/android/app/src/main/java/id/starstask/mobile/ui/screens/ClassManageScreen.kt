package id.starstask.mobile.ui.screens

import id.starstask.mobile.ui.theme.Spacing

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import id.starstask.mobile.ui.components.StaggerDots
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
import id.starstask.mobile.data.ClassBranding
import id.starstask.mobile.data.ClassDetail
import id.starstask.mobile.data.deleteClass
import id.starstask.mobile.data.loadAnnouncements
import id.starstask.mobile.data.loadClassAdmins
import id.starstask.mobile.data.publishAnnouncement
import id.starstask.mobile.data.renameClass
import id.starstask.mobile.data.setClassJoinPolicy
import id.starstask.mobile.data.setClassStatus
import id.starstask.mobile.ui.screens.classdir.ClassInvitesGlossy
import id.starstask.mobile.data.listClassCourses
import id.starstask.mobile.data.ClassCourse
import id.starstask.mobile.data.loadClassBranding
import id.starstask.mobile.data.saveClassBranding
import id.starstask.mobile.data.userFacingMessage
import id.starstask.mobile.ui.components.WebAlert
import id.starstask.mobile.ui.components.WebButton
import id.starstask.mobile.ui.components.WebButtonVariant
import id.starstask.mobile.ui.components.WebCard
import id.starstask.mobile.ui.components.WebCardHeader
import id.starstask.mobile.ui.components.WebEmptyState
import id.starstask.mobile.ui.components.WebInput
import id.starstask.mobile.ui.components.WebScreenHeader
import id.starstask.mobile.ui.components.WebSectionTitle
import id.starstask.mobile.ui.theme.Foreground
import id.starstask.mobile.ui.theme.MutedForeground
import kotlinx.coroutines.launch

// Mirrors web /app/classes/[slug]/manage (Overview + Settings tabs combined)
// and /academic (admins + announcements) in one mobile flow.

@Composable
fun ClassManageScreen(clazz: ClassDetail, onBack: () -> Unit, onOpenGrades: (String) -> Unit = {}) {
    var workspaceTab by remember { mutableStateOf("overview") }
    var name by remember { mutableStateOf(clazz.name) }
    var error by remember { mutableStateOf<String?>(null) }
    var busy by remember { mutableStateOf(false) }
    var admins by remember { mutableStateOf<List<id.starstask.mobile.data.ClassAdminRow>>(emptyList()) }
    var announcements by remember { mutableStateOf<List<id.starstask.mobile.data.AnnouncementRow>>(emptyList()) }
    var announceTitle by remember { mutableStateOf("") }
    var announceBody by remember { mutableStateOf("") }
    var announceSubjectId by remember { mutableStateOf("") }
    var announcedSubjects by remember { mutableStateOf<List<id.starstask.mobile.data.ClassCourse>>(emptyList()) }
    var branding by remember { mutableStateOf<ClassBranding?>(null) }
    var brandingName by remember { mutableStateOf("") }
    var brandingDoc by remember { mutableStateOf("") }
    var brandingSaved by remember { mutableStateOf<String?>(null) }
    var invitesOpen by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()

    LaunchedEffect(clazz.id) {
        runCatching { admins = loadClassAdmins(clazz.id) }
        runCatching { announcements = loadAnnouncements(clazz.id) }
        runCatching { listClassCourses(clazz.id, includeArchived = false) }.onSuccess { announcedSubjects = it }
        runCatching { loadClassBranding(clazz.id) }.onSuccess {
            branding = it
            brandingName = it?.universityName ?: ""
            brandingDoc = it?.documentTitle ?: ""
        }
    }

    if (invitesOpen) {
        ClassInvitesGlossy(classId = clazz.id, className = clazz.name, onBack = { invitesOpen = false })
        return
    }

    Column(modifier = Modifier.fillMaxSize().padding(Spacing.Section), verticalArrangement = Arrangement.spacedBy(Spacing.Xl)) {
        WebButton(label = "← Back", onClick = onBack, variant = WebButtonVariant.GHOST)
        WebScreenHeader(title = "Manage ${clazz.name}", subtitle = "Settings, admins and announcements")
        // Web ClassWorkspaceTabs: Overview / Courses / Assignments / Members / Schedule / Attendance / Info.
        // Mobile maps the top three to live sections; the rest point to their home screens.
        id.starstask.mobile.ui.components.WebTabStrip(
            items = listOf(
                "Overview" to "overview", "Courses" to "courses", "Assignments" to "assignments",
                "Members" to "members", "Schedule" to "schedule", "Attendance" to "attendance", "Info" to "info",
            ),
            activeKey = workspaceTab,
            onSelect = {
                workspaceTab = it
                if (it == "courses" || it == "assignments" || it == "members" || it == "schedule" || it == "attendance" || it == "info") {
                    onBack()
                }
            },
        )

        WebCard {
            WebCardHeader(title = "Class settings", description = "Name, status and join policy")
            WebInput(value = name, onValueChange = { name = it }, label = "Class name")
            Row(horizontalArrangement = Arrangement.spacedBy(Spacing.Md)) {
                WebButton(
                    label = "Rename",
                    onClick = {
                        busy = true; error = null
                        scope.launch {
                            runCatching { renameClass(clazz.id, name) }
                                .onFailure { error = userFacingMessage(it, "Could not rename. Please try again.") }
                            busy = false
                        }
                    },
                    enabled = !busy && name.isNotBlank(),
                )
                WebButton(
                    label = if (clazz.status == "archived") "Restore" else "Archive",
                    onClick = {
                        busy = true; error = null
                        scope.launch {
                            runCatching { setClassStatus(clazz.id, if (clazz.status == "archived") "active" else "archived") }
                                .onFailure { error = userFacingMessage(it, "Could not change status. Please try again.") }
                            busy = false
                        }
                    },
                    variant = WebButtonVariant.SECONDARY,
                )
            }
            Row(horizontalArrangement = Arrangement.spacedBy(Spacing.Md)) {
                WebButton(
                    label = "Open join",
                    onClick = {
                        busy = true; error = null
                        scope.launch {
                            runCatching { setClassJoinPolicy(clazz.id, "open") }
                                .onFailure { error = userFacingMessage(it, "Could not set policy. Please try again.") }
                            busy = false
                        }
                    },
                    variant = WebButtonVariant.SECONDARY,
                )
                WebButton(
                    label = "Approval join",
                    onClick = {
                        busy = true; error = null
                        scope.launch {
                            runCatching { setClassJoinPolicy(clazz.id, "approval") }
                                .onFailure { error = userFacingMessage(it, "Could not set policy. Please try again.") }
                            busy = false
                        }
                    },
                    variant = WebButtonVariant.SECONDARY,
                )
                WebButton(
                    label = "Delete",
                    onClick = {
                        busy = true; error = null
                        scope.launch {
                            runCatching { deleteClass(clazz.id) }
                                .onFailure { error = userFacingMessage(it, "Delete failed. Only an admin can delete a class with no active members.") }
                            busy = false
                        }
                    },
                    variant = WebButtonVariant.DANGER,
                )
            }
            if (error != null) WebAlert(message = error!!)
            WebButton(
                label = "Manage invitations",
                onClick = { invitesOpen = true },
                variant = WebButtonVariant.SECONDARY,
            )
        }

        WebSectionTitle("Admins (${admins.size})")
        if (admins.isEmpty()) {
            WebEmptyState(title = "No admins loaded.")
        } else {
            admins.forEach { admin ->
                WebCard {
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                        Text(admin.userId, color = Foreground, modifier = Modifier.weight(1f))
                        Text(admin.assignedAt ?: "", color = MutedForeground, style = MaterialTheme.typography.bodySmall)
                    }
                }
            }
        }

        WebSectionTitle("Announcements (${announcements.size})")
        WebCard {
            WebCardHeader(title = "Publish announcement", description = "Visible to all class members — pick the course it belongs to.")
            val activeSubjectId = announceSubjectId.ifBlank { announcedSubjects.firstOrNull()?.id.orEmpty() }
            if (announcedSubjects.isEmpty()) {
                Text("Add a course to this class before posting an announcement.", color = MutedForeground, style = MaterialTheme.typography.bodySmall)
            } else {
                id.starstask.mobile.ui.components.WebTabStrip(
                    items = announcedSubjects.map { (it.code?.let { c -> "$c · ${it.name}" } ?: it.name) to it.id },
                    activeKey = activeSubjectId,
                    onSelect = { announceSubjectId = it },
                )
            }
            WebInput(value = announceTitle, onValueChange = { announceTitle = it }, label = "Title")
            WebInput(value = announceBody, onValueChange = { announceBody = it }, label = "Body", singleLine = false)
            WebButton(
                label = "Publish announcement",
                onClick = {
                    scope.launch {
                        runCatching { publishAnnouncement(clazz.id, announceTitle, announceBody, activeSubjectId) }
                        runCatching { announcements = loadAnnouncements(clazz.id) }
                    }
                },
                enabled = announcedSubjects.isNotEmpty() && announceTitle.isNotBlank(),
            )
        }
        LazyColumn(verticalArrangement = Arrangement.spacedBy(Spacing.Sm)) {
            items(announcements.size) { index ->
                val item = announcements[index]
                WebCard {
                    Text(item.title, color = Foreground)
                    Text(item.createdAt ?: "", color = MutedForeground, style = MaterialTheme.typography.bodySmall)
                }
            }
        }

        WebSectionTitle("Grades")
        WebButton(label = "Open grades", onClick = { onOpenGrades(clazz.id) })

        WebSectionTitle("Export branding")
        WebCard {
            WebCardHeader(title = "Branding", description = "Printed on exports (manager only)")
            WebInput(value = brandingName, onValueChange = { brandingName = it }, label = "University name")
            WebInput(value = brandingDoc, onValueChange = { brandingDoc = it }, label = "Document title")
            if (brandingSaved != null) Text(brandingSaved!!, color = MutedForeground, style = MaterialTheme.typography.bodySmall)
            WebButton(
                label = "Save branding",
                onClick = {
                    scope.launch {
                        val current = branding
                        val err = saveClassBranding(
                            clazz.id,
                            ClassBranding(
                                universityName = brandingName, universityShortName = current?.universityShortName,
                                faculty = current?.faculty, department = current?.department,
                                documentTitle = brandingDoc, productName = current?.productName ?: "StarsTask",
                                brandingEnabled = current?.brandingEnabled ?: true,
                                passingThreshold = current?.passingThreshold ?: 0.0,
                            ),
                        )
                        brandingSaved = err ?: "Saved."
                        if (err == null) runCatching { loadClassBranding(clazz.id) }.onSuccess { branding = it }
                    }
                },
            )
        }
    }
}
