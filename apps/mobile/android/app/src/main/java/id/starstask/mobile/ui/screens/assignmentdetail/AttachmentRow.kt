package id.starstask.mobile.ui.screens.assignmentdetail

import androidx.compose.foundation.background
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
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
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
import androidx.compose.ui.graphics.Color
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
import id.starstask.mobile.ui.components.WebSectionTitle
import id.starstask.mobile.ui.icons.Lucide
import id.starstask.mobile.ui.theme.Accent
import id.starstask.mobile.ui.theme.Foreground
import id.starstask.mobile.ui.theme.MutedForeground
import id.starstask.mobile.ui.theme.Surface

// Attachments card for the assignment detail: list entries plus inline image/PDF preview.
@Composable
fun AttachmentsCard(
    attachments: List<AttachmentRef>,
    busy: Boolean,
    onAttach: () -> Unit,
    onOpen: (AttachmentRef) -> Unit,
    onRename: (AttachmentRef, String) -> Unit,
    onDelete: (AttachmentRef) -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(12.dp), modifier = Modifier.fillMaxWidth()) {
        WebSectionTitle("Attachments (${attachments.size})")
        Text(
            "Images and PDFs preview here. Download links expire after 15 minutes; files are checked for type and size on upload.",
            color = MutedForeground,
            fontSize = 12.sp,
        )
        if (busy) {
            Text("Uploading…", color = MutedForeground, fontSize = 13.sp)
        } else {
            WebButton(label = "Attach file", onClick = onAttach)
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

    Card(
        colors = CardDefaults.cardColors(containerColor = Surface),
        shape = RoundedCornerShape(12.dp),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(modifier = Modifier.padding(12.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                Box(
                    modifier = Modifier
                        .size(40.dp)
                        .clip(RoundedCornerShape(12.dp))
                        .background(Color(0xFFEEF1F7)),
                    contentAlignment = Alignment.Center,
                ) {
                    val icon = if (attachment.mimeType?.startsWith("image/") == true) Lucide.FileImage else Lucide.FileText
                    Icon(icon, contentDescription = null, tint = Accent, modifier = Modifier.size(20.dp))
                }
                Column(modifier = Modifier.weight(1f)) {
                    Text(attachment.filename, color = Foreground, fontSize = 14.sp, fontWeight = FontWeight.SemiBold, maxLines = 1, overflow = TextOverflow.Ellipsis)
                    val meta = listOfNotNull(
                        attachment.mimeType?.substringAfter('/')?.uppercase(),
                        attachment.fileSize?.let { formatFileSize(it) },
                    ).joinToString(" · ")
                    if (meta.isNotBlank()) {
                        Text(meta, color = MutedForeground, fontSize = 12.sp, modifier = Modifier.padding(top = 2.dp))
                    }
                }
                TextButton(onClick = { onOpen(attachment) }) { Text("Open", color = Accent) }
                TextButton(onClick = { renameOpen = true; draftName = attachment.filename }) { Text("Rename", color = MutedForeground) }
                TextButton(onClick = { deleteOpen = true }) { Text("Delete", color = MutedForeground) }
            }
            if (preview != null) {
                val bitmap = preview!!
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(top = 12.dp)
                        .clip(RoundedCornerShape(12.dp))
                        .background(Color(0xFFF5F6F8)),
                ) {
                    androidx.compose.foundation.Image(
                        bitmap = bitmap.asImageBitmap(),
                        contentDescription = attachment.filename,
                        contentScale = ContentScale.FillWidth,
                        modifier = Modifier.fillMaxWidth().heightIn(max = 360.dp),
                    )
                }
            } else if (loading) {
                Text("Loading preview…", color = MutedForeground, fontSize = 12.sp, modifier = Modifier.padding(top = 8.dp))
            }
        }
    }

    if (renameOpen) {
        AlertDialog(
            onDismissRequest = { renameOpen = false },
            title = { Text("Rename attachment") },
            text = {
                androidx.compose.material3.OutlinedTextField(
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
                }) { Text("Save", color = Accent) }
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
                }) { Text("Delete", color = Color(0xFFA94A4A)) }
            },
            dismissButton = { TextButton(onClick = { deleteOpen = false }) { Text("Cancel") } },
        )
    }
}
