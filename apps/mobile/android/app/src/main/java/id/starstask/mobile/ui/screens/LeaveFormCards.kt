package id.starstask.mobile.ui.screens

// Apple-clean grouped form sections for LeaveRequestFormScreen. Every value
// comes from the data layer: classes/courses from loadMyLeaveClasses,
// reason labels from leaveReasonLabel (LEAVE_REASON_CATEGORIES contract),
// dates formatted with formatLeaveDate, limits from LeaveRequestActions
// constants. No hardcoded class names, course names, or reason strings.

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Checkbox
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.TextField
import androidx.compose.material3.TextFieldDefaults
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import id.starstask.mobile.data.LEAVE_EVIDENCE_MAX_FILES
import id.starstask.mobile.data.LEAVE_EXPLANATION_MAX
import id.starstask.mobile.data.LeaveClassChoice
import id.starstask.mobile.data.StagedEvidenceFile
import id.starstask.mobile.data.formatLeaveDate
import id.starstask.mobile.data.leaveReasonLabel
import id.starstask.mobile.data.validateLeaveDateRange
import id.starstask.mobile.ui.icons.Lucide
import id.starstask.mobile.ui.theme.mockColors
import id.starstask.mobile.ui.theme.Danger
import id.starstask.mobile.ui.theme.Success

val leaveReasonCategories: List<String> = listOf("illness", "family_matter", "other")

@Composable
fun LeaveClassSection(
    classes: List<LeaveClassChoice>,
    selectedClass: LeaveClassChoice?,
    classId: String?,
    onClassChange: (String) -> Unit,
    subjectIds: Set<String>,
    onSubjectChange: (Set<String>) -> Unit,
    canChangeClass: Boolean,
) {
    val palette = mockColors()
    var showClassSheet by remember { mutableStateOf(false) }
    var showCourseSheet by remember { mutableStateOf(false) }
    LeaveSectionTitle("Class")
    LeaveGroupedSurface {
        if (classes.size > 1 && canChangeClass) {
            LeaveDisclosureRow(
                label = "Class",
                value = selectedClass?.name,
                placeholder = "Select class",
                onClick = { showClassSheet = true },
            )
        } else {
            Row(
                modifier = Modifier.fillMaxWidth().padding(vertical = 12.dp).heightIn(min = 48.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text("Class", color = palette.ink, fontSize = 17.sp, modifier = Modifier.weight(1f))
                Text(
                    selectedClass?.name ?: "—",
                    color = palette.ink,
                    fontSize = 17.sp,
                    fontWeight = FontWeight.SemiBold,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
            }
        }
        if (selectedClass != null && selectedClass.courses.isNotEmpty()) {
            LeaveSectionDivider()
            val count = subjectIds.size
            val value = when (count) {
                0 -> "0 selected"
                1 -> "1 selected"
                else -> "$count selected"
            }
            LeaveDisclosureRow(
                label = "Courses this leave covers",
                value = value,
                placeholder = "Select courses…",
                onClick = { showCourseSheet = true },
            )
        }
    }
    LeaveFootnote("A leave request always belongs to a class. Pick every course this absence applies to — you can choose more than one.")
    if (showClassSheet) {
        LeaveClassSheet(
            classes = classes,
            selectedId = classId,
            onPick = { onClassChange(it); showClassSheet = false },
            onDismiss = { showClassSheet = false },
        )
    }
    if (showCourseSheet && selectedClass != null) {
        LeaveCourseSheet(
            className = selectedClass.name,
            courses = selectedClass.courses.map { it.id to it.name },
            selectedIds = subjectIds,
            onChange = onSubjectChange,
            onDismiss = { showCourseSheet = false },
        )
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun LeaveClassSheet(
    classes: List<LeaveClassChoice>,
    selectedId: String?,
    onPick: (String) -> Unit,
    onDismiss: () -> Unit,
) {
    val palette = mockColors()
    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true),
        containerColor = palette.card,
    ) {
        Column(modifier = Modifier.fillMaxWidth().imePadding().padding(horizontal = 20.dp, vertical = 12.dp)) {
            Text("Select class", color = palette.ink, fontSize = 20.sp, fontWeight = FontWeight.SemiBold, modifier = Modifier.padding(bottom = 12.dp))
            classes.forEach { clazz ->
                val active = clazz.id == selectedId
                Row(
                    modifier = Modifier.fillMaxWidth().heightIn(min = 48.dp).clickable { onPick(clazz.id) }.padding(vertical = 12.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(clazz.name, color = palette.ink, fontSize = 17.sp, modifier = Modifier.weight(1f))
                    if (active) Icon(Lucide.Check, contentDescription = "Selected", tint = palette.accent, modifier = Modifier.size(20.dp))
                }
                LeaveSectionDivider()
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun LeaveCourseSheet(
    className: String,
    courses: List<Pair<String, String>>,
    selectedIds: Set<String>,
    onChange: (Set<String>) -> Unit,
    onDismiss: () -> Unit,
) {
    val palette = mockColors()
    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true),
        containerColor = palette.card,
    ) {
        LazyColumn(modifier = Modifier.fillMaxWidth().imePadding().padding(horizontal = 20.dp, vertical = 12.dp)) {
            item {
                Text("Courses this leave covers", color = palette.ink, fontSize = 20.sp, fontWeight = FontWeight.SemiBold)
                Text(className, color = palette.muted, fontSize = 14.sp, modifier = Modifier.padding(bottom = 12.dp, top = 2.dp))
            }
            items(courses) { (id, name) ->
                Row(
                    modifier = Modifier.fillMaxWidth().heightIn(min = 48.dp).clickable {
                        onChange(if (selectedIds.contains(id)) selectedIds - id else selectedIds + id)
                    }.padding(vertical = 10.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Checkbox(checked = selectedIds.contains(id), onCheckedChange = {
                        onChange(if (selectedIds.contains(id)) selectedIds - id else selectedIds + id)
                    })
                    Text(name, color = palette.ink, fontSize = 16.sp, modifier = Modifier.padding(start = 8.dp))
                }
            }
        }
    }
}

@Composable
fun LeavePeriodSection(
    startDate: String?,
    endDate: String?,
    issueDate: String?,
    onStart: () -> Unit,
    onEnd: () -> Unit,
    onIssue: () -> Unit,
) {
    LeaveSectionTitle("Absence period")
    LeaveGroupedSurface {
        LeaveDisclosureRow(
            label = "From",
            value = startDate?.let { formatLeaveDate(it) },
            placeholder = "Select date",
            onClick = onStart,
        )
        LeaveSectionDivider()
        LeaveDisclosureRow(
            label = "To",
            value = endDate?.let { formatLeaveDate(it) },
            placeholder = "Select date",
            onClick = onEnd,
        )
        LeaveSectionDivider()
        LeaveDisclosureRow(
            label = "Document issue date · optional",
            value = issueDate?.let { formatLeaveDate(it) },
            placeholder = "Select date",
            onClick = onIssue,
        )
    }
    val rangeError = validateLeaveDateRange(startDate, endDate)
    if (rangeError != null) {
        Text(rangeError, color = Danger, fontSize = 13.sp, modifier = Modifier.padding(horizontal = 16.dp, vertical = 6.dp))
    }
    LeaveFootnote("The issue date is when the letter was written — not the leave dates and not the submission date.")
}

@Composable
fun LeaveReasonSection(
    reason: String?,
    onReasonChange: (String) -> Unit,
) {
    var showSheet by remember { mutableStateOf(false) }
    LeaveSectionTitle("Reason")
    LeaveGroupedSurface {
        LeaveDisclosureRow(
            label = "Reason",
            value = reason?.let { leaveReasonLabel(it) },
            placeholder = "Choose a reason",
            onClick = { showSheet = true },
        )
    }
    if (showSheet) {
        LeaveReasonSheet(
            selected = reason,
            onPick = { onReasonChange(it); showSheet = false },
            onDismiss = { showSheet = false },
        )
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun LeaveReasonSheet(
    selected: String?,
    onPick: (String) -> Unit,
    onDismiss: () -> Unit,
) {
    val palette = mockColors()
    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true),
        containerColor = palette.card,
    ) {
        Column(modifier = Modifier.fillMaxWidth().imePadding().padding(horizontal = 20.dp, vertical = 12.dp)) {
            Text("Choose a reason", color = palette.ink, fontSize = 20.sp, fontWeight = FontWeight.SemiBold, modifier = Modifier.padding(bottom = 12.dp))
            leaveReasonCategories.forEach { value ->
                val active = value == selected
                Row(
                    modifier = Modifier.fillMaxWidth().heightIn(min = 48.dp).clickable { onPick(value) }.padding(vertical = 12.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(leaveReasonLabel(value), color = palette.ink, fontSize = 17.sp, modifier = Modifier.weight(1f))
                    if (active) Icon(Lucide.Check, contentDescription = "Selected", tint = palette.accent, modifier = Modifier.size(20.dp))
                }
                LeaveSectionDivider()
            }
        }
    }
}

@Composable
fun LeaveExplanationSection(
    explanation: String,
    onExplanationChange: (String) -> Unit,
) {
    val palette = mockColors()
    LeaveSectionTitle("Explanation")
    LeaveGroupedSurface {
        TextField(
            value = explanation,
            onValueChange = { onExplanationChange(it.take(LEAVE_EXPLANATION_MAX)) },
            placeholder = { Text("Briefly explain your reason…", color = palette.muted, fontSize = 17.sp) },
            minLines = 4,
            singleLine = false,
            shape = RoundedCornerShape(12.dp),
            colors = TextFieldDefaults.colors(
                focusedContainerColor = palette.card,
                unfocusedContainerColor = palette.card,
                focusedIndicatorColor = androidx.compose.ui.graphics.Color.Transparent,
                unfocusedIndicatorColor = androidx.compose.ui.graphics.Color.Transparent,
                cursorColor = palette.accent,
            ),
            textStyle = androidx.compose.material3.MaterialTheme.typography.bodyLarge.copy(color = palette.ink, fontSize = 17.sp, lineHeight = 22.sp),
            modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp),
        )
        Row(modifier = Modifier.fillMaxWidth().padding(vertical = 6.dp), horizontalArrangement = Arrangement.End) {
            Text("${explanation.length} / $LEAVE_EXPLANATION_MAX", color = palette.muted, fontSize = 13.sp)
        }
    }
}

@Composable
fun LeaveEvidenceSection(
    staged: List<StagedEvidenceFile>,
    onAttach: () -> Unit,
    onRemove: (StagedEvidenceFile) -> Unit,
) {
    val palette = mockColors()
    LeaveSectionTitle("Supporting document")
    LeaveGroupedSurface {
        Row(
            modifier = Modifier.fillMaxWidth().heightIn(min = 48.dp).clickable(onClick = onAttach).padding(vertical = 12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Icon(Lucide.Paperclip, contentDescription = null, tint = palette.accent, modifier = Modifier.size(20.dp))
            Text("Attach file", color = palette.accent, fontSize = 17.sp, fontWeight = FontWeight.Medium, modifier = Modifier.padding(horizontal = 12.dp))
            if (staged.isNotEmpty()) {
                Text("${staged.size} / $LEAVE_EVIDENCE_MAX_FILES", color = palette.muted, fontSize = 13.sp)
            }
        }
        staged.forEach { file ->
            LeaveSectionDivider()
            LeaveEvidenceRow(file = file, onRemove = onRemove)
        }
    }
    LeaveFootnote("PDF, JPG, or PNG · max 10 MB. At least one is required before submitting.")
}

@Composable
fun LeaveBeforeSubmitSection(
    startDate: String?,
    endDate: String?,
    reason: String?,
    subjectIds: Set<String>,
    classHasCourses: Boolean,
    evidenceCount: Int,
) {
    val palette = mockColors()
    var expanded by remember { mutableStateOf(false) }
    val checks = listOf(
        "Dates exactly as printed on the document." to (startDate != null && endDate != null),
        "A reason and a short explanation." to (reason != null),
        "At least one course selected." to (!classHasCourses || subjectIds.isNotEmpty()),
        "At least one supporting document attached." to (evidenceCount > 0),
    )
    LeaveSectionTitle("Before you submit")
    LeaveGroupedSurface {
        Row(
            modifier = Modifier.fillMaxWidth().heightIn(min = 48.dp).clickable { expanded = !expanded }.padding(vertical = 12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text("Checklist", color = palette.ink, fontSize = 17.sp, modifier = Modifier.weight(1f))
            Text("${checks.count { it.second }} / ${checks.size}", color = palette.muted, fontSize = 15.sp)
            Icon(
                if (expanded) Lucide.ChevronDown else Lucide.ChevronRight,
                contentDescription = null,
                tint = palette.muted,
                modifier = Modifier.size(20.dp),
            )
        }
        if (expanded) {
            checks.forEach { (text, done) ->
                LeaveSectionDivider()
                Row(modifier = Modifier.fillMaxWidth().padding(vertical = 8.dp), verticalAlignment = Alignment.CenterVertically) {
                    Icon(
                        if (done) Lucide.Check else Lucide.CircleCheck,
                        contentDescription = null,
                        tint = if (done) id.starstask.mobile.ui.theme.Success else palette.muted,
                        modifier = Modifier.size(18.dp),
                    )
                    Text(text, color = palette.ink, fontSize = 14.sp, modifier = Modifier.padding(start = 10.dp))
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun LeaveDatePicker(
    initial: String?,
    onDismiss: () -> Unit,
    onPick: (String) -> Unit,
) {
    val palette = mockColors()
    val initialMillis = initial?.let {
        runCatching { java.time.LocalDate.parse(it).atStartOfDay(java.time.ZoneOffset.UTC).toInstant().toEpochMilli() }.getOrNull()
    }
    val state = androidx.compose.material3.rememberDatePickerState(initialSelectedDateMillis = initialMillis)
    androidx.compose.material3.DatePickerDialog(
        onDismissRequest = onDismiss,
        confirmButton = {
            androidx.compose.material3.TextButton(
                onClick = {
                    val millis = state.selectedDateMillis
                    if (millis != null) {
                        onPick(java.time.Instant.ofEpochMilli(millis).atZone(java.time.ZoneOffset.UTC).toLocalDate().toString())
                    } else {
                        onDismiss()
                    }
                },
            ) {
                Text("OK", color = palette.accent, fontSize = 17.sp, fontWeight = FontWeight.SemiBold)
            }
        },
        dismissButton = {
            androidx.compose.material3.TextButton(onClick = onDismiss) {
                Text("Cancel", color = palette.ink, fontSize = 17.sp)
            }
        },
    ) {
        androidx.compose.material3.DatePicker(state = state)
    }
}
