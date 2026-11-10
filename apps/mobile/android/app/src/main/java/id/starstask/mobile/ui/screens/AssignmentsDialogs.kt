package id.starstask.mobile.ui.screens

import id.starstask.mobile.ui.theme.Spacing

import id.starstask.mobile.ui.icons.Lucide

import android.app.DatePickerDialog
import android.app.TimePickerDialog
import android.net.Uri
import android.provider.OpenableColumns
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.material3.AlertDialog
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
import id.starstask.mobile.data.uploadAttachment
import id.starstask.mobile.ui.components.WebAlert
import id.starstask.mobile.ui.components.WebButton
import id.starstask.mobile.ui.components.WebButtonVariant
import id.starstask.mobile.ui.components.WebInput
import id.starstask.mobile.ui.theme.Danger
import id.starstask.mobile.ui.theme.MutedForeground
import kotlinx.coroutines.launch

// Create + review dialogs (web RequestPublicationDialog).

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CreateAssignmentDialog(
    scope: id.starstask.mobile.data.WorkspaceScope,
    userId: String,
    onDismiss: () -> Unit,
    onCreated: () -> Unit,
) {
    val context = LocalContext.current
    val coroutineScope = rememberCoroutineScope()
    var classId by remember { mutableStateOf(scope.classes.firstOrNull()?.id ?: "") }
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
        fileUris = (fileUris + uris).take(3)
    }

    LaunchedEffect(selectedClass?.id) {
        if (selectedClass != null && subjectId !in selectedClass.subjects.map { it.id }) {
            subjectId = selectedClass.subjects.firstOrNull()?.id ?: ""
        }
    }

    val publishesDirectly = selectedClass?.isAdmin == true
    val deadlineIso = remember(deadlineDate, deadlineTime) {
        if (deadlineDate.isBlank()) "" else {
            val time = deadlineTime.ifBlank { "23:59" }
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

    AlertDialog(
        onDismissRequest = { if (!saving) onDismiss() },
        title = { Text(if (scope.managesAnyClass) "Create Assignment" else "Request Task Publication") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(Spacing.Lg)) {
                DropdownTextField(label = "Class", options = scope.classes.map { it.id to it.name }, selected = classId, onSelect = { classId = it })
                Text(if (publishesDirectly) "You manage this class" else "You are a member of this class", color = MutedForeground, style = MaterialTheme.typography.labelSmall)
                DropdownTextField(label = "Course", options = selectedClass?.subjects?.map { it.id to it.name } ?: emptyList(), selected = subjectId, onSelect = { subjectId = it })
                if (fieldErrors["subjectId"] != null) Text(fieldErrors["subjectId"]!!, color = Danger, style = MaterialTheme.typography.labelSmall)
                WebInput(value = title, onValueChange = { title = it }, label = "Title *", singleLine = false)
                if (fieldErrors["title"] != null) Text(fieldErrors["title"]!!, color = Danger, style = MaterialTheme.typography.labelSmall)
                WebInput(value = description, onValueChange = { description = it }, label = "Description *", singleLine = false)
                if (fieldErrors["description"] != null) Text(fieldErrors["description"]!!, color = Danger, style = MaterialTheme.typography.labelSmall)
                Row(horizontalArrangement = Arrangement.spacedBy(Spacing.Md)) {
                    WebButton(label = if (deadlineDate.isEmpty()) "Deadline Date" else deadlineDate, onClick = { pickDate() }, variant = WebButtonVariant.SECONDARY)
                    WebButton(label = if (deadlineTime.isEmpty()) "Deadline Time" else deadlineTime, onClick = { pickTime() }, variant = WebButtonVariant.SECONDARY)
                }
                if (fieldErrors["deadline"] != null) Text(fieldErrors["deadline"]!!, color = Danger, style = MaterialTheme.typography.labelSmall)
                WebButton(label = "Add files (${fileUris.size}/3)", onClick = { picker.launch(arrayOf("application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/vnd.openxmlformats-officedocument.presentationml.presentation", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "image/png", "image/jpeg")) }, variant = WebButtonVariant.SECONDARY)
                fileUris.forEach { uri ->
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Spacing.Sm)) {
                        Text(uriName(context, uri), modifier = Modifier.weight(1f), maxLines = 1, overflow = TextOverflow.Ellipsis, style = MaterialTheme.typography.labelSmall, color = MutedForeground)
                        IconButton(onClick = { fileUris = fileUris - uri }) { Icon(Lucide.X, contentDescription = "Remove") }
                    }
                }
                if (error != null) WebAlert(message = error!!)
                Text(if (publishesDirectly) "This assignment will be published directly to the class (as class admin)." else "Your assignment will be submitted for administrator review.", color = MutedForeground, style = MaterialTheme.typography.labelSmall)
            }
        },
        confirmButton = {
            WebButton(
                label = if (saving) "Saving…" else if (publishesDirectly) "Publish Assignment" else "Request Publication",
                onClick = {
                    if (saving) return@WebButton
                    val nextErrors = mutableMapOf<String, String>()
                    if (title.trim().length < 3) nextErrors["title"] = "Title must be at least 3 characters"
                    if (description.trim().length < 10) nextErrors["description"] = "Description must be at least 10 characters"
                    if (subjectId.isBlank()) nextErrors["subjectId"] = "Choose a course"
                    if (deadlineTime.isNotBlank() && deadlineDate.isBlank()) nextErrors["deadline"] = "Choose a deadline date first"
                    fieldErrors = nextErrors
                    if (nextErrors.isNotEmpty()) return@WebButton
                    error = null
                    saving = true
                    coroutineScope.launch {
                        try {
                            val id = createWorkspaceAssignment(userId = userId, scope = scope, classId = classId, subjectId = subjectId, title = title, description = description, deadlineIso = deadlineIso.ifBlank { null })
                            for (uri in fileUris) {
                                val outcome = uploadAttachment(context, userId, id, uri)
                                if (!outcome.ok) throw IllegalStateException(outcome.message ?: "Upload failed.")
                            }
                            onCreated()
                        } catch (e: Exception) {
                            error = e.message ?: "The submission could not be saved. Try again."
                        } finally {
                            saving = false
                        }
                    }
                },
                enabled = !saving && subjectId.isNotBlank(),
            )
        },
        dismissButton = {
            WebButton(label = "Cancel", onClick = { if (!saving) onDismiss() }, variant = WebButtonVariant.SECONDARY, enabled = !saving)
        },
    )
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DropdownTextField(label: String, options: List<Pair<String, String>>, selected: String, onSelect: (String) -> Unit) {
    var expanded by remember { mutableStateOf(false) }
    val current = options.firstOrNull { it.first == selected }?.second ?: ""
    ExposedDropdownMenuBox(expanded = expanded, onExpandedChange = { expanded = !expanded }) {
        OutlinedTextField(value = current, onValueChange = {}, readOnly = true, label = { Text(label) }, trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = expanded) }, modifier = Modifier.fillMaxWidth().menuAnchor(ExposedDropdownMenuAnchorType.PrimaryNotEditable, true))
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
                error = e.message ?: "The decision could not be saved. Try again."
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
