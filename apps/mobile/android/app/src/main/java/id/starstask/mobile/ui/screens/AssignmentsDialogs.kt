package id.starstask.mobile.ui.screens

import id.starstask.mobile.ui.theme.Spacing

import id.starstask.mobile.ui.icons.Lucide

import android.app.DatePickerDialog
import android.app.TimePickerDialog
import android.net.Uri
import android.provider.OpenableColumns
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.size
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Surface
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExposedDropdownMenuAnchorType
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.ExposedDropdownMenuDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
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
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import id.starstask.mobile.data.WorkspaceRequest
import id.starstask.mobile.data.createWorkspaceAssignment
import id.starstask.mobile.data.reviewWorkspaceRequest
import id.starstask.mobile.data.userFacingMessage
import id.starstask.mobile.ui.components.WebAlert
import id.starstask.mobile.ui.components.WebButton
import id.starstask.mobile.ui.components.WebButtonVariant
import id.starstask.mobile.ui.components.WebInput
import id.starstask.mobile.ui.theme.Danger
import id.starstask.mobile.ui.theme.MutedForeground
import kotlinx.coroutines.launch

// Create + review dialogs (web RequestPublicationDialog).

private const val MAX_ASSIGNMENT_FILES = 3
private const val TITLE_MAX = 200
private const val DESCRIPTION_MAX = 20_000
private const val DEADLINE_DEFAULT_TIME = "23:59"

@OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class)
@Composable
fun CreateAssignmentDialog(
    scope: id.starstask.mobile.data.WorkspaceScope,
    userId: String,
    onDismiss: () -> Unit,
    onCreated: () -> Unit,
    initialClassId: String? = null,
) {
    val context = LocalContext.current
    val coroutineScope = rememberCoroutineScope()
    var classId by remember {
        mutableStateOf(
            initialClassId?.takeIf { target -> scope.classes.any { it.id == target } }
                ?: scope.classes.firstOrNull()?.id
                ?: "",
        )
    }
    val selectedClass = scope.classes.firstOrNull { it.id == classId } ?: scope.classes.firstOrNull()
    var subjectId by remember { mutableStateOf(selectedClass?.subjects?.firstOrNull()?.id ?: "") }
    var title by remember { mutableStateOf("") }
    var description by remember { mutableStateOf("") }
    var deadlineDate by remember { mutableStateOf("") }
    var deadlineTime by remember { mutableStateOf("") }
    var fileUris by remember { mutableStateOf<List<Uri>>(emptyList()) }
    var error by remember { mutableStateOf<String?>(null) }
    var fieldErrors by remember { mutableStateOf<Map<String, String>>(emptyMap()) }
    var saving by remember { mutableStateOf(false) }

    val picker = rememberLauncherForActivityResult(ActivityResultContracts.OpenMultipleDocuments()) { uris ->
        val roomLeft = MAX_ASSIGNMENT_FILES - fileUris.size
        if (uris.isEmpty()) return@rememberLauncherForActivityResult
        if (roomLeft <= 0) {
            error = "Up to $MAX_ASSIGNMENT_FILES files only."
            return@rememberLauncherForActivityResult
        }
        val accepted = mutableListOf<Uri>()
        val rejected = mutableListOf<String>()
        for (uri in uris.take(roomLeft)) {
            val name = uriName(context, uri)
            val extension = id.starstask.mobile.data.fileExtension(name)
            if (extension in id.starstask.mobile.data.ALLOWED_EXTENSIONS) {
                accepted += uri
            } else {
                rejected += if (extension.isEmpty()) "unknown" else extension
            }
        }
        val overflow = uris.size - uris.take(roomLeft).size
        fileUris = fileUris + accepted
        val messages = mutableListOf<String>()
        if (overflow > 0) messages += "Only the first $roomLeft files were added (max $MAX_ASSIGNMENT_FILES)."
        if (rejected.isNotEmpty()) messages += "Unsupported: " + rejected.toSet().sorted().joinToString(", ") { ".$it" }
        error = if (messages.isEmpty()) null else messages.joinToString(" ")
    }

    LaunchedEffect(selectedClass?.id) {
        if (selectedClass != null && subjectId !in selectedClass.subjects.map { it.id }) {
            subjectId = selectedClass.subjects.firstOrNull()?.id ?: ""
        }
    }

    val publishesDirectly = selectedClass?.isAdmin == true
    val deadlineIso = remember(deadlineDate, deadlineTime) {
        if (deadlineDate.isBlank()) "" else {
            val time = deadlineTime.ifBlank { DEADLINE_DEFAULT_TIME }
            val local = java.time.LocalDateTime.parse("$deadlineDate" + "T" + time)
            local.atZone(java.time.ZoneId.of("Asia/Jakarta")).toOffsetDateTime().toString()
        }
    }

    fun pickDate() {
        val (y, m, d) = if (deadlineDate.isNotBlank()) {
            val p = deadlineDate.split("-")
            Triple(p[0].toIntOrNull() ?: 2026, (p.getOrNull(1)?.toIntOrNull() ?: 1) - 1, p.getOrNull(2)?.toIntOrNull() ?: 1)
        } else {
            val now = java.time.LocalDate.now(java.time.ZoneId.of("Asia/Jakarta"))
            Triple(now.year, now.monthValue - 1, now.dayOfMonth)
        }
        DatePickerDialog(context, { _, yy, mm, dd -> deadlineDate = "%04d-%02d-%02d".format(yy, mm + 1, dd) }, y, m, d).show()
    }

    fun pickTime() {
        val (h, mi) = if (deadlineTime.isNotBlank()) {
            val p = deadlineTime.split(":")
            Pair(p[0].toIntOrNull() ?: 23, p.getOrNull(1)?.toIntOrNull() ?: 59)
        } else Pair(23, 59)
        TimePickerDialog(context, { _, hh, mm -> deadlineTime = "%02d:%02d".format(hh, mm) }, h, mi, true).show()
    }

    fun submit() {
        if (saving) return
        val nextErrors = mutableMapOf<String, String>()
        if (title.trim().length < 3) nextErrors["title"] = "Title must be at least 3 characters"
        if (title.trim().length > TITLE_MAX) nextErrors["title"] = "Title must be at most $TITLE_MAX characters"
        if (description.trim().length < 10) nextErrors["description"] = "Description must be at least 10 characters"
        if (description.trim().length > DESCRIPTION_MAX) nextErrors["description"] = "Description is too long"
        if (subjectId.isBlank()) nextErrors["subjectId"] = "Choose a course"
        if (deadlineTime.isNotBlank() && deadlineDate.isBlank()) nextErrors["deadline"] = "Choose a deadline date first"
        fieldErrors = nextErrors
        if (nextErrors.isNotEmpty()) return
        error = null
        saving = true
        coroutineScope.launch {
            try {
                createWorkspaceAssignment(
                    context = context,
                    userId = userId,
                    scope = scope,
                    classId = classId,
                    subjectId = subjectId,
                    title = title,
                    description = description,
                    deadlineIso = deadlineIso.ifBlank { null },
                    fileUris = fileUris,
                )
                onCreated()
            } catch (e: Exception) {
                error = userFacingMessage(e, "The submission could not be saved. Try again.")
            } finally {
                saving = false
            }
        }
    }

    androidx.compose.ui.window.Dialog(
        onDismissRequest = { if (!saving) onDismiss() },
        properties = androidx.compose.ui.window.DialogProperties(usePlatformDefaultWidth = false),
    ) {
        androidx.compose.material3.Surface(
            modifier = Modifier.fillMaxSize(),
            color = id.starstask.mobile.ui.theme.Background,
        ) {
            Column(modifier = Modifier.fillMaxSize()) {
                CreateDialogTopBar(
                    title = if (publishesDirectly) "Create Assignment" else "Request Task Publication",
                    subtitle = if (publishesDirectly) "Publish a new academic task to your class." else "Submit a task for a class admin to review and publish.",
                    saving = saving,
                    onClose = { if (!saving) onDismiss() },
                )
                Column(
                    modifier = Modifier
                        .weight(1f)
                        .fillMaxWidth()
                        .verticalScroll(rememberScrollState())
                        .padding(horizontal = Spacing.Section, vertical = Spacing.Section),
                    verticalArrangement = Arrangement.spacedBy(Spacing.Block),
                ) {
                    if (scope.classes.isEmpty()) {
                        WebAlert(
                            message = "Join a class first — publication requests are always tied to a class.",
                            variant = id.starstask.mobile.ui.components.WebAlertVariant.INFO,
                        )
                    } else {
                        CreateDialogSection(
                            number = 1,
                            heading = "Class Information",
                            supporting = "Select the class and course for this assignment.",
                        ) {
                            DropdownTextField(
                                label = "Class",
                                options = scope.classes.map { it.id to (it.name + (it.classCode?.let { code -> " ($code)" } ?: "")) },
                                selected = classId,
                                onSelect = { classId = it },
                                enabled = !saving,
                            )
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(Spacing.Xs),
                            ) {
                                Icon(
                                    if (publishesDirectly) Lucide.ShieldCheck else Lucide.Info,
                                    contentDescription = null,
                                    tint = if (publishesDirectly) id.starstask.mobile.ui.theme.Success else id.starstask.mobile.ui.theme.Accent,
                                    modifier = Modifier.size(14.dp),
                                )
                                Text(
                                    if (publishesDirectly) "You manage this class" else "You are a member of this class",
                                    color = if (publishesDirectly) id.starstask.mobile.ui.theme.Success else id.starstask.mobile.ui.theme.Accent,
                                    style = MaterialTheme.typography.labelMedium,
                                )
                            }
                            DropdownTextField(
                                label = "Course",
                                options = selectedClass?.subjects?.map { it.id to (it.name + (it.code?.let { code -> " ($code)" } ?: "")) } ?: emptyList(),
                                selected = subjectId,
                                onSelect = { subjectId = it },
                                enabled = !saving,
                            )
                            if (fieldErrors["subjectId"] != null) Text(fieldErrors["subjectId"]!!, color = Danger, style = MaterialTheme.typography.labelSmall)
                            if (selectedClass != null && selectedClass.subjects.isEmpty()) {
                                Text(
                                    "This class has no courses yet. Ask an admin to add one before submitting.",
                                    color = Danger,
                                    style = MaterialTheme.typography.labelSmall,
                                )
                            }
                        }

                        CreateDialogSection(
                            number = 2,
                            heading = "Assignment Details",
                            supporting = "Provide the title and description for your assignment.",
                        ) {
                            Column(verticalArrangement = Arrangement.spacedBy(Spacing.Xs)) {
                                WebInput(
                                    value = title,
                                    onValueChange = { if (it.length <= TITLE_MAX) title = it },
                                    label = "Title *",
                                    placeholder = "e.g. Final Project Web Programming",
                                    singleLine = true,
                                    minLines = 1,
                                    isError = fieldErrors["title"] != null,
                                    enabled = !saving,
                                )
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                    verticalAlignment = Alignment.CenterVertically,
                                ) {
                                    fieldErrors["title"]?.let { Text(it, color = Danger, style = MaterialTheme.typography.labelSmall) }
                                    Text("${title.length}/$TITLE_MAX", color = MutedForeground, style = MaterialTheme.typography.labelSmall, modifier = Modifier.padding(start = Spacing.Md))
                                }
                            }
                            Column(verticalArrangement = Arrangement.spacedBy(Spacing.Xs)) {
                                WebInput(
                                    value = description,
                                    onValueChange = { if (it.length <= DESCRIPTION_MAX) description = it },
                                    label = "Description *",
                                    placeholder = "Describe the assignment requirements, objectives, and additional instructions…",
                                    singleLine = false,
                                    minLines = 4,
                                    isError = fieldErrors["description"] != null,
                                    enabled = !saving,
                                )
                                Row(
                                    modifier = Modifier.fillMaxWidth(),
                                    horizontalArrangement = Arrangement.SpaceBetween,
                                    verticalAlignment = Alignment.CenterVertically,
                                ) {
                                    fieldErrors["description"]?.let { Text(it, color = Danger, style = MaterialTheme.typography.labelSmall) }
                                    Text("${description.length}/$DESCRIPTION_MAX", color = MutedForeground, style = MaterialTheme.typography.labelSmall, modifier = Modifier.padding(start = Spacing.Md))
                                }
                            }
                        }

                        CreateDialogSection(
                            number = 3,
                            heading = "Schedule & Attachments",
                            supporting = "Set the deadline and add supporting files (optional).",
                        ) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.spacedBy(Spacing.Md),
                            ) {
                                WebButton(
                                    label = if (deadlineDate.isEmpty()) "Select date" else "Date: $deadlineDate",
                                    onClick = { pickDate() },
                                    variant = WebButtonVariant.SECONDARY,
                                    icon = Lucide.CalendarDays,
                                    modifier = Modifier.weight(1f),
                                    enabled = !saving,
                                )
                                WebButton(
                                    label = if (deadlineTime.isEmpty()) "Time (optional)" else "Time: $deadlineTime",
                                    onClick = { pickTime() },
                                    variant = WebButtonVariant.SECONDARY,
                                    icon = Lucide.Clock,
                                    modifier = Modifier.weight(1f),
                                    enabled = !saving,
                                )
                            }
                            Text(
                                "If you only pick a date, the deadline is $DEADLINE_DEFAULT_TIME (Asia/Jakarta).",
                                color = MutedForeground,
                                style = MaterialTheme.typography.labelSmall,
                            )
                            if (fieldErrors["deadline"] != null) Text(fieldErrors["deadline"]!!, color = Danger, style = MaterialTheme.typography.labelSmall)
                            CreateFileDropzone(
                                fileUris = fileUris,
                                saving = saving,
                                onPick = { picker.launch(arrayOf("*/*")) },
                                onRemove = { uri -> fileUris = fileUris - uri },
                            )
                        }
                    }

                    if (error != null) WebAlert(message = error!!)
                }

                CreateDialogFooter(
                    note = if (publishesDirectly) "This assignment will be published directly to the class. All members will be notified." else "Your assignment will be submitted for the class admin to review and publish.",
                    primaryLabel = if (publishesDirectly) "Publish Assignment" else "Request Publication",
                    saving = saving,
                    enabled = !saving && subjectId.isNotBlank() && scope.classes.isNotEmpty(),
                    onCancel = { if (!saving) onDismiss() },
                    onConfirm = { submit() },
                )
            }
        }
    }
}

@Composable
private fun CreateDialogTopBar(title: String, subtitle: String, saving: Boolean, onClose: () -> Unit) {
    Column(modifier = Modifier.fillMaxWidth().padding(vertical = Spacing.Section)) {
        androidx.compose.material3.HorizontalDivider(thickness = 1.dp, color = id.starstask.mobile.ui.theme.Border)
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = Spacing.Section, vertical = Spacing.Section),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Spacing.Md),
        ) {
            IconButton(onClick = onClose, enabled = !saving) { Icon(Lucide.X, contentDescription = "Close") }
            Surface(
                shape = RoundedCornerShape(12.dp),
                color = id.starstask.mobile.ui.theme.AccentSoft,
                modifier = Modifier.size(44.dp),
            ) {
                Box(contentAlignment = Alignment.Center) {
                    Icon(Lucide.FilePlus2, contentDescription = null, tint = id.starstask.mobile.ui.theme.Accent)
                }
            }
            Column(modifier = Modifier.weight(1f)) {
                Text(title, color = id.starstask.mobile.ui.theme.Foreground, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
                Text(subtitle, color = MutedForeground, style = MaterialTheme.typography.bodySmall)
            }
        }
        androidx.compose.material3.HorizontalDivider(thickness = 1.dp, color = id.starstask.mobile.ui.theme.Border)
    }
}

@Composable
private fun CreateDialogSection(
    number: Int,
    heading: String,
    supporting: String,
    content: @Composable ColumnScope.() -> Unit,
) {
    Column(modifier = Modifier.fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(Spacing.Md)) {
        Row(verticalAlignment = Alignment.Top, horizontalArrangement = Arrangement.spacedBy(Spacing.Md)) {
            Box(
                modifier = Modifier
                    .size(28.dp)
                    .background(id.starstask.mobile.ui.theme.Accent, RoundedCornerShape(999.dp)),
                contentAlignment = Alignment.Center,
            ) {
                Text("$number", color = id.starstask.mobile.ui.theme.Surface, style = MaterialTheme.typography.labelMedium, fontWeight = FontWeight.SemiBold)
            }
            Column {
                Text(heading, color = id.starstask.mobile.ui.theme.Foreground, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold)
                Text(supporting, color = MutedForeground, style = MaterialTheme.typography.bodySmall)
            }
        }
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .background(id.starstask.mobile.ui.theme.SoftFill, RoundedCornerShape(12.dp))
                .padding(Spacing.Section),
            verticalArrangement = Arrangement.spacedBy(Spacing.Md),
            content = content,
        )
    }
}

@Composable
private fun CreateFileDropzone(
    fileUris: List<Uri>,
    saving: Boolean,
    onPick: () -> Unit,
    onRemove: (Uri) -> Unit,
) {
    val context = LocalContext.current
    val atLimit = fileUris.size >= MAX_ASSIGNMENT_FILES
    val allowedLabel = id.starstask.mobile.data.attachmentAllowedExtensionsLabel()
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.Md)) {
        Surface(
            shape = RoundedCornerShape(12.dp),
            color = if (atLimit) id.starstask.mobile.ui.theme.Subtle else id.starstask.mobile.ui.theme.Surface,
            border = BorderStroke(1.dp, id.starstask.mobile.ui.theme.Border),
            modifier = Modifier
                .fillMaxWidth()
                .clickable(enabled = !saving && !atLimit) { onPick() },
        ) {
            Column(
                modifier = Modifier.padding(horizontal = Spacing.Section, vertical = Spacing.Block),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(Spacing.Xs),
            ) {
                Box(
                    modifier = Modifier
                        .size(40.dp)
                        .background(id.starstask.mobile.ui.theme.AccentSoft, RoundedCornerShape(999.dp)),
                    contentAlignment = Alignment.Center,
                ) {
                    Icon(Lucide.CloudUpload, contentDescription = null, tint = id.starstask.mobile.ui.theme.Accent, modifier = Modifier.size(18.dp))
                }
                Text(
                    if (atLimit) "Attachment limit reached" else "Add files (${fileUris.size}/$MAX_ASSIGNMENT_FILES)",
                    color = id.starstask.mobile.ui.theme.Foreground,
                    style = MaterialTheme.typography.bodyMedium,
                    fontWeight = FontWeight.Medium,
                )
                Text(
                    "$allowedLabel · up to 10 MB each",
                    color = MutedForeground,
                    style = MaterialTheme.typography.labelSmall,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis,
                )
            }
        }
        fileUris.forEach { uri ->
            val name = uriName(context, uri)
            val isImage = id.starstask.mobile.data.fileExtension(name) in setOf("png", "jpg", "jpeg")
            val sizeLabel = id.starstask.mobile.data.queryFileSize(context, uri)?.let { id.starstask.mobile.data.formatFileSize(it) } ?: ""
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(id.starstask.mobile.ui.theme.Surface, RoundedCornerShape(8.dp))
                    .border(0.5.dp, id.starstask.mobile.ui.theme.Border, RoundedCornerShape(8.dp))
                    .padding(horizontal = Spacing.Md, vertical = Spacing.Md),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(Spacing.Md),
            ) {
                Icon(if (isImage) Lucide.FileImage else Lucide.FileText, contentDescription = null, tint = MutedForeground)
                Column(modifier = Modifier.weight(1f)) {
                    Text(name, color = id.starstask.mobile.ui.theme.Foreground, style = MaterialTheme.typography.bodySmall, maxLines = 1, overflow = TextOverflow.Ellipsis)
                    if (sizeLabel.isNotEmpty()) Text(sizeLabel, color = MutedForeground, style = MaterialTheme.typography.labelSmall)
                }
                IconButton(onClick = { onRemove(uri) }, enabled = !saving) { Icon(Lucide.X, contentDescription = "Remove") }
            }
        }
    }
}

@Composable
private fun CreateDialogFooter(
    note: String,
    primaryLabel: String,
    saving: Boolean,
    enabled: Boolean,
    onCancel: () -> Unit,
    onConfirm: () -> Unit,
) {
    Column {
        androidx.compose.material3.HorizontalDivider(thickness = 1.dp, color = id.starstask.mobile.ui.theme.Border)
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .background(id.starstask.mobile.ui.theme.Surface)
                .padding(horizontal = Spacing.Section, vertical = Spacing.Section),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Spacing.Md),
        ) {
            Row(
                modifier = Modifier.weight(1f),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(Spacing.Xs),
            ) {
                Icon(Lucide.Info, contentDescription = null, tint = MutedForeground, modifier = Modifier.size(14.dp))
                Text(note, color = MutedForeground, style = MaterialTheme.typography.labelSmall)
            }
            WebButton(label = "Cancel", onClick = onCancel, variant = WebButtonVariant.SECONDARY, enabled = !saving)
            WebButton(label = if (saving) "Saving…" else primaryLabel, onClick = onConfirm, variant = WebButtonVariant.PRIMARY, enabled = enabled, icon = Lucide.Send)
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DropdownTextField(label: String, options: List<Pair<String, String>>, selected: String, onSelect: (String) -> Unit, enabled: Boolean = true) {
    var expanded by remember { mutableStateOf(false) }
    val current = options.firstOrNull { it.first == selected }?.second ?: ""
    ExposedDropdownMenuBox(expanded = expanded, onExpandedChange = { expanded = !expanded }) {
        OutlinedTextField(value = current, onValueChange = {}, readOnly = true, enabled = enabled, label = { Text(label) }, trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = expanded) }, modifier = Modifier.fillMaxWidth().menuAnchor(ExposedDropdownMenuAnchorType.PrimaryNotEditable, enabled))
        ExposedDropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }) {
            options.forEach { (value, text) -> DropdownMenuItem(text = { Text(text) }, onClick = { onSelect(value); expanded = false }) }
        }
    }
}

@Composable
fun ReviewRequestDialog(request: WorkspaceRequest, onDismiss: () -> Unit, onReviewed: () -> Unit) {
    val coroutineScope = rememberCoroutineScope()
    var reason by remember { mutableStateOf("") }
    var error by remember { mutableStateOf<String?>(null) }
    var busy by remember { mutableStateOf<String?>(null) }

    fun decide(decision: String) {
        if (busy != null) return
        if (decision != "approved" && reason.trim().length < 3) {
            error = "Give the student a short note (at least 3 characters)."
            return
        }
        error = null
        busy = decision
        coroutineScope.launch {
            try {
                reviewWorkspaceRequest(request.id, decision, reason.trim().ifBlank { null })
                onReviewed()
            } catch (e: Exception) {
                error = userFacingMessage(e, "The decision could not be saved. Try again.")
            } finally {
                busy = null
            }
        }
    }

    AlertDialog(
        onDismissRequest = { if (busy == null) onDismiss() },
        title = { Text("Review: ${request.title}") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(Spacing.Lg)) {
                Text("${request.courseName} · ${request.className}", color = MutedForeground, style = MaterialTheme.typography.bodySmall)
                WebInput(value = reason, onValueChange = { reason = it }, label = "Reason (required for reject / revision)", singleLine = false)
                if (error != null) WebAlert(message = error!!)
            }
        },
        confirmButton = {
            Row(horizontalArrangement = Arrangement.spacedBy(Spacing.Md)) {
                WebButton(label = if (busy == "approved") "Saving…" else "Approve & Publish", onClick = { decide("approved") }, enabled = busy == null)
                WebButton(label = if (busy == "rejected") "Saving…" else "Reject", onClick = { decide("rejected") }, variant = WebButtonVariant.SECONDARY, enabled = busy == null)
                WebButton(label = if (busy == "revision") "Saving…" else "Request revision", onClick = { decide("revision") }, variant = WebButtonVariant.SECONDARY, enabled = busy == null)
            }
        },
        dismissButton = {
            WebButton(label = "Close", onClick = onDismiss, variant = WebButtonVariant.SECONDARY, enabled = busy == null)
        },
    )
}

fun uriName(context: android.content.Context, uri: Uri): String {
    return try {
        context.contentResolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)?.use { c ->
            if (c.moveToFirst()) c.getString(0) else uri.lastPathSegment ?: "file"
        } ?: uri.lastPathSegment ?: "file"
    } catch (_: Exception) {
        uri.lastPathSegment ?: "file"
    }
}
