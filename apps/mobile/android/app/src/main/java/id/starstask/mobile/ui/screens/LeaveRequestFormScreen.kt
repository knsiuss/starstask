package id.starstask.mobile.ui.screens

// Create/edit form mirroring the web leave form: class, covered courses, leave
// period, optional document issue date, reason, explanation, and supporting
// documents. A draft needs only the class; submitting enforces the full set
// of web requirements before anything is sent.

import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import id.starstask.mobile.data.LEAVE_EVIDENCE_MAX_FILES
import id.starstask.mobile.data.LeaveClassChoice
import id.starstask.mobile.data.LeaveDraftInput
import id.starstask.mobile.data.LeaveRequest
import id.starstask.mobile.data.StagedEvidenceFile
import id.starstask.mobile.data.createLeaveDraft
import id.starstask.mobile.data.isLeaveRequestEditable
import id.starstask.mobile.data.leaveFailureMessage
import id.starstask.mobile.data.loadLeaveRequestById
import id.starstask.mobile.data.loadMyLeaveClasses
import id.starstask.mobile.data.queryPickedFile
import id.starstask.mobile.data.readPickedHeader
import id.starstask.mobile.data.submitLeaveRequestById
import id.starstask.mobile.data.updateLeaveDraft
import id.starstask.mobile.data.uploadLeaveEvidence
import id.starstask.mobile.data.validateLeaveForSubmit
import id.starstask.mobile.data.validateStagedEvidence
import id.starstask.mobile.ui.components.WebAlert
import id.starstask.mobile.ui.theme.dashColors
import kotlinx.coroutines.launch

@Composable
fun LeaveRequestFormScreen(
    userId: String,
    requestId: String?,
    onBack: () -> Unit,
    onSaved: () -> Unit,
) {
    val palette = dashColors()
    var classes by remember { mutableStateOf<List<LeaveClassChoice>>(emptyList()) }
    var existing by remember { mutableStateOf<LeaveRequest?>(null) }
    var loading by remember { mutableStateOf(true) }
    var loadError by remember { mutableStateOf<String?>(null) }
    var classId by remember { mutableStateOf<String?>(null) }
    var startDate by remember { mutableStateOf<String?>(null) }
    var endDate by remember { mutableStateOf<String?>(null) }
    var issueDate by remember { mutableStateOf<String?>(null) }
    var reason by remember { mutableStateOf<String?>(null) }
    var explanation by remember { mutableStateOf("") }
    var subjectIds by remember { mutableStateOf<Set<String>>(emptySet()) }
    var staged by remember { mutableStateOf<List<StagedEvidenceFile>>(emptyList()) }
    var error by remember { mutableStateOf<String?>(null) }
    var busy by remember { mutableStateOf(false) }
    var createdId by remember { mutableStateOf<String?>(requestId) }
    var showStart by remember { mutableStateOf(false) }
    var showEnd by remember { mutableStateOf(false) }
    var showIssue by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()
    val context = LocalContext.current

    LaunchedEffect(userId, requestId) {
        try {
            classes = loadMyLeaveClasses(userId)
            if (requestId != null) {
                existing = loadLeaveRequestById(requestId)
                val current = existing
                if (current != null) {
                    classId = current.classId.ifBlank { classes.firstOrNull()?.id }
                    startDate = current.leaveStart
                    endDate = current.leaveEnd
                    issueDate = current.documentIssueDate
                    reason = current.reason
                    explanation = current.explanation ?: ""
                    subjectIds = current.subjectIds.toSet()
                }
            } else {
                classId = classId ?: classes.firstOrNull()?.id
            }
        } catch (e: Exception) {
            loadError = leaveFailureMessage(e)
        }
        loading = false
    }

    val selectedClass = classes.firstOrNull { it.id == classId } ?: classes.firstOrNull()
    val editable = existing == null || isLeaveRequestEditable(existing!!.status)

    val picker = rememberLauncherForActivityResult(
        ActivityResultContracts.OpenMultipleDocuments(),
    ) { uris ->
        error = null
        val incoming = mutableListOf<StagedEvidenceFile>()
        for (uri in uris) {
            val picked = queryPickedFile(context, uri)
            val problem = when {
                picked == null -> "Could not read that file."
                staged.size + incoming.size >= LEAVE_EVIDENCE_MAX_FILES ->
                    "You can attach at most $LEAVE_EVIDENCE_MAX_FILES files."
                else -> validateStagedEvidence(picked.name, picked.size, readPickedHeader(context, uri))
            }
            if (problem != null) {
                error = problem
            } else {
                incoming += picked!!
            }
        }
        staged = staged + incoming
    }

    suspend fun persist(): String {
        val input = LeaveDraftInput(
            leaveStartDate = startDate,
            leaveEndDate = endDate,
            reasonCategory = reason,
            explanation = explanation.trim().ifBlank { null },
            documentIssueDate = issueDate,
            subjectIds = subjectIds.toList(),
        )
        val id = if (createdId == null) {
            val targetClass = selectedClass?.id
                ?: throw IllegalStateException("Join a class first.")
            createLeaveDraft(targetClass, input).also { createdId = it }
        } else {
            updateLeaveDraft(createdId!!, input)
            createdId!!
        }
        for (file in staged) {
            uploadLeaveEvidence(context, userId, id, file.uri, file.name)
        }
        staged = emptyList()
        return id
    }

    LeaveBackdrop {
        Column(modifier = Modifier.fillMaxSize()) {
            Column(
                modifier = Modifier
                    .weight(1f)
                    .fillMaxWidth()
                    .verticalScroll(rememberScrollState())
                    .padding(horizontal = 16.dp, vertical = 12.dp),
                verticalArrangement = Arrangement.spacedBy(28.dp),
            ) {
                when {
                    loading -> LeaveFormLoading()
                    loadError != null -> LeaveFormError(message = loadError!!)
                    classes.isEmpty() -> LeaveFormEmpty(message = "Join a class first. A leave request always belongs to a class.")
                    !editable -> LeaveFormNotEditable()
                    else -> {
                        LeaveFormHeader(
                            title = if (requestId == null) "New Leave Request" else "Edit Leave Request",
                            subtitle = "Request permission for your absence.",
                            onBack = onBack,
                        )
                        if (error != null) {
                            WebAlert(message = error!!)
                        }
                        LeaveClassSection(
                            classes = classes,
                            selectedClass = selectedClass,
                            classId = classId,
                            onClassChange = { classId = it; subjectIds = emptySet() },
                            subjectIds = subjectIds,
                            onSubjectChange = { subjectIds = it },
                            canChangeClass = createdId == null,
                        )
                        LeavePeriodSection(
                            startDate = startDate,
                            endDate = endDate,
                            issueDate = issueDate,
                            onStart = { showStart = true },
                            onEnd = { showEnd = true },
                            onIssue = { showIssue = true },
                        )
                        LeaveReasonSection(
                            reason = reason,
                            onReasonChange = { reason = it },
                        )
                        LeaveExplanationSection(
                            explanation = explanation,
                            onExplanationChange = { explanation = it },
                        )
                        LeaveEvidenceSection(
                            staged = staged,
                            onAttach = { picker.launch(arrayOf("application/pdf", "image/jpeg", "image/png")) },
                            onRemove = { staged = staged - it },
                        )
                        LeaveBeforeSubmitSection(
                            startDate = startDate,
                            endDate = endDate,
                            reason = reason,
                            subjectIds = subjectIds,
                            classHasCourses = selectedClass?.courses?.isNotEmpty() == true,
                            evidenceCount = staged.size + (existing?.evidenceCount ?: 0),
                        )
                    }
                }
            }
            if (!loading && loadError == null && classes.isNotEmpty() && editable) {
                LeaveFormActions(
                    busy = busy,
                    onSaveDraft = {
                        scope.launch {
                            busy = true
                            error = null
                            try {
                                persist()
                                onSaved()
                            } catch (e: Exception) {
                                error = leaveFailureMessage(e)
                            }
                            busy = false
                        }
                    },
                    onSubmit = {
                        val input = LeaveDraftInput(
                            leaveStartDate = startDate,
                            leaveEndDate = endDate,
                            reasonCategory = reason,
                            explanation = explanation.trim().ifBlank { null },
                            documentIssueDate = issueDate,
                            subjectIds = subjectIds.toList(),
                        )
                        val validation = validateLeaveForSubmit(
                            input = input,
                            classHasCourses = selectedClass?.courses?.isNotEmpty() == true,
                            stagedFiles = staged.size,
                            existingEvidence = existing?.evidenceCount ?: 0,
                        )
                        if (validation != null) {
                            error = validation
                        } else {
                            scope.launch {
                                busy = true
                                error = null
                                try {
                                    val id = persist()
                                    submitLeaveRequestById(id)
                                    onSaved()
                                } catch (e: Exception) {
                                    error = leaveFailureMessage(e)
                                }
                                busy = false
                            }
                        }
                    },
                )
            }
        }
    }

    if (showStart) LeaveDatePicker(
        initial = startDate,
        onDismiss = { showStart = false },
        onPick = {
            startDate = it
            showStart = false
        },
    )
    if (showEnd) LeaveDatePicker(
        initial = endDate,
        onDismiss = { showEnd = false },
        onPick = {
            endDate = it
            showEnd = false
        },
    )
    if (showIssue) LeaveDatePicker(
        initial = issueDate,
        onDismiss = { showIssue = false },
        onPick = {
            issueDate = it
            showIssue = false
        },
    )
}
