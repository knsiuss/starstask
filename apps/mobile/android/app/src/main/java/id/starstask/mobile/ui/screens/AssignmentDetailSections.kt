package id.starstask.mobile.ui.screens

import id.starstask.mobile.ui.theme.Spacing

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import id.starstask.mobile.data.AssignmentRevision
import id.starstask.mobile.data.AttachmentRef
import id.starstask.mobile.data.deleteAssignmentRecord
import id.starstask.mobile.data.deleteAttachment
import id.starstask.mobile.data.formatTime
import id.starstask.mobile.data.openAttachment
import id.starstask.mobile.data.renameAttachment
import id.starstask.mobile.ui.components.WebButton
import id.starstask.mobile.ui.components.WebButtonVariant
import id.starstask.mobile.ui.components.WebCard
import id.starstask.mobile.ui.components.WebSectionTitle
import id.starstask.mobile.ui.theme.Accent
import id.starstask.mobile.ui.theme.Danger
import id.starstask.mobile.ui.theme.Foreground
import id.starstask.mobile.ui.theme.MutedForeground
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.launch

// Owner edit/delete + attachments + history (web assignment detail). Extracted to keep detail <300 lines.

@Composable
fun AssignmentOwnerActions(
    userId: String,
    assignmentId: String,
    deleting: Boolean,
    onDeletingChange: (Boolean) -> Unit,
    onEdit: () -> Unit,
    onDeleted: () -> Unit,
    onMessage: (String) -> Unit,
    scope: CoroutineScope,
) {
    WebButton(label = "Edit assignment", onClick = onEdit)
    WebButton(
        label = if (deleting) "Deleting…" else "Delete",
        variant = WebButtonVariant.DANGER,
        onClick = {
            onDeletingChange(true)
            scope.launch {
                try {
                    val ok = deleteAssignmentRecord(userId, assignmentId)
                    if (ok) onDeleted() else onMessage("Could not delete.")
                } catch (_: Exception) {
                    onMessage("Could not delete. Try again.")
                } finally {
                    onDeletingChange(false)
                }
            }
        },
        enabled = !deleting,
    )
}

@Composable
fun AssignmentAttachmentsSection(
    attachments: List<AttachmentRef>,
    busy: Boolean,
    onAttach: () -> Unit,
    context: android.content.Context,
    onMessage: (String) -> Unit,
    scope: CoroutineScope,
    onChanged: () -> Unit = {},
) {
    if (busy) {
        WebButton(label = "Uploading…", onClick = onAttach, enabled = false)
    } else {
        WebButton(label = "Attach file", onClick = onAttach)
    }
    WebSectionTitle("Attachments (${attachments.size})")
    if (attachments.isNotEmpty()) {
        Text(
            "Images and PDFs preview here. Download links expire after 15 minutes; files are checked for type and size on upload.",
            color = MutedForeground,
            style = MaterialTheme.typography.labelSmall,
        )
    }
    var renaming by remember { mutableStateOf<AttachmentRef?>(null) }
    var deleting by remember { mutableStateOf<AttachmentRef?>(null) }
    var draftName by remember { mutableStateOf("") }

    LazyColumn(verticalArrangement = Arrangement.spacedBy(Spacing.Md)) {
        items(attachments, key = { it.id }) { attachment ->
            WebCard {
                Text(attachment.filename, color = Foreground)
                Row(horizontalArrangement = Arrangement.spacedBy(Spacing.Md)) {
                    WebButton(
                        label = "Open",
                        variant = WebButtonVariant.SECONDARY,
                        onClick = {
                            scope.launch {
                                runCatching { openAttachment(context, attachment.storagePath) }
                                    .onFailure { onMessage("Could not open the attachment.") }
                            }
                        },
                    )
                    WebButton(
                        label = "Rename",
                        variant = WebButtonVariant.GHOST,
                        onClick = { renaming = attachment; draftName = attachment.filename },
                    )
                    WebButton(
                        label = "Delete",
                        variant = WebButtonVariant.GHOST,
                        onClick = { deleting = attachment },
                    )
                }
            }
        }
    }

    renaming?.let { target ->
        AlertDialog(
            onDismissRequest = { renaming = null },
            title = { Text("Rename attachment") },
            text = {
                id.starstask.mobile.ui.components.WebInput(
                    value = draftName,
                    onValueChange = { draftName = it },
                    label = "File name",
                )
            },
            confirmButton = {
                Text(
                    "Save",
                    color = Accent,
                    modifier = Modifier.clickable {
                        val name = draftName
                        renaming = null
                        scope.launch {
                            val ok = renameAttachment(context, target.id, target.storagePath, name)
                            onMessage(if (ok) "Renamed." else "Could not rename the attachment.")
                            if (ok) onChanged()
                        }
                    },
                )
            },
            dismissButton = { Text("Cancel", modifier = Modifier.clickable { renaming = null }) },
        )
    }

    deleting?.let { target ->
        AlertDialog(
            onDismissRequest = { deleting = null },
            title = { Text("Delete attachment") },
            text = { Text("Delete ${target.filename}? This cannot be undone.") },
            confirmButton = {
                Text(
                    "Delete",
                    color = Danger,
                    modifier = Modifier.clickable {
                        deleting = null
                        scope.launch {
                            val ok = deleteAttachment(target.id, target.storagePath)
                            onMessage(if (ok) "Attachment deleted." else "Could not delete the attachment.")
                            if (ok) onChanged()
                        }
                    },
                )
            },
            dismissButton = { Text("Cancel", modifier = Modifier.clickable { deleting = null }) },
        )
    }
}

@Composable
fun AssignmentHistorySection(revisions: List<AssignmentRevision>) {
    if (revisions.isNotEmpty()) {
        Text("History", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold, color = Foreground)
        Column(verticalArrangement = Arrangement.spacedBy(Spacing.Xs)) {
            revisions.forEach { revision ->
                Text(
                    describeRevision(revision) + " · " + formatTime(revision.createdAt),
                    color = MutedForeground,
                    style = MaterialTheme.typography.bodySmall,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis,
                )
            }
        }
    }
}
