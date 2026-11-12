package id.starstask.mobile.ui.screens

import id.starstask.mobile.ui.theme.Spacing

import id.starstask.mobile.ui.icons.Lucide

import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import id.starstask.mobile.data.LeaveEvidence
import id.starstask.mobile.data.LeaveHistoryEntry
import id.starstask.mobile.data.LeaveRequest
import id.starstask.mobile.data.LEAVE_EVIDENCE_MAX_FILES
import id.starstask.mobile.data.cancelLeaveRequestById
import id.starstask.mobile.data.confirmLeaveOcr
import id.starstask.mobile.data.formatLeaveDate
import id.starstask.mobile.data.formatLeaveDateRange
import id.starstask.mobile.data.isLeaveRequestCancellable
import id.starstask.mobile.data.isLeaveRequestEditable
import id.starstask.mobile.data.leaveDayCount
import id.starstask.mobile.data.leaveFailureMessage
import id.starstask.mobile.data.leaveReasonLabel
import id.starstask.mobile.data.leaveReviewNoteError
import id.starstask.mobile.data.listLeaveEvidence
import id.starstask.mobile.data.listLeaveHistory
import id.starstask.mobile.data.loadLeaveRequestById
import id.starstask.mobile.data.loadMyLeaveClasses
import id.starstask.mobile.data.openLeaveEvidence
import id.starstask.mobile.data.queryPickedFile
import id.starstask.mobile.data.readPickedHeader
import id.starstask.mobile.data.removeLeaveEvidence
import id.starstask.mobile.data.reviewLeaveRequest
import id.starstask.mobile.data.submitLeaveRequestById
import id.starstask.mobile.data.uploadLeaveEvidence
import id.starstask.mobile.data.validateStagedEvidence
import id.starstask.mobile.ui.components.WebAlert
import id.starstask.mobile.ui.components.WebButton
import id.starstask.mobile.ui.components.WebButtonVariant
import id.starstask.mobile.ui.theme.Accent
import id.starstask.mobile.ui.theme.Border
import id.starstask.mobile.ui.theme.Danger
import id.starstask.mobile.ui.theme.Foreground
import id.starstask.mobile.ui.theme.MutedForeground
import id.starstask.mobile.ui.theme.Surface
import kotlinx.coroutines.launch

/**
 * Leave request detail, mirroring the web request page: the three dates kept
 * separate, evidence with signed-URL open, append-only history, and the
 * actions the student is allowed to take in the current status.
 */
@Composable
fun LeaveRequestDetailScreen(
    userId: String,
    requestId: String,
    onBack: () -> Unit,
    onEdit: () -> Unit,
    onChanged: () -> Unit,
) {
    var request by remember { mutableStateOf<LeaveRequest?>(null) }
    var evidence by remember { mutableStateOf<List<LeaveEvidence>>(emptyList()) }
    var history by remember { mutableStateOf<List<LeaveHistoryEntry>>(emptyList()) }
    var isManager by remember { mutableStateOf(false) }
    var reviewNote by remember { mutableStateOf("") }
    var reviewBusy by remember { mutableStateOf(false) }
    var loading by remember { mutableStateOf(true) }
    var error by remember { mutableStateOf<String?>(null) }
    var message by remember { mutableStateOf<String?>(null) }
    var busy by remember { mutableStateOf(false) }
    var showCancel by remember { mutableStateOf(false) }
    var reloadTick by remember { mutableIntStateOf(0) }
    val scope = rememberCoroutineScope()
    val context = LocalContext.current

    LaunchedEffect(requestId, reloadTick) {
        loading = true
        error = null
        try {
            request = loadLeaveRequestById(requestId)
            evidence = listLeaveEvidence(requestId)
            history = listLeaveHistory(requestId)
            val loaded = request
            if (loaded != null) {
                isManager = loadMyLeaveClasses(userId)
                    .firstOrNull { it.id == loaded.classId }?.isAdmin == true
            }
        } catch (e: Exception) {
            error = leaveFailureMessage(e)
        }
        loading = false
        busy = false
    }

    val picker = rememberLauncherForActivityResult(
        ActivityResultContracts.OpenMultipleDocuments(),
    ) { uris ->
        scope.launch {
            busy = true
            message = null
            for (uri in uris) {
                val picked = queryPickedFile(context, uri)
                val problem = when {
                    picked == null -> "Could not read that file."
                    evidence.size >= LEAVE_EVIDENCE_MAX_FILES ->
                        "You can attach at most $LEAVE_EVIDENCE_MAX_FILES files."
                    else -> validateStagedEvidence(
                        picked.name,
                        picked.size,
                        readPickedHeader(context, uri),
                    )
                }
                if (problem != null) {
                    message = problem
                    continue
                }
                try {
                    uploadLeaveEvidence(context, userId, requestId, uri, picked!!.name)
                    evidence = listLeaveEvidence(requestId)
                } catch (e: Exception) {
                    message = leaveFailureMessage(e)
                }
            }
            onChanged()
            reloadTick++
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(horizontal = Spacing.Section, vertical = Spacing.Xl)
            .padding(bottom = 112.dp),
        verticalArrangement = Arrangement.spacedBy(Spacing.Xxl),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            IconButton(onClick = onBack) {
                Icon(Lucide.ArrowLeft, contentDescription = "Back", tint = Foreground)
            }
            Text(
                "Leave Request",
                style = MaterialTheme.typography.headlineSmall,
                color = Foreground,
                fontWeight = FontWeight.SemiBold,
            )
        }
        if (message != null) Text(message!!, color = Danger, style = MaterialTheme.typography.bodyMedium)
        if (loading) {
            val loadingRequest = request
            if (loadingRequest == null) {
                Row(
                    modifier = Modifier.fillMaxWidth().padding(vertical = Spacing.Page),
                    horizontalArrangement = Arrangement.Center,
                ) {
                    CircularProgressIndicator(color = Accent)
                }
            }
        } else if (error != null) {
            WebAlert(message = error!!)
            WebButton(label = "Retry", onClick = { reloadTick++ }, variant = WebButtonVariant.SECONDARY)
        } else {
            val current = request
            if (current != null) {
                val isOwner = current.studentId == userId
                val editable = isOwner && isLeaveRequestEditable(current.status)
                val canCancel = (isOwner && isLeaveRequestCancellable(current.status)) ||
                    (isManager && !isOwner && current.status == "submitted")
                val decision = history.lastOrNull {
                    it.action == "approved" || it.action == "rejected"
                }
                LeaveDetailCard(current, isOwner = isOwner)
                LeaveStatusExplanation(request = current, decision = decision)
                LeaveEvidenceSection(
                    evidence = evidence,
                    editable = editable,
                    busy = busy,
                    onAdd = { picker.launch(arrayOf("application/pdf", "image/jpeg", "image/png")) },
                    onOpen = { scope.launch { runCatching { openLeaveEvidence(context, it) } } },
                    onRemove = {
                        scope.launch {
                            busy = true
                            runCatching { removeLeaveEvidence(it.id) }
                                .onSuccess {
                                    onChanged()
                                    reloadTick++
                                }
                                .onFailure { e -> message = leaveFailureMessage(e) }
                            busy = false
                        }
                    },
                )
                if (isOwner && isLeaveRequestEditable(current.status)) {
                    LeaveOcrSection(
                        request = current,
                        busy = busy,
                        onConfirm = { sources ->
                            scope.launch {
                                busy = true
                                runCatching { confirmLeaveOcr(current.id, sources) }
                                    .onSuccess {
                                        message = "Confirmed."
                                        onChanged()
                                        reloadTick++
                                    }
                                    .onFailure { e -> message = leaveFailureMessage(e) }
                                busy = false
                            }
                        },
                    )
                }
                LeaveHistorySection(history)
                if (isManager && !isOwner && current.status == "submitted") {
                    LeaveReviewCard(
                        request = current,
                        reviewNote = reviewNote,
                        onReviewNoteChange = { reviewNote = it },
                        reviewBusy = reviewBusy,
                        onReviewBusyChange = { reviewBusy = it },
                        onReviewNoteClear = { reviewNote = "" },
                        onMessage = { message = it },
                        onChanged = onChanged,
                        onReload = { reloadTick++ },
                        scope = scope,
                    )
                }
                LeaveDetailActions(
                    request = current,
                    editable = editable,
                    canCancel = canCancel,
                    busy = busy,
                    onBusyChange = { busy = it },
                    onEdit = onEdit,
                    onShowCancel = { showCancel = true },
                    onMessage = { message = it },
                    onChanged = onChanged,
                    onReload = { reloadTick++ },
                    scope = scope,
                )
            }
        }
    }

    if (showCancel) {
        LeaveCancelDialog(
            requestId = request?.id,
            onDismiss = { showCancel = false },
            onBusyChange = { busy = it },
            onMessage = { message = it },
            onChanged = onChanged,
            onReload = { reloadTick++ },
            scope = scope,
        )
    }
}

/** Back-compat entry used by the home screen's leave detail route. */
