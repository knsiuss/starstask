package id.starstask.mobile.ui.screens

import id.starstask.mobile.ui.theme.Spacing

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.material3.Text
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import id.starstask.mobile.data.ClassDetail
import id.starstask.mobile.data.LeaveForwardingRecord
import id.starstask.mobile.data.LeaveRequest
import id.starstask.mobile.data.formatLeaveDate
import id.starstask.mobile.data.formatLeaveDateRange
import id.starstask.mobile.data.leaveReasonLabel
import id.starstask.mobile.data.leaveReportCsv
import id.starstask.mobile.data.leaveReviewNoteError
import id.starstask.mobile.data.listLeaveForwardings
import id.starstask.mobile.data.loadClassLeaveRequests
import id.starstask.mobile.data.reviewLeaveRequest
import id.starstask.mobile.ui.theme.Accent
import id.starstask.mobile.ui.theme.Danger
import id.starstask.mobile.ui.theme.Foreground
import id.starstask.mobile.ui.theme.MutedForeground
import id.starstask.mobile.ui.components.WebAlert
import id.starstask.mobile.ui.components.WebButton
import id.starstask.mobile.ui.components.WebButtonVariant
import id.starstask.mobile.ui.components.WebCard
import id.starstask.mobile.ui.components.WebScreenHeader
import id.starstask.mobile.ui.components.WebInput
import kotlinx.coroutines.launch

// Leave requests review (web /app/classes/[slug]/leave).

@Composable
fun ClassLeaveScreen(
    clazz: ClassDetail,
    onBack: () -> Unit,
    userId: String = "",
) {
    var rows by remember { mutableStateOf<List<LeaveRequest>>(emptyList()) }
    var forwardings by remember { mutableStateOf<List<LeaveForwardingRecord>>(emptyList()) }
    var selectedForwardIds by remember { mutableStateOf<Set<String>>(emptySet()) }
    var recipientName by remember { mutableStateOf("") }
    var recipientEmail by remember { mutableStateOf("") }
    var reportFormat by remember { mutableStateOf("summary") }
    var idempotencyKey by remember { mutableStateOf(java.util.UUID.randomUUID().toString()) }
    var forwardingBusy by remember { mutableStateOf(false) }
    var forwardError by remember { mutableStateOf<String?>(null) }
    var error by remember { mutableStateOf<String?>(null) }
    var note by remember { mutableStateOf("") }
    var detailId by remember { mutableStateOf<String?>(null) }
    var reloadTick by remember { mutableStateOf(0) }
    val scope = rememberCoroutineScope()
    val context = androidx.compose.ui.platform.LocalContext.current

    LaunchedEffect(clazz.id, reloadTick) {
        runCatching { rows = loadClassLeaveRequests(clazz.id) }
            .onFailure { error = "Could not load leave requests: ${it.message}" }
        runCatching { forwardings = listLeaveForwardings(clazz.id) }
    }

    val detail = detailId
    if (detail != null) {
        LeaveRequestDetailScreen(
            userId = userId,
            requestId = detail,
            onBack = { detailId = null },
            onEdit = {},
            onChanged = { reloadTick++ },
        )
        return
    }

    fun review(requestId: String, decision: String) {
        leaveReviewNoteError(decision, note)?.let { error = it; return }
        scope.launch {
            runCatching { reviewLeaveRequest(requestId, decision, note.ifBlank { null }) }
                .onSuccess { note = ""; reloadTick++ }
                .onFailure { error = "Could not record the decision: ${it.message}" }
        }
    }

    Column(modifier = Modifier.fillMaxSize().padding(Spacing.Section), verticalArrangement = Arrangement.spacedBy(Spacing.Xl)) {
        WebButton(label = "← Back", onClick = onBack, variant = WebButtonVariant.GHOST)
        WebScreenHeader(title = "Leave requests — ${clazz.name}", subtitle = "Approve, reject, or forward the package")
        Text(
            "Non-draft requests for this class. Approving marks the covered sessions excused; forwarded is a hand-off, not a decision.",
            color = MutedForeground,
            style = MaterialTheme.typography.bodySmall,
        )
        Row(horizontalArrangement = Arrangement.spacedBy(Spacing.Md)) {
            WebButton(
                label = "Share CSV report",
                variant = WebButtonVariant.SECONDARY,
                onClick = {
                    val csv = leaveReportCsv(rows)
                    context.startActivity(
                        android.content.Intent(android.content.Intent.ACTION_SEND).apply {
                            type = "text/csv"
                            putExtra(android.content.Intent.EXTRA_TEXT, csv)
                            putExtra(android.content.Intent.EXTRA_SUBJECT, "Leave requests — ${clazz.name}")
                        },
                    )
                },
                enabled = rows.isNotEmpty(),
            )
        }
        if (error != null) WebAlert(message = error!!)
        WebInput(value = note, onValueChange = { note = it }, label = "Review note (required to reject or return for revision)")
        LazyColumn(verticalArrangement = Arrangement.spacedBy(Spacing.Md)) {
            val submittedRows = rows.filter { it.status == "submitted" }
            if (submittedRows.isNotEmpty()) {
                item(key = "forward-panel") {
                    LeaveForwardPanel(
                        clazz = clazz,
                        submittedRows = submittedRows,
                        selectedForwardIds = selectedForwardIds,
                        onSelectionChange = { selectedForwardIds = it },
                        recipientName = recipientName,
                        onRecipientNameChange = { recipientName = it },
                        recipientEmail = recipientEmail,
                        onRecipientEmailChange = { recipientEmail = it },
                        reportFormat = reportFormat,
                        onReportFormatChange = { reportFormat = it },
                        forwardingBusy = forwardingBusy,
                        forwardError = forwardError,
                        onForwardError = { forwardError = it },
                        idempotencyKey = idempotencyKey,
                        onIdempotencyKeyChange = { idempotencyKey = it },
                        context = context,
                        scope = scope,
                        onDone = { error = it },
                        onReload = { reloadTick++ },
                    )
                }
            }
            if (forwardings.isNotEmpty()) {
                item(key = "forwarding-history-title") {
                    Text(
                        "Forwarding history",
                        style = MaterialTheme.typography.titleMedium,
                        color = Foreground,
                    )
                }
                items(forwardings.size, key = { "fwd-${forwardings[it].id}" }) { index ->
                    val fwd = forwardings[index]
                    WebCard {
                        Column(modifier = Modifier.padding(Spacing.Xl), verticalArrangement = Arrangement.spacedBy(Spacing.Xs)) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                                verticalAlignment = Alignment.CenterVertically,
                            ) {
                                Text(
                                    fwd.reference,
                                    color = Foreground,
                                    style = MaterialTheme.typography.titleSmall,
                                )
                                Text(
                                    fwd.createdAt?.let { formatLeaveDate(it) } ?: "",
                                    color = MutedForeground,
                                    style = MaterialTheme.typography.bodySmall,
                                )
                            }
                            Text(
                                "To ${fwd.recipientName}" +
                                    (fwd.forwardedByName?.let { " · by $it" } ?: "") +
                                    " · ${fwd.requestCount} ${if (fwd.requestCount == 1) "request" else "requests"}" +
                                    " · ${fwd.reportFormat}",
                                color = MutedForeground,
                                style = MaterialTheme.typography.bodySmall,
                            )
                            fwd.items.forEach { item ->
                                Text(
                                    "${item.requestReference} · ${item.studentDisplayName} · ${formatLeaveDate(item.leaveStartDate)} → ${formatLeaveDate(item.leaveEndDate)}",
                                    color = MutedForeground,
                                    style = MaterialTheme.typography.bodySmall,
                                )
                            }
                            Text(
                                "This records the hand-off, not a decision. StarsTask cannot tell whether the lecturer has read the package.",
                                color = MutedForeground,
                                style = MaterialTheme.typography.bodySmall,
                            )
                        }
                    }
                }
            }
            items(rows.size, key = { rows[it].id }) { index ->
                val row = rows[index]
                WebCard {
                    Column(modifier = Modifier.padding(Spacing.Xl), verticalArrangement = Arrangement.spacedBy(Spacing.Sm)) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Text(
                                row.studentName.ifBlank { "Student" },
                                color = Foreground,
                                style = MaterialTheme.typography.titleSmall,
                            )
                            LeaveStatusBadge(row.status)
                        }
                        if (row.reference.isNotBlank()) {
                            Text(row.reference, color = MutedForeground, style = MaterialTheme.typography.labelSmall)
                        }
                        Text(
                            "${formatLeaveDateRange(row.leaveStart, row.leaveEnd)} · ${leaveReasonLabel(row.reason)}",
                            color = MutedForeground,
                            style = MaterialTheme.typography.bodySmall,
                        )
                        if (row.subjectNames.isNotEmpty()) {
                            Text(row.subjectNames.joinToString(", "), color = MutedForeground, style = MaterialTheme.typography.bodySmall)
                        }
                        Text(
                            "${row.evidenceCount} ${if (row.evidenceCount == 1) "file" else "files"}" +
                                (row.submittedAt?.let { " · Submitted ${formatLeaveDate(it)}" } ?: ""),
                            color = MutedForeground,
                            style = MaterialTheme.typography.bodySmall,
                        )
                        if (row.explanation != null) {
                            Text(row.explanation, color = Foreground, style = MaterialTheme.typography.bodySmall, maxLines = 3)
                        }
                        Row(horizontalArrangement = Arrangement.spacedBy(Spacing.Md)) {
                            WebButton(label = "Open", onClick = { detailId = row.id }, variant = WebButtonVariant.LINK)
                            if (row.status == "submitted") {
                                WebButton(label = "Approve", onClick = { review(row.id, "approved") })
                                WebButton(label = "Reject", onClick = { review(row.id, "rejected") }, variant = WebButtonVariant.SECONDARY)
                                WebButton(label = "Revision", onClick = { review(row.id, "revision_requested") }, variant = WebButtonVariant.GHOST)
                            }
                        }
                    }
                }
            }
        }
    }
}
