package id.starstask.mobile.ui.screens

import id.starstask.mobile.ui.theme.Spacing

import android.content.Intent
import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.AlertDialog
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
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import id.starstask.mobile.data.ASSIGNMENT_REPORT_REASONS
import id.starstask.mobile.data.Assignment
import id.starstask.mobile.data.AssignmentDetail
import id.starstask.mobile.data.AssignmentEditInput
import id.starstask.mobile.data.AssignmentRevision
import id.starstask.mobile.data.deleteAssignmentRecord
import id.starstask.mobile.data.formatTime
import id.starstask.mobile.data.getWorkspaceAssignmentDetail
import id.starstask.mobile.data.isAssignmentSaved
import id.starstask.mobile.data.listAssignmentRevisions
import id.starstask.mobile.data.listAttachments
import id.starstask.mobile.data.loadCompletionIds
import id.starstask.mobile.data.loadMyAssignmentReport
import id.starstask.mobile.data.openAttachment
import id.starstask.mobile.data.reportAssignment
import id.starstask.mobile.data.saveAssignment
import id.starstask.mobile.data.setAssignmentCompletion
import id.starstask.mobile.data.updateAssignmentRecord
import id.starstask.mobile.data.unsaveAssignment
import id.starstask.mobile.data.uploadAttachment
import id.starstask.mobile.ui.components.BadgeVariant
import id.starstask.mobile.ui.components.DeadlineBadge
import id.starstask.mobile.ui.components.StarsTaskBadge
import id.starstask.mobile.ui.components.StatusBadge
import id.starstask.mobile.ui.components.WebAlert
import id.starstask.mobile.ui.components.WebButton
import id.starstask.mobile.ui.components.WebButtonVariant
import id.starstask.mobile.ui.components.WebInput
import id.starstask.mobile.ui.theme.Accent
import id.starstask.mobile.ui.theme.Danger
import id.starstask.mobile.ui.theme.Foreground
import id.starstask.mobile.ui.theme.MutedForeground
import id.starstask.mobile.ui.theme.Surface
import kotlinx.coroutines.launch

fun contentTypeLabel(contentType: String?): String = when (contentType) {
    "class_announcement" -> "Class announcement"
    "lecturer_assignment" -> "Lecturer assignment"
    else -> contentType ?: ""
}

fun describeRevision(revision: AssignmentRevision): String = when (revision.changeKind) {
    "created" -> "Published"
    "moderated" -> "Status changed"
    else -> {
        val labels = mapOf(
            "title" to "title",
            "description" to "description",
            "deadline" to "deadline",
            "status" to "status",
            "course_id" to "course",
            "class_id" to "class",
        )
        val fields = revision.changedFields.map { labels[it] ?: it }.filter { it.isNotBlank() }
        if (fields.isNotEmpty()) "Updated ${fields.joinToString(", ")}" else "Updated"
    }
}

@Composable
fun ReportDialog(
    assignmentId: String,
    onDismiss: () -> Unit,
    onFiled: () -> Unit,
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var reason by remember { mutableStateOf(ASSIGNMENT_REPORT_REASONS.firstOrNull()?.first ?: "wrong_deadline") }
    var note by remember { mutableStateOf("") }
    var filing by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }

    androidx.compose.material3.AlertDialog(
        onDismissRequest = { if (!filing) onDismiss() },
        title = { Text("Report a problem") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(Spacing.Md)) {
                Text(
                    "Tell us what is wrong with the brief. Reports are visible to the class admin and platform admins, not to other students.",
                    style = MaterialTheme.typography.bodySmall,
                    color = MutedForeground,
                )
                WebInput(value = reason, onValueChange = { reason = it }, label = "What is wrong?", enabled = !filing)
                WebInput(
                    value = note,
                    onValueChange = { note = it },
                    label = "Details (optional)",
                    singleLine = false,
                    enabled = !filing,
                    minLines = 4,
                )
                if (error != null) WebAlert(message = error!!)
            }
        },
        confirmButton = {
            WebButton(
                label = if (filing) "Sending…" else "Send report",
                onClick = {
                    if (filing) return@WebButton
                    filing = true
                    error = null
                    scope.launch {
                        try {
                            reportAssignment(
                                assignmentId,
                                reason,
                                note.trim().ifBlank { null },
                            )
                            onFiled()
                        } catch (e: Exception) {
                            error = e.message ?: "Could not send the report."
                        } finally {
                            filing = false
                        }
                    }
                },
                enabled = !filing,
            )
        },
        dismissButton = {
            WebButton(label = "Cancel", onClick = { if (!filing) onDismiss() }, variant = WebButtonVariant.GHOST)
        },
    )
}
