package id.starstask.mobile.ui.screens

import android.net.Uri
import androidx.activity.compose.BackHandler
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import id.starstask.mobile.BuildConfig
import id.starstask.mobile.data.Assignment
import id.starstask.mobile.data.AssignmentDetail
import id.starstask.mobile.data.AssignmentRevision
import id.starstask.mobile.data.AssignmentEditInput
import id.starstask.mobile.data.deleteAssignmentRecord
import id.starstask.mobile.data.deleteAttachment
import id.starstask.mobile.data.formatDateShort
import id.starstask.mobile.data.formatDeadline
import id.starstask.mobile.data.getDeadlineState
import id.starstask.mobile.data.getWorkspaceAssignmentDetail
import id.starstask.mobile.data.listAssignmentRevisions
import id.starstask.mobile.data.listAttachments
import id.starstask.mobile.data.openAttachment
import id.starstask.mobile.data.renameAttachment
import id.starstask.mobile.data.updateAssignmentRecord
import id.starstask.mobile.data.uploadAttachment
import id.starstask.mobile.ui.screens.assignmentdetail.AttachmentsCard
import id.starstask.mobile.ui.screens.assignmentdetail.ContributorCard
import id.starstask.mobile.ui.screens.assignmentdetail.InformationCard
import id.starstask.mobile.ui.screens.assignmentdetail.RevisionHistoryCard
import id.starstask.mobile.ui.screens.assignmentdetail.StatusChip
import id.starstask.mobile.ui.screens.assignmentdetail.whatsappShareUrl
import id.starstask.mobile.ui.components.WebInput
import id.starstask.mobile.ui.components.WebSecondaryButton
import id.starstask.mobile.ui.icons.Lucide
import id.starstask.mobile.ui.theme.Accent
import id.starstask.mobile.ui.theme.Danger
import id.starstask.mobile.ui.theme.Foreground
import id.starstask.mobile.ui.theme.MutedForeground
import id.starstask.mobile.ui.theme.Surface
import androidx.compose.material3.Icon
import kotlinx.coroutines.launch

/**
 * Assignment detail mirroring web /assignments/[id]: header/crumbs, meta, owner
 * Edit/Delete, description, attachments with built-in preview, references,
 * assignment information, contributor, share, revision history.
 */
@Composable
fun AssignmentDetailScreen(
    userId: String,
    assignment: Assignment,
    onBack: () -> Unit,
) {
    var detail by remember { mutableStateOf<AssignmentDetail?>(null) }
    var revisions by remember { mutableStateOf<List<AssignmentRevision>>(emptyList()) }
    var attachments by remember { mutableStateOf<List<id.starstask.mobile.data.AttachmentRef>>(emptyList()) }
    var message by remember { mutableStateOf<String?>(null) }
    var busy by remember { mutableStateOf(false) }
    var editing by remember { mutableStateOf(false) }
    var deleting by remember { mutableStateOf(false) }
    var confirmDelete by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()
    val context = LocalContext.current

    fun reload() {
        scope.launch {
            detail = getWorkspaceAssignmentDetail(assignment.id)
            revisions = listAssignmentRevisions(assignment.id)
            attachments = listAttachments(assignment.id)
        }
    }

    LaunchedEffect(assignment.id) { reload() }

    val picker = rememberLauncherForActivityResult(
        ActivityResultContracts.OpenDocument(),
    ) { uri: Uri? ->
        if (uri == null || busy) return@rememberLauncherForActivityResult
        busy = true
        scope.launch {
            val result = uploadAttachment(context, userId, assignment.id, uri)
            message = if (result.ok) "Attached ${result.filename}" else result.message
            if (result.ok) attachments = listAttachments(assignment.id)
            busy = false
        }
    }

    if (editing && detail != null) {
        BackHandler(onBack = { editing = false })
        EditAssignmentDialog(
            initialTitle = detail!!.title,
            initialDescription = detail!!.description,
            initialDeadline = detail!!.deadline,
            onDismiss = { editing = false },
            onSave = { title, description, deadlineIso ->
                scope.launch {
                    val ok = updateAssignmentRecord(
                        userId = userId,
                        assignmentId = assignment.id,
                        input = AssignmentEditInput(title, description, deadlineIso),
                    )
                    message = if (ok) "Saved." else "Could not save changes."
                    if (ok) {
                        editing = false
                        reload()
                    }
                }
            },
        )
        return
    }

    val current = detail
    val overdue = current?.deadline?.let {
        getDeadlineState(it) == id.starstask.mobile.data.DeadlineState.OVERDUE
    } ?: false
    val isOwner = current?.ownerId != null && current.ownerId == userId
    val status = current?.status ?: assignment.status
    val isPublished = status == "published"
    val siteUrl = BuildConfig.SITE_URL
    val shareLine = current?.let { whatsappShareUrl(it, siteUrl) }.orEmpty()

    LazyColumn(
        modifier = Modifier.fillMaxSize().background(Surface),
        contentPadding = androidx.compose.foundation.layout.PaddingValues(horizontal = 16.dp, vertical = 12.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        item(key = "back") {
            OutlinedButton(onClick = onBack) { Text("← Back") }
        }
        item(key = "crumbs") {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text("Assignments", color = MutedForeground, fontSize = 13.sp)
                Text("  ›  ", color = MutedForeground, fontSize = 13.sp)
                Text(current?.title ?: assignment.title, color = Foreground, fontSize = 13.sp, fontWeight = FontWeight.SemiBold, maxLines = 1, overflow = TextOverflow.Ellipsis)
            }
        }
        item(key = "header") {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Text(
                    current?.let { if (!it.courseCode.isNullOrBlank()) "${it.courseCode} · ${it.courseName}" else it.courseName } ?: assignment.className.orEmpty(),
                    color = Accent,
                    fontSize = 12.sp,
                    fontWeight = FontWeight.SemiBold,
                )
                Text(current?.title ?: assignment.title, color = Foreground, fontSize = 22.sp, fontWeight = FontWeight.SemiBold, lineHeight = 28.sp)
                Row(verticalAlignment = Alignment.CenterVertically) {
                    StatusChip(status)
                    if (!current?.authorDisplayName.isNullOrBlank()) {
                        Text("·  P ${current!!.authorDisplayName}", color = MutedForeground, fontSize = 12.sp, modifier = Modifier.padding(start = 8.dp))
                    }
                }
                if (current != null) {
                    Text("Published ${formatDateShort(current.publishedAt ?: current.createdAt)}", color = MutedForeground, fontSize = 12.sp)
                }
                if (!current?.deadline.isNullOrBlank()) {
                    Text(
                        "Due ${formatDeadline(current!!.deadline!!)}",
                        color = if (overdue) Danger else MutedForeground,
                        fontSize = 13.sp,
                        fontWeight = FontWeight.SemiBold,
                    )
                }
            }
        }
        if (isOwner) {
            item(key = "owner-actions") {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedButton(onClick = { editing = true }) { Text("Edit assignment") }
                    OutlinedButton(onClick = { confirmDelete = true }, enabled = !deleting) { Text(if (deleting) "Deleting…" else "Delete") }
                }
            }
        }
        if (message != null) {
            item(key = "msg") { Text(message!!, color = Accent, fontSize = 13.sp) }
        }
        item(key = "description") {
            Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Text("Description", color = Foreground, fontSize = 17.sp, fontWeight = FontWeight.SemiBold)
                val desc = current?.description?.takeIf { it.isNotBlank() } ?: "No description has been added for this assignment yet."
                Text(desc, color = if (desc.startsWith("No description")) MutedForeground else Foreground, fontSize = 14.sp, lineHeight = 20.sp)
            }
        }
        item(key = "attachments") {
            AttachmentsCard(
                attachments = attachments,
                busy = busy,
                onAttach = { picker.launch(arrayOf("application/pdf", "image/*", "*/*")) },
                onOpen = { attachment ->
                    scope.launch { runCatching { openAttachment(context, attachment.storagePath) } }
                },
                onRename = { attachment, name ->
                    scope.launch {
                        val ok = renameAttachment(context, attachment.id, attachment.storagePath, name)
                        message = if (ok) "Renamed." else "Could not rename."
                        if (ok) attachments = listAttachments(assignment.id)
                    }
                },
                onDelete = { attachment ->
                    scope.launch {
                        val ok = deleteAttachment(attachment.id, attachment.storagePath)
                        message = if (ok) "Attachment deleted." else "Could not delete."
                        if (ok) attachments = listAttachments(assignment.id)
                    }
                },
            )
        }
        if (current != null && current.referenceUrls.isNotEmpty()) {
            item(key = "references") {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text("References", color = Foreground, fontSize = 17.sp, fontWeight = FontWeight.SemiBold)
                    current.referenceUrls.forEach { url ->
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(8.dp))
                                .clickable { context.startActivity(android.content.Intent(android.content.Intent.ACTION_VIEW, Uri.parse(url))) }
                                .padding(vertical = 6.dp),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Icon(Lucide.ExternalLink, contentDescription = null, tint = Accent, modifier = Modifier.padding(end = 8.dp).size(14.dp))
                            Text(url, color = Accent, fontSize = 13.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
                        }
                    }
                }
            }
        }
        item(key = "info") {
            current?.let { InformationCard(detail = it) }
        }
        item(key = "contributor") {
            current?.let { ContributorCard(displayName = it.authorDisplayName, avatarUrl = it.authorAvatarUrl, createdAt = it.createdAt) }
        }
        if (isPublished) {
            item(key = "share") {
                ShareCard(
                    onCopy = {
                        val url = BuildConfig.SITE_URL.trimEnd('/') + "/assignments/" + assignment.id
                        val clipboard = context.getSystemService(android.content.Context.CLIPBOARD_SERVICE) as android.content.ClipboardManager
                        clipboard.setPrimaryClip(android.content.ClipData.newPlainText("Assignment link", url))
                        message = "Link copied."
                    },
                    onShareWhatsApp = {
                        context.startActivity(android.content.Intent(android.content.Intent.ACTION_VIEW, Uri.parse(shareLine)))
                    },
                )
            }
        }
        if (revisions.isNotEmpty()) {
            item(key = "revisions") { RevisionHistoryCard(revisions) }
        }
        item(key = "disclaimer") {
            Row(verticalAlignment = Alignment.Top) {
                Icon(Lucide.GraduationCap, contentDescription = null, tint = MutedForeground, modifier = Modifier.size(14.dp).padding(top = 2.dp))
                Text(
                    "Assignments are contributed by students and may be incomplete or outdated. Always confirm requirements with your lecturer.",
                    color = MutedForeground,
                    fontSize = 12.sp,
                    modifier = Modifier.padding(start = 8.dp),
                )
            }
        }
    }

    if (confirmDelete) {
        AlertDialog(
            onDismissRequest = { confirmDelete = false },
            title = { Text("Delete assignment") },
            text = { Text("Delete this assignment? This cannot be undone.") },
            confirmButton = {
                TextButton(onClick = {
                    confirmDelete = false
                    deleting = true
                    scope.launch {
                        val ok = deleteAssignmentRecord(userId, assignment.id)
                        message = if (ok) "Deleted." else "Could not delete."
                        deleting = false
                        if (ok) onBack()
                    }
                }) { Text("Delete", color = Danger) }
            },
            dismissButton = { TextButton(onClick = { confirmDelete = false }) { Text("Cancel") } },
        )
    }
}

@Composable
private fun ShareCard(onCopy: () -> Unit, onShareWhatsApp: () -> Unit) {
    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Text("Share assignment", color = Foreground, fontSize = 15.sp, fontWeight = FontWeight.SemiBold)
        Text("Share this assignment with your class.", color = MutedForeground, fontSize = 12.sp)
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            WebSecondaryButton(label = "Copy link", onClick = onCopy, icon = Lucide.Copy)
            WebSecondaryButton(label = "Share on WhatsApp", onClick = onShareWhatsApp, icon = Lucide.Share2)
        }
    }
}

@Composable
private fun EditAssignmentDialog(
    initialTitle: String,
    initialDescription: String,
    initialDeadline: String?,
    onDismiss: () -> Unit,
    onSave: (String, String, String?) -> Unit,
) {
    var title by remember { mutableStateOf(initialTitle) }
    var description by remember { mutableStateOf(initialDescription) }
    var deadline by remember { mutableStateOf(initialDeadline?.take(16) ?: "") }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Edit assignment") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                WebInput(value = title, onValueChange = { title = it }, label = "Title")
                WebInput(value = description, onValueChange = { description = it }, label = "Description", singleLine = false, minLines = 3)
                WebInput(value = deadline, onValueChange = { deadline = it }, label = "Deadline (ISO, e.g. 2026-12-07T23:59:00+07:00)")
            }
        },
        confirmButton = {
            TextButton(onClick = {
                val trimmed = deadline.trim()
                onSave(title.trim(), description.trim(), trimmed.takeIf { it.isNotEmpty() })
            }, enabled = title.isNotBlank()) { Text("Save", color = Accent) }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Cancel") } },
    )
}
