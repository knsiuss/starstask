package id.starstask.mobile.ui.screens

import android.net.Uri
import androidx.activity.compose.BackHandler
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
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
import id.starstask.mobile.ui.screens.assignmentdetail.isHttpUrl
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
import id.starstask.mobile.data.isAssignmentSaved
import id.starstask.mobile.data.loadMyAssignmentReport
import id.starstask.mobile.data.reportAssignment
import id.starstask.mobile.data.saveAssignment
import id.starstask.mobile.data.unsaveAssignment
import id.starstask.mobile.data.ASSIGNMENT_REPORT_REASONS
import id.starstask.mobile.data.updateAssignmentRecord
import id.starstask.mobile.data.uploadAttachment
import id.starstask.mobile.ui.screens.assignmentdetail.AttachmentsCard
import id.starstask.mobile.ui.screens.assignmentdetail.ContributorCard
import id.starstask.mobile.ui.screens.assignmentdetail.InformationCard
import id.starstask.mobile.ui.screens.assignmentdetail.RevisionHistoryCard
import id.starstask.mobile.ui.screens.assignmentdetail.StatusChip
import id.starstask.mobile.ui.screens.assignmentdetail.whatsappShareUrl
import id.starstask.mobile.ui.components.WebAlert
import id.starstask.mobile.ui.components.WebButton
import id.starstask.mobile.ui.components.WebButtonVariant
import id.starstask.mobile.ui.components.WebInput
import id.starstask.mobile.ui.icons.Lucide
import id.starstask.mobile.ui.theme.Spacing
import id.starstask.mobile.ui.theme.mockColors
import androidx.compose.material3.MaterialTheme
import kotlinx.coroutines.launch

/**
 * Assignment detail screen in the same visual language as the Leave Requests
 * detail: mockColors/mockPageBrush, rounded 20.dp cards, labelSmall+bodyMedium
 * hierarchy, status badges, and the same padding rhythm.
 */
@Composable
fun AssignmentDetailScreen(
    userId: String,
    assignment: Assignment,
    onBack: () -> Unit,
) {
    val palette = mockColors()
    var detail by remember { mutableStateOf<AssignmentDetail?>(null) }
    var revisions by remember { mutableStateOf<List<AssignmentRevision>>(emptyList()) }
    var attachments by remember { mutableStateOf<List<id.starstask.mobile.data.AttachmentRef>>(emptyList()) }
    var message by remember { mutableStateOf<String?>(null) }
    var busy by remember { mutableStateOf(false) }
    var editing by remember { mutableStateOf(false) }
    var deleting by remember { mutableStateOf(false) }
    var confirmDelete by remember { mutableStateOf(false) }
    var saved by remember { mutableStateOf<Boolean?>(null) }
    var reportOpen by remember { mutableStateOf(false) }
    var reportReason by remember { mutableStateOf(ASSIGNMENT_REPORT_REASONS.first().first) }
    var reportNote by remember { mutableStateOf("") }
    var reportBusy by remember { mutableStateOf(false) }
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
    LaunchedEffect(assignment.id, userId) { saved = isAssignmentSaved(userId, assignment.id) }

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

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(id.starstask.mobile.ui.theme.mockPageBrush())
            .verticalScroll(rememberScrollState())
            .padding(horizontal = Spacing.Section, vertical = Spacing.Xl)
            .padding(bottom = 112.dp),
        verticalArrangement = Arrangement.spacedBy(Spacing.Xxl),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.fillMaxWidth()) {
            IconButton(onClick = onBack) {
                Icon(Lucide.ArrowLeft, contentDescription = "Back", tint = palette.ink)
            }
            Text(
                "Assignment",
                style = MaterialTheme.typography.titleMedium,
                color = palette.ink,
                fontWeight = FontWeight.SemiBold,
                modifier = Modifier.padding(start = 4.dp),
            )
        }

        if (message != null) {
            WebAlert(message = message!!)
        }

        Column(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(12.dp))
                .background(palette.card)
                .border(1.dp, palette.cardBorder, RoundedCornerShape(12.dp))
                .padding(Spacing.Block),
            verticalArrangement = Arrangement.spacedBy(Spacing.Md),
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.Top,
                horizontalArrangement = Arrangement.SpaceBetween,
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        current?.let {
                            if (!it.courseCode.isNullOrBlank()) "${it.courseCode} · ${it.courseName}" else it.courseName
                        } ?: (assignment.className ?: "Assignment"),
                        style = MaterialTheme.typography.labelSmall,
                        color = palette.accent,
                        fontWeight = FontWeight.SemiBold,
                    )
                    Text(
                        current?.title ?: assignment.title,
                        color = palette.ink,
                        fontSize = 24.sp,
                        lineHeight = 30.sp,
                        fontWeight = FontWeight.SemiBold,
                        modifier = Modifier.padding(top = 4.dp),
                    )
                }
                StatusChip(status)
            }
            val metaRows = buildList {
                if (!current?.authorDisplayName.isNullOrBlank()) {
                    add("P ${current!!.authorDisplayName}" to Lucide.UserRound)
                }
                if (current != null) {
                    add("Published ${formatDateShort(current.publishedAt ?: current.createdAt)}" to Lucide.CalendarDays)
                }
            }
            metaRows.forEach { (label, icon) ->
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(icon, contentDescription = null, tint = palette.muted, modifier = Modifier.size(14.dp))
                    Text(label, color = palette.muted, fontSize = 13.sp, modifier = Modifier.padding(start = 6.dp))
                }
            }
            if (!current?.deadline.isNullOrBlank()) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(Lucide.Clock, contentDescription = null, tint = if (overdue) palette.riskFg else palette.accent, modifier = Modifier.size(16.dp))
                    Text(
                        "Due ${formatDeadline(current!!.deadline!!)}",
                        color = if (overdue) palette.riskFg else palette.ink,
                        fontSize = 14.sp,
                        fontWeight = FontWeight.SemiBold,
                        modifier = Modifier.padding(start = 6.dp),
                    )
                }
            }
        }

        if (isOwner) {
            Row(horizontalArrangement = Arrangement.spacedBy(Spacing.Lg), modifier = Modifier.fillMaxWidth()) {
                WebButton(label = "Edit assignment", onClick = { editing = true }, modifier = Modifier.weight(1f), icon = Lucide.Pencil)
                WebButton(
                    label = if (deleting) "Deleting…" else "Delete",
                    onClick = { confirmDelete = true },
                    modifier = Modifier.weight(1f),
                    variant = WebButtonVariant.DANGER,
                    enabled = !deleting,
                )
            }
        }

        Column(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(12.dp))
                .background(palette.card)
                .border(1.dp, palette.cardBorder, RoundedCornerShape(12.dp))
                .padding(Spacing.Block),
            verticalArrangement = Arrangement.spacedBy(Spacing.Sm),
        ) {
            Text(
                "Description",
                style = MaterialTheme.typography.titleSmall,
                color = palette.ink,
                fontWeight = FontWeight.SemiBold,
            )
            val desc = current?.description?.takeIf { it.isNotBlank() }
                ?: "No description has been added for this assignment yet."
            Text(
                desc,
                color = if (desc.startsWith("No description")) palette.muted else palette.ink,
                style = MaterialTheme.typography.bodyMedium,
                lineHeight = 22.sp,
            )
        }

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

        if (reportOpen) {
            AlertDialog(
                onDismissRequest = { if (!reportBusy) reportOpen = false },
                title = { Text("Report this assignment") },
                text = {
                    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Text("Why should this be reviewed?", color = palette.muted, style = MaterialTheme.typography.bodySmall)
                        ASSIGNMENT_REPORT_REASONS.forEach { (value, label) ->
                            OutlinedButton(
                                onClick = { reportReason = value },
                                border = BorderStroke(1.dp, if (reportReason == value) palette.accent else palette.cardBorder),
                                modifier = Modifier.fillMaxWidth(),
                            ) { Text(label, color = if (reportReason == value) palette.accent else palette.ink) }
                        }
                        WebInput(
                            value = reportNote,
                            onValueChange = { reportNote = it },
                            label = "Note (optional)",
                            singleLine = false,
                        )
                    }
                },
                confirmButton = {
                    TextButton(enabled = !reportBusy, onClick = {
                        reportBusy = true
                        scope.launch {
                            runCatching { reportAssignment(assignment.id, reportReason, reportNote) }
                                .onSuccess { message = "Report sent. Thanks." ; reportOpen = false; reportNote = "" }
                                .onFailure { message = "Could not send the report. Try again." }
                            reportBusy = false
                        }
                    }) { Text(if (reportBusy) "Sending…" else "Send report") }
                },
                dismissButton = {
                    TextButton(enabled = !reportBusy, onClick = { reportOpen = false }) { Text("Cancel") }
                },
            )
        }

        if (current?.referenceUrls.orEmpty().isNotEmpty()) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(12.dp))
                    .background(palette.card)
                    .border(1.dp, palette.cardBorder, RoundedCornerShape(12.dp))
                    .padding(Spacing.Block),
                verticalArrangement = Arrangement.spacedBy(Spacing.Sm),
            ) {
                Text(
                    "References",
                    style = MaterialTheme.typography.titleSmall,
                    color = palette.ink,
                    fontWeight = FontWeight.SemiBold,
                )
                current!!.referenceUrls.forEach { url ->
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(12.dp))
                            .clickable {
                                if (isHttpUrl(url)) {
                                    context.startActivity(android.content.Intent(android.content.Intent.ACTION_VIEW, Uri.parse(url)))
                                }
                            }
                            .padding(vertical = 6.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Icon(Lucide.ExternalLink, contentDescription = null, tint = palette.accent, modifier = Modifier.padding(end = 8.dp).size(14.dp))
                        Text(url, color = palette.accent, fontSize = 13.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
                    }
                }
            }
        }

        current?.let { detail ->
            InformationCard(detail = detail)
            ContributorCard(
                displayName = detail.authorDisplayName,
                avatarUrl = detail.authorAvatarUrl,
                createdAt = detail.publishedAt ?: detail.createdAt,
            )
        }

        if (isPublished) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(12.dp))
                    .background(palette.card)
                    .border(1.dp, palette.cardBorder, RoundedCornerShape(12.dp))
                    .padding(Spacing.Block),
                verticalArrangement = Arrangement.spacedBy(Spacing.Md),
            ) {
                Text(
                    "Share assignment",
                    style = MaterialTheme.typography.titleSmall,
                    color = palette.ink,
                    fontWeight = FontWeight.SemiBold,
                )
                Text(
                    "Share this assignment with your classmates.",
                    style = MaterialTheme.typography.bodySmall,
                    color = palette.muted,
                )
                androidx.compose.foundation.layout.FlowRow(
                    horizontalArrangement = Arrangement.spacedBy(Spacing.Md),
                    verticalArrangement = Arrangement.spacedBy(Spacing.Md),
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    WebButton(
                        label = if (saved == true) "Saved" else "Save",
                        onClick = {
                            scope.launch {
                                val next = !(saved ?: false)
                                runCatching {
                                    if (next) saveAssignment(userId, assignment.id) else unsaveAssignment(userId, assignment.id)
                                }
                                    .onSuccess { saved = next; message = if (next) "Saved." else "Removed from saved." }
                                    .onFailure { message = "Could not update saved assignments." }
                            }
                        },
                        modifier = Modifier.weight(1f),
                        icon = Lucide.Bookmark,
                        variant = WebButtonVariant.SECONDARY,
                    )
                    WebButton(
                        label = "Report",
                        onClick = { reportOpen = true },
                        modifier = Modifier.weight(1f),
                        variant = WebButtonVariant.SECONDARY,
                    )
                    WebButton(
                        label = "Copy link",
                        onClick = {
                            val url = BuildConfig.SITE_URL.trimEnd('/') + "/assignments/" + assignment.id
                            val clipboard = context.getSystemService(android.content.Context.CLIPBOARD_SERVICE) as android.content.ClipboardManager
                            clipboard.setPrimaryClip(android.content.ClipData.newPlainText("Assignment link", url))
                            message = "Link copied."
                        },
                        modifier = Modifier.weight(1f),
                        icon = Lucide.Copy,
                        variant = WebButtonVariant.SECONDARY,
                    )
                    WebButton(
                        label = "WhatsApp",
                        onClick = {
                            context.startActivity(android.content.Intent(android.content.Intent.ACTION_VIEW, Uri.parse(shareLine)))
                        },
                        modifier = Modifier.weight(1f),
                        icon = Lucide.Share2,
                        variant = WebButtonVariant.SECONDARY,
                    )
                }
            }
        }

        RevisionHistoryCard(revisions)

        Text(
            "Assignments are contributed by students and may be incomplete or outdated. Always confirm requirements with your lecturer.",
            style = MaterialTheme.typography.bodySmall,
            color = palette.muted,
        )
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
                }) { Text("Delete") }
            },
            dismissButton = { TextButton(onClick = { confirmDelete = false }) { Text("Cancel") } },
        )
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
            }, enabled = title.isNotBlank()) { Text("Save") }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Cancel") } },
    )
}
