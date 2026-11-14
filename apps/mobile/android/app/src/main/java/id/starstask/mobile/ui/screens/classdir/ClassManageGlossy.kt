package id.starstask.mobile.ui.screens.classdir

// Manage class (admin): settings form, join policy, lifecycle (archive/delete)
// with the numbers the web confirmation shows, announcements, export branding.
// Server (RLS + can_manage_class RPC re-check) is the authority; the client
// only gates visibility. Admins never delete a class that has records.

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Icon
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.produceState
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import id.starstask.mobile.data.ClassBranding
import id.starstask.mobile.data.ClassDependencies
import id.starstask.mobile.data.ClassDetail
import id.starstask.mobile.data.ManagedClass
import id.starstask.mobile.data.deleteClass
import id.starstask.mobile.data.getClassDependencies
import id.starstask.mobile.data.getManagedClassById
import id.starstask.mobile.data.loadAnnouncements
import id.starstask.mobile.data.listClassCourses
import id.starstask.mobile.data.ClassCourse
import id.starstask.mobile.data.loadClassBranding
import id.starstask.mobile.data.publishAnnouncement
import id.starstask.mobile.data.saveClassBranding
import id.starstask.mobile.data.setClassJoinPolicy
import id.starstask.mobile.data.setClassStatus
import id.starstask.mobile.data.updateClassMetadataFull
import id.starstask.mobile.data.userFacingMessage
import id.starstask.mobile.ui.components.WebAlert
import id.starstask.mobile.ui.components.StartaskSuccessDialog
import id.starstask.mobile.ui.icons.Lucide
import id.starstask.mobile.ui.theme.mockColors
import kotlinx.coroutines.launch

@Composable
fun ClassManageGlossy(
    clazz: ClassDetail,
    onBack: () -> Unit,
    onOpenGrades: (String) -> Unit,
    onOpenInvites: () -> Unit,
) {
    val palette = mockColors()
    val scope = rememberCoroutineScope()

    var reloadTick by remember { mutableIntStateOf(0) }
    var actionBusy by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    var notice by remember { mutableStateOf<String?>(null) }
    var successTitle by remember { mutableStateOf<String?>(null) }
    var successSummary by remember { mutableStateOf<String?>(null) }
    var confirmDelete by remember { mutableStateOf(false) }

    val managed by produceState<ManagedClass?>(initialValue = null, key1 = clazz.id, key2 = reloadTick) {
        value = runCatching { getManagedClassById(clazz.id) }.getOrNull()
    }
    val dependencies by produceState<ClassDependencies?>(initialValue = null, key1 = clazz.id, key2 = reloadTick) {
        value = runCatching { getClassDependencies(clazz.id) }.getOrNull()
    }
    val subjects by produceState(initialValue = emptyList<id.starstask.mobile.data.ClassCourse>(), key1 = clazz.id, key2 = reloadTick) {
        value = runCatching { listClassCourses(clazz.id, includeArchived = false) }.getOrDefault(emptyList())
    }
    val announcements by produceState(initialValue = emptyList<id.starstask.mobile.data.AnnouncementRow>(), key1 = clazz.id, key2 = reloadTick) {
        value = runCatching { loadAnnouncements(clazz.id) }.getOrDefault(emptyList())
    }
    val branding by produceState(initialValue = null as ClassBranding?, key1 = clazz.id, key2 = reloadTick) {
        value = runCatching { loadClassBranding(clazz.id) }.getOrNull()
    }

    // Form state, seeded once the managed row arrives.
    var name by remember { mutableStateOf(clazz.name) }
    var classCode by remember { mutableStateOf(clazz.classCode) }
    var description by remember { mutableStateOf("") }
    var courseName by remember { mutableStateOf(clazz.courseName) }
    var institution by remember { mutableStateOf("") }
    var lecturerName by remember { mutableStateOf(clazz.lecturerName) }
    var semester by remember { mutableStateOf(clazz.semester) }
    var academicYear by remember { mutableStateOf(clazz.academicYear) }
    var joinPolicy by remember { mutableStateOf("invitation") }
    var seeded by remember { mutableStateOf(false) }

    LaunchedEffect(managed?.id) {
        managed?.let { m ->
            if (!seeded) {
                name = m.name
                classCode = m.classCode.orEmpty()
                description = m.description.orEmpty()
                courseName = m.courseName.orEmpty()
                institution = m.institution.orEmpty()
                lecturerName = m.lecturerName.orEmpty()
                semester = m.semester.orEmpty()
                academicYear = m.academicYear.orEmpty()
                joinPolicy = m.joinPolicy
                seeded = true
            }
        }
    }

    val archived = (managed?.status ?: clazz.status) == "archived"
    val readOnly = archived

    GlossyBackSurface(
        title = "Manage class",
        subtitle = clazz.name,
        onBack = onBack,
    ) {
        Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
            if (error != null) WebAlert(message = error!!)
            if (notice != null) WebAlert(message = notice!!, variant = id.starstask.mobile.ui.components.WebAlertVariant.SUCCESS)

            // Quick links.
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(12.dp))
                    .background(palette.card)
                    .border(1.dp, palette.cardBorder, RoundedCornerShape(12.dp)),
            ) {
                Column {
                    ManageActionRow(icon = Lucide.GraduationCap, label = "Open grades", palette = palette) { onOpenGrades(clazz.id) }
                    GlossyHairline(palette)
                    ManageActionRow(icon = Lucide.Link2, label = "Manage invitations", palette = palette, onClick = onOpenInvites)
                }
            }

            // Basic information.
            ManageSection(title = "Basic information", palette = palette) {
                if (readOnly) {
                    Text(
                        "Archived classes are read-only. Restore the class to edit its details.",
                        color = palette.muted,
                        fontSize = 13.sp,
                        lineHeight = 19.sp,
                    )
                }
                ManageField(label = "Class name", value = name, onChange = { name = it }, enabled = !readOnly, palette = palette)
                ManageField(label = "Class code", value = classCode, onChange = { classCode = it.uppercase() }, enabled = !readOnly, palette = palette, singleLine = true)
                ManageField(label = "Course", value = courseName, onChange = { courseName = it }, enabled = !readOnly, palette = palette)
                ManageField(label = "Semester", value = semester, onChange = { semester = it }, enabled = !readOnly, palette = palette, singleLine = true)
                ManageField(label = "Academic year", value = academicYear, onChange = { academicYear = it }, enabled = !readOnly, palette = palette, singleLine = true, placeholder = "2025/2026")
                ManageField(label = "Institution", value = institution, onChange = { institution = it }, enabled = !readOnly, palette = palette)
                ManageField(label = "Lecturer", value = lecturerName, onChange = { lecturerName = it }, enabled = !readOnly, palette = palette)
                ManageField(label = "Description", value = description, onChange = { description = it }, enabled = !readOnly, palette = palette, singleLine = false, minLines = 3)

                Text("Joining", color = palette.muted, fontSize = 11.sp, fontWeight = FontWeight.SemiBold, modifier = Modifier.padding(start = 4.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    listOf("invitation" to "Invitation only", "open" to "Open by name").forEach { (key, label) ->
                        val active = joinPolicy == key
                        Box(
                            modifier = Modifier
                                .clip(RoundedCornerShape(999.dp))
                                .background(if (active) palette.accent else palette.chip)
                                .clickable(enabled = !readOnly) { joinPolicy = key }
                                .heightIn(min = 34.dp)
                                .padding(horizontal = 16.dp, vertical = 8.dp),
                        ) {
                            Text(label, color = if (active) androidx.compose.ui.graphics.Color.White else palette.ink, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
                        }
                    }
                }
                Text(
                    "Invitation-only classes admit new members through an invitation link. Open classes also let a student join by typing the exact class name.",
                    color = palette.muted,
                    fontSize = 12.sp,
                    lineHeight = 18.sp,
                )

                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(999.dp))
                        .background(if (readOnly || actionBusy) palette.chip else palette.accent)
                        .clickable(enabled = !readOnly && !actionBusy && name.isNotBlank()) {
                            scope.launch {
                                actionBusy = true
                                error = null
                                notice = null
                                runCatching {
                                    updateClassMetadataFull(
                                        classId = clazz.id,
                                        name = name,
                                        description = description,
                                        courseName = courseName,
                                        semester = semester,
                                        academicYear = academicYear,
                                        institution = institution,
                                        lecturerName = lecturerName,
                                        classCode = classCode,
                                    )
                                    setClassJoinPolicy(clazz.id, joinPolicy)
                                }.onSuccess {
                                    notice = "Class details saved."
                                    reloadTick++
                                }.onFailure { error = userFacingMessage(it, "Could not update the class.") }
                                actionBusy = false
                            }
                        }
                        .heightIn(min = 48.dp)
                        .padding(horizontal = 20.dp, vertical = 13.dp),
                    contentAlignment = Alignment.Center,
                ) {
                    Text(
                        if (actionBusy) "Saving…" else "Save class details",
                        color = if (readOnly || actionBusy) palette.muted else androidx.compose.ui.graphics.Color.White,
                        fontSize = 14.sp,
                        fontWeight = FontWeight.SemiBold,
                    )
                }
            }

            // Announcements.
            ManageSection(title = "Announcements (${announcements.size})", palette = palette) {
                var title by remember { mutableStateOf("") }
                var body by remember { mutableStateOf("") }
                var subjectId by remember { mutableStateOf("") }
                var subjectMenuOpen by remember { mutableStateOf(false) }

                if (subjects.isEmpty()) {
                    Text("Add a course to this class before posting an announcement.", color = palette.muted, fontSize = 13.sp)
                } else {
                    val activeSubjectId = subjectId.ifBlank { subjects.firstOrNull()?.id.orEmpty() }
                    Box {
                        Row(
                            modifier = Modifier.fillMaxWidth().clip(androidx.compose.foundation.shape.RoundedCornerShape(12.dp)).clickable { subjectMenuOpen = true }.padding(horizontal = 12.dp, vertical = 10.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(10.dp),
                        ) {
                            androidx.compose.material3.Icon(Lucide.BookOpen, contentDescription = null, tint = palette.accent, modifier = Modifier.size(18.dp))
                            Column(modifier = Modifier.weight(1f)) {
                                Text("Course", color = palette.muted, fontSize = 11.sp)
                                Text(subjects.firstOrNull { it.id == activeSubjectId }?.let { it.code?.let { c -> "$c · ${it.name}" } ?: it.name } ?: "Pick a course", color = palette.ink, fontSize = 14.sp, fontWeight = FontWeight.SemiBold, maxLines = 1)
                            }
                            androidx.compose.material3.Icon(Lucide.ChevronDown, contentDescription = null, tint = palette.muted, modifier = Modifier.size(18.dp))
                        }
                        androidx.compose.material3.DropdownMenu(expanded = subjectMenuOpen, onDismissRequest = { subjectMenuOpen = false }) {
                            subjects.forEach { s ->
                                androidx.compose.material3.DropdownMenuItem(
                                    text = { Text(s.code?.let { c -> "$c · ${s.name}" } ?: s.name) },
                                    onClick = { subjectId = s.id; subjectMenuOpen = false },
                                )
                            }
                        }
                    }
                }
                ManageField(label = "Title", value = title, onChange = { title = it }, enabled = true, palette = palette)
                ManageField(label = "Body", value = body, onChange = { body = it }, enabled = true, palette = palette, singleLine = false, minLines = 3)
                Text(
                    "Publish announcement",
                    color = palette.accent,
                    fontSize = 13.sp,
                    fontWeight = FontWeight.SemiBold,
                    modifier = Modifier
                        .clip(RoundedCornerShape(999.dp))
                        .clickable(enabled = title.isNotBlank() && subjects.isNotEmpty()) {
                            scope.launch {
                                error = null
                                notice = null
                                val active = subjectId.ifBlank { subjects.firstOrNull()?.id.orEmpty() }
                                runCatching { publishAnnouncement(clazz.id, title, body, active) }
                                    .onSuccess {
                                        val captured = title
                                        title = ""
                                        body = ""
                                        successTitle = "Announcement Published"
                                        successSummary = captured
                                        reloadTick++
                                    }
                                    .onFailure { error = userFacingMessage(it, "Could not publish the announcement.") }
                            }
                        }
                        .padding(horizontal = 4.dp, vertical = 8.dp),
                )
                if (announcements.isEmpty()) {
                    Text("No announcements yet.", color = palette.muted, fontSize = 13.sp)
                } else {
                    announcements.forEach { item ->
                        Text(item.title, color = palette.ink, fontSize = 13.sp, fontWeight = FontWeight.SemiBold, maxLines = 2)
                        if (!item.createdAt.isNullOrBlank()) {
                            Text(item.createdAt!!.take(10), color = palette.muted, fontSize = 11.sp)
                        }
                    }
                }
            }

            // Export branding.
            ManageSection(title = "Export branding", palette = palette) {
                var brandingName by remember(branding?.universityName) { mutableStateOf(branding?.universityName ?: "") }
                var brandingDoc by remember(branding?.documentTitle) { mutableStateOf(branding?.documentTitle ?: "") }
                ManageField(label = "University name", value = brandingName, onChange = { brandingName = it }, enabled = true, palette = palette)
                ManageField(label = "Document title", value = brandingDoc, onChange = { brandingDoc = it }, enabled = true, palette = palette)
                Text(
                    "Save branding",
                    color = palette.accent,
                    fontSize = 13.sp,
                    fontWeight = FontWeight.SemiBold,
                    modifier = Modifier
                        .clip(RoundedCornerShape(999.dp))
                        .clickable {
                            scope.launch {
                                error = null
                                notice = null
                                val current = branding
                                val message = saveClassBranding(
                                    clazz.id,
                                    ClassBranding(
                                        universityName = brandingName,
                                        universityShortName = current?.universityShortName,
                                        faculty = current?.faculty,
                                        department = current?.department,
                                        documentTitle = brandingDoc,
                                        productName = current?.productName ?: "StarsTask",
                                        brandingEnabled = current?.brandingEnabled ?: true,
                                        passingThreshold = current?.passingThreshold ?: 0.0,
                                    ),
                                )
                                if (message != null) {
                                    error = message
                                } else {
                                    successTitle = "Branding Saved"
                                    successSummary = brandingName
                                    reloadTick++
                                }
                            }
                        }
                        .padding(horizontal = 4.dp, vertical = 8.dp),
                )
            }

            // Lifecycle.
            ManageSection(title = "Class lifecycle", palette = palette) {
                DependencySummary(dependencies, palette)
                Text(
                    if (archived) {
                        "Restoring makes the class active again. Its members, assignments, and history stay attached."
                    } else {
                        "Archiving hides the class from discovery and stops new submissions. Members, assignments, submissions, attendance, and schedules are preserved."
                    },
                    color = palette.muted,
                    fontSize = 12.sp,
                    lineHeight = 18.sp,
                )
                Text(
                    if (archived) "Restore class" else "Archive class",
                    color = palette.accent,
                    fontSize = 13.sp,
                    fontWeight = FontWeight.SemiBold,
                    modifier = Modifier
                        .clip(RoundedCornerShape(999.dp))
                        .clickable {
                            scope.launch {
                                actionBusy = true
                                error = null
                                notice = null
                                runCatching { setClassStatus(clazz.id, if (archived) "active" else "archived") }
                                    .onSuccess {
                                        notice = if (archived) "Class restored." else "Class archived."
                                        reloadTick++
                                    }
                                    .onFailure { error = userFacingMessage(it, "Could not change the class status.") }
                                actionBusy = false
                            }
                        }
                        .padding(horizontal = 4.dp, vertical = 8.dp),
                )
            }

            // Danger zone.
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(12.dp))
                    .background(palette.riskBg)
                    .border(1.dp, palette.riskFg.copy(alpha = 0.35f), RoundedCornerShape(12.dp))
                    .padding(16.dp),
            ) {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        Icon(Lucide.Trash2, contentDescription = null, tint = palette.riskFg, modifier = Modifier.size(18.dp))
                        Text("Danger zone", color = palette.riskFg, fontSize = 15.sp, fontWeight = FontWeight.SemiBold)
                    }
                    Text(
                        "Permanent deletion is only possible when the class has no academic records. When history exists, archive it instead.",
                        color = palette.riskFg,
                        fontSize = 12.sp,
                        lineHeight = 18.sp,
                    )
                    val canDelete = dependencies?.canDelete == true
                    Text(
                        "Delete class",
                        color = if (canDelete) palette.riskFg else palette.muted,
                        fontSize = 13.sp,
                        fontWeight = FontWeight.SemiBold,
                        modifier = Modifier
                            .clip(RoundedCornerShape(999.dp))
                            .clickable(enabled = canDelete) { confirmDelete = true }
                            .padding(horizontal = 4.dp, vertical = 8.dp),
                    )
                }
            }
        }
    }

    if (confirmDelete) {
        val expected = (classCode.ifBlank { name }).trim().lowercase()
        var typed by remember { mutableStateOf("") }
        val confirmed = typed.trim().lowercase().let { it == expected || it == name.trim().lowercase() }
        val counts = dependencies
        AlertDialog(
            onDismissRequest = { confirmDelete = false },
            title = { Text("Delete ${name.ifBlank { "this class" }}?") },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Text(
                        "This class has no members or academic records, so it can be deleted permanently. There is no undo.",
                        color = palette.muted,
                        fontSize = 13.sp,
                        lineHeight = 19.sp,
                    )
                    DependencyCounts(counts, palette)
                    Text(
                        "Type ${classCode.ifBlank { name }} (or the class name) to confirm.",
                        color = palette.ink,
                        fontSize = 13.sp,
                        fontWeight = FontWeight.SemiBold,
                    )
                    OutlinedTextField(
                        value = typed,
                        onValueChange = { typed = it },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(12.dp),
                    )
                }
            },
            confirmButton = {
                TextButton(
                    enabled = confirmed && !actionBusy,
                    onClick = {
                        confirmDelete = false
                        scope.launch {
                            actionBusy = true
                            error = null
                            notice = null
                            runCatching { deleteClass(clazz.id) }
                                .onSuccess { onBack() }
                                .onFailure { error = userFacingMessage(it, "Could not delete the class.") }
                            actionBusy = false
                        }
                    },
                ) { Text("Delete class permanently") }
            },
            dismissButton = {
                TextButton(onClick = { confirmDelete = false }) { Text("Cancel") }
            },
        )
    }
    val st = successTitle
    val ss = successSummary
    if (st != null) {
        StartaskSuccessDialog(
            title = st,
            summary = ss ?: "",
            primaryLabel = "Done",
            onPrimary = { successTitle = null; successSummary = null },
            onDismiss = { successTitle = null; successSummary = null },
        )
    }
}

@Composable
private fun ManageSection(
    title: String,
    palette: id.starstask.mobile.ui.theme.MockPalette,
    content: @Composable () -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text(title, color = palette.muted, fontSize = 12.sp, fontWeight = FontWeight.SemiBold, modifier = Modifier.padding(start = 4.dp))
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(12.dp))
                .background(palette.card)
                .border(1.dp, palette.cardBorder, RoundedCornerShape(12.dp))
                .padding(16.dp),
        ) {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                content()
            }
        }
    }
}

@Composable
private fun ManageField(
    label: String,
    value: String,
    onChange: (String) -> Unit,
    enabled: Boolean,
    palette: id.starstask.mobile.ui.theme.MockPalette,
    singleLine: Boolean = true,
    minLines: Int = 1,
    placeholder: String? = null,
) {
    OutlinedTextField(
        value = value,
        onValueChange = onChange,
        enabled = enabled,
        singleLine = singleLine,
        minLines = minLines,
        label = { Text(label) },
        placeholder = placeholder?.let { { Text(it) } },
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(14.dp),
    )
}

@Composable
private fun ManageActionRow(
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    label: String,
    palette: id.starstask.mobile.ui.theme.MockPalette,
    onClick: () -> Unit,
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .heightIn(min = 52.dp)
            .padding(horizontal = 16.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Icon(icon, contentDescription = null, tint = palette.accent, modifier = Modifier.size(19.dp))
        Text(label, color = palette.ink, fontSize = 15.sp, fontWeight = FontWeight.Medium, modifier = Modifier.weight(1f))
        Icon(Lucide.ChevronRight, contentDescription = null, tint = palette.muted, modifier = Modifier.size(18.dp))
    }
}

@Composable
private fun DependencySummary(
    dependencies: ClassDependencies?,
    palette: id.starstask.mobile.ui.theme.MockPalette,
) {
    if (dependencies == null) {
        Text("Loading dependency counts…", color = palette.muted, fontSize = 12.sp)
        return
    }
    Row(horizontalArrangement = Arrangement.spacedBy(18.dp)) {
        DependencyCell("Members", dependencies.memberCount, palette)
        DependencyCell("Assignments", dependencies.assignmentCount, palette)
        DependencyCell("Submissions", dependencies.submissionCount, palette)
    }
}

@Composable
private fun DependencyCell(label: String, value: Int, palette: id.starstask.mobile.ui.theme.MockPalette) {
    Column {
        Text(value.toString(), color = palette.ink, fontSize = 20.sp, fontWeight = FontWeight.Bold)
        Text(label, color = palette.muted, fontSize = 11.sp)
    }
}

@Composable
private fun DependencyCounts(
    dependencies: ClassDependencies?,
    palette: id.starstask.mobile.ui.theme.MockPalette,
) {
    val d = dependencies ?: return
    val counts = listOf(
        "Members" to d.memberCount,
        "Assignments" to d.assignmentCount,
        "Submissions" to d.submissionCount,
        "Sessions" to d.sessionCount,
        "Attendance records" to d.attendanceCount,
        "Schedule entries" to d.scheduleCount,
        "Calendar events" to d.calendarEventCount,
        "Leave requests" to d.leaveRequestCount,
        "Subjects" to d.subjectCount,
        "Invitations" to d.invitationCount,
    ).filter { it.second > 0 }
    if (counts.isEmpty()) {
        Text("No records to lose — the class is empty.", color = palette.muted, fontSize = 12.sp)
    } else {
        counts.forEach { (label, value) ->
            Text("$value $label", color = palette.muted, fontSize = 12.sp)
        }
    }
}
