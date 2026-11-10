package id.starstask.mobile.ui.screens.assignmentdetail

import androidx.compose.foundation.background
import androidx.compose.foundation.border
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
import androidx.compose.material3.IconButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import id.starstask.mobile.data.AttachmentRef
import id.starstask.mobile.data.downloadAttachmentBytes
import id.starstask.mobile.data.formatFileSize
import id.starstask.mobile.data.previewable
import id.starstask.mobile.ui.components.WebButton
import id.starstask.mobile.ui.components.WebButtonVariant
import id.starstask.mobile.ui.icons.Lucide
import id.starstask.mobile.ui.theme.Spacing
import id.starstask.mobile.ui.theme.mockColors
import androidx.compose.material3.MaterialTheme

// Attachments section for the assignment detail, styled like the leave detail
// evidence section: rounded card, labelSmall→bodyMedium hierarchy, accent actions.
@Composable
fun AttachmentsCard(
    attachments: List<AttachmentRef>,
    busy: Boolean,
    onAttach: () -> Unit,
    onOpen: (AttachmentRef) -> Unit,
    onRename: (AttachmentRef, String) -> Unit,
    onDelete: (AttachmentRef) -> Unit,
) {
    val palette = mockColors()
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(20.dp))
            .background(palette.card)
            .border(1.dp, palette.cardBorder, RoundedCornerShape(20.dp))
            .padding(Spacing.Block),
        verticalArrangement = Arrangement.spacedBy(Spacing.Md),
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(
                "Attachments (${attachments.size})",
                style = MaterialTheme.typography.titleSmall,
                color = palette.ink,
                fontWeight = FontWeight.SemiBold,
            )
            WebButton(
                label = "Add",
                onClick = onAttach,
                variant = WebButtonVariant.LINK,
                enabled = !busy,
                icon = Lucide.Paperclip,
            )
        }
        if (busy) {
            Text(
                "Uploading…",
                style = MaterialTheme.typography.bodySmall,
                color = palette.muted,
            )
        } else if (attachments.isEmpty()) {
            Text(
                "No documents attached yet. PDF, JPG, PNG, up to 10 MB each.",
                style = MaterialTheme.typography.bodySmall,
                color = palette.muted,
            )
        }
        attachments.forEach { attachment ->
            AttachmentRow(
                attachment = attachment,
                onOpen = onOpen,
                onRename = onRename,
                onDelete = onDelete,
            )
        }
    }
}

@Composable
private fun AttachmentRow(
    attachment: AttachmentRef,
    onOpen: (AttachmentRef) -> Unit,
    onRename: (AttachmentRef, String) -> Unit,
    onDelete: (AttachmentRef) -> Unit,
) {
    val palette = mockColors()
    var preview by remember(attachment.id) { mutableStateOf<android.graphics.Bitmap?>(null) }
    var previewFailed by remember(attachment.id) { mutableStateOf(false) }
    var loading by remember(attachment.id) { mutableStateOf(false) }
    var renameOpen by remember { mutableStateOf(false) }
    var deleteOpen by remember { mutableStateOf(false) }
    var draftName by remember { mutableStateOf(attachment.filename) }

    LaunchedEffect(attachment.id, attachment.mimeType) {
        if (previewable(attachment.mimeType) && preview == null && !previewFailed) {
            loading = true
            val bytes = runCatching { downloadAttachmentBytes(attachment.storagePath) }.getOrNull()
            preview = bytes?.let { decodePreview(it, attachment.mimeType) }
            if (preview == null) previewFailed = true
            loading = false
        }
    }

    Column(verticalArrangement = Arrangement.spacedBy(Spacing.Md)) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Spacing.Md),
        ) {
            Box(
                modifier = Modifier
                    .size(44.dp)
                    .clip(RoundedCornerShape(14.dp))
                    .background(palette.accentSoft),
                contentAlignment = Alignment.Center,
            ) {
                val icon = if (attachment.mimeType?.startsWith("image/") == true) Lucide.FileImage else Lucide.FileText
                Icon(icon, contentDescription = null, tint = palette.accent, modifier = Modifier.size(20.dp))
            }
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    attachment.filename,
                    style = MaterialTheme.typography.bodyMedium,
                    color = palette.ink,
                    fontWeight = FontWeight.Medium,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
                val meta = listOfNotNull(
                    attachment.mimeType?.substringAfter('/')?.uppercase(),
                    attachment.fileSize?.let { formatFileSize(it) },
                ).joinToString(" · ")
                Text(
                    meta,
                    style = MaterialTheme.typography.bodySmall,
                    color = palette.muted,
                )
            }
            IconButton(onClick = { onOpen(attachment) }) {
                Icon(Lucide.ExternalLink, contentDescription = "Open", tint = palette.accent)
            }
            IconButton(onClick = { renameOpen = true; draftName = attachment.filename }) {
                Icon(Lucide.Pencil, contentDescription = "Rename", tint = palette.muted)
            }
            IconButton(onClick = { deleteOpen = true }) {
                Icon(Lucide.Trash2, contentDescription = "Delete", tint = palette.riskFg)
            }
        }
        if (preview != null) {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(16.dp))
                    .background(palette.accentSofter),
            ) {
                androidx.compose.foundation.Image(
                    bitmap = preview!!.asImageBitmap(),
                    contentDescription = attachment.filename,
                    contentScale = ContentScale.FillWidth,
                    modifier = Modifier.fillMaxWidth().heightIn(max = 340.dp),
                )
            }
        } else if (loading) {
            Text(
                "Loading preview…",
                style = MaterialTheme.typography.bodySmall,
                color = palette.muted,
            )
        }
    }

    if (renameOpen) {
        AlertDialog(
            onDismissRequest = { renameOpen = false },
            title = { Text("Rename attachment") },
            text = {
                OutlinedTextField(
                    value = draftName,
                    onValueChange = { draftName = it },
                    label = { Text("File name") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                )
            },
            confirmButton = {
                TextButton(onClick = {
                    renameOpen = false
                    val name = draftName.trim()
                    if (name.isNotEmpty()) onRename(attachment, name)
                }) { Text("Save", color = palette.accent) }
            },
            dismissButton = { TextButton(onClick = { renameOpen = false }) { Text("Cancel") } },
        )
    }

    if (deleteOpen) {
        AlertDialog(
            onDismissRequest = { deleteOpen = false },
            title = { Text("Delete attachment") },
            text = { Text("Delete ${attachment.filename}? This cannot be undone.") },
            confirmButton = {
                TextButton(onClick = {
                    deleteOpen = false
                    onDelete(attachment)
                }) { Text("Delete", color = palette.riskFg) }
            },
            dismissButton = { TextButton(onClick = { deleteOpen = false }) { Text("Cancel") } },
        )
    }
}
