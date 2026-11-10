package id.starstask.mobile.ui.screens

import id.starstask.mobile.ui.theme.Spacing

import id.starstask.mobile.ui.icons.Lucide

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.TextButton
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.material3.DatePicker
import androidx.compose.material3.DatePickerDialog
import androidx.compose.material3.rememberDatePickerState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import id.starstask.mobile.data.StudentAttendanceView
import id.starstask.mobile.ui.theme.mockColors

// Filter redesign: replaces the 7 permanent chips + per-field AlertDialogs.
// One Filter button opens this sheet; selections are staged locally and
// applied on "Apply filters" so the list reloads once. ModalBottomSheet is
// scrollable by default, so it stays usable on small screens.

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AttendanceFilterSheet(
    base: StudentAttendanceView?,
    initialClassId: String?,
    initialSubjectId: String?,
    initialStatus: String,
    initialSemester: String?,
    initialYear: String?,
    initialFrom: String?,
    initialTo: String?,
    onDismiss: () -> Unit,
    onApply: (
        classId: String?,
        subjectId: String?,
        status: String,
        semester: String?,
        year: String?,
        from: String?,
        to: String?,
    ) -> Unit,
) {
    val palette = mockColors()
    var classId by remember { mutableStateOf(initialClassId) }
    var subjectId by remember { mutableStateOf(initialSubjectId) }
    var status by remember { mutableStateOf(initialStatus) }
    var semester by remember { mutableStateOf(initialSemester) }
    var year by remember { mutableStateOf(initialYear) }
    var from by remember { mutableStateOf(initialFrom) }
    var to by remember { mutableStateOf(initialTo) }
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
    var dateTarget by remember { mutableStateOf<String?>(null) }

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = sheetState,
        containerColor = palette.card,
    ) {
        LazyColumn(
            modifier = Modifier
                .fillMaxWidth()
                .imePadding()
                .padding(horizontal = Spacing.Block, vertical = Spacing.Md),
            verticalArrangement = Arrangement.spacedBy(Spacing.Sections),
        ) {
            item {
                Text(
                    "Filters",
                    style = MaterialTheme.typography.titleMedium,
                    color = palette.ink,
                    fontWeight = FontWeight.SemiBold,
                )
            }
            item {
                AttendanceFilterGroup(
                    label = "Class",
                    options = listOf<String?>(null) + (base?.classes?.map { it.id } ?: emptyList()),
                    labels = listOf("All classes") + (base?.classes?.map { it.name } ?: emptyList()),
                    selected = classId,
                    onSelect = { classId = it },
                )
            }
            item {
                val subjects = base?.subjects ?: emptyList()
                AttendanceFilterGroup(
                    label = "Course",
                    options = listOf<String?>(null) + subjects.map { it.id },
                    labels = listOf("All courses") +
                        subjects.map { ((it.code?.let { "$it · " } ?: "") + it.name) },
                    selected = subjectId,
                    onSelect = { subjectId = it },
                )
            }
            item {
                // Status "all" is always an option; picking All never narrows to null.
                AttendanceFilterGroup(
                    label = "Status",
                    options = STATUS_OPTIONS.map { it.first as String? },
                    labels = STATUS_OPTIONS.map { it.second },
                    selected = status,
                    onSelect = { value -> if (value != null) status = value },
                )
            }
            item {
                AttendanceFilterGroup(
                    label = "Semester",
                    options = listOf<String?>(null) + (base?.semesters ?: emptyList()),
                    labels = listOf("All semesters") + (base?.semesters ?: emptyList()),
                    selected = semester,
                    onSelect = { semester = it },
                )
            }
            item {
                AttendanceFilterGroup(
                    label = "Academic year",
                    options = listOf<String?>(null) + (base?.academicYears ?: emptyList()),
                    labels = listOf("All years") + (base?.academicYears ?: emptyList()),
                    selected = year,
                    onSelect = { year = it },
                )
            }
            item {
                Column(verticalArrangement = Arrangement.spacedBy(Spacing.Sm)) {
                    Text(
                        "Date range",
                        color = palette.muted,
                        style = MaterialTheme.typography.labelSmall,
                        fontWeight = FontWeight.SemiBold,
                    )
                    Row(horizontalArrangement = Arrangement.spacedBy(Spacing.Md)) {
                        AttendanceDateField(
                            label = "From date",
                            value = from,
                            modifier = Modifier.weight(1f),
                            onClick = { dateTarget = "from" },
                        )
                        AttendanceDateField(
                            label = "To date",
                            value = to,
                            modifier = Modifier.weight(1f),
                            onClick = { dateTarget = "to" },
                        )
                    }
                }
            }
            item {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(Spacing.Md),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    TextButton(
                        onClick = {
                            classId = null
                            subjectId = null
                            status = "all"
                            semester = null
                            year = null
                            from = null
                            to = null
                        },
                        modifier = Modifier.weight(1f),
                    ) {
                        Text("Reset filters", color = palette.muted)
                    }
                    TextButton(
                        onClick = { onApply(classId, subjectId, status, semester, year, from, to) },
                        modifier = Modifier.weight(1f),
                    ) {
                        Text("Apply filters", color = palette.accent, fontWeight = FontWeight.SemiBold)
                    }
                }
            }
        }
    }

    if (dateTarget != null) {
        val isFrom = dateTarget == "from"
        val initial = if (isFrom) from else to
        val state = rememberDatePickerState(
            initialSelectedDateMillis =
                initial?.let { raw ->
                    runCatching {
                        java.time.LocalDate.parse(raw)
                            .atStartOfDay(java.time.ZoneOffset.UTC)
                            .toInstant()
                            .toEpochMilli()
                    }.getOrNull()
                },
        )
        DatePickerDialog(
            onDismissRequest = { dateTarget = null },
            confirmButton = {
                TextButton(
                    onClick = {
                        state.selectedDateMillis?.let { millis ->
                            val date =
                                java.time.Instant.ofEpochMilli(millis)
                                    .atZone(java.time.ZoneOffset.UTC)
                                    .toLocalDate()
                                    .toString()
                            if (isFrom) from = date else to = date
                        }
                        dateTarget = null
                    },
                ) { Text("OK", color = palette.accent) }
            },
            dismissButton = {
                TextButton(onClick = { dateTarget = null }) { Text("Cancel", color = palette.muted) }
            },
        ) {
            DatePicker(state = state)
        }
    }
}

@Composable
private fun AttendanceFilterGroup(
    label: String,
    options: List<String?>,
    labels: List<String>,
    selected: String?,
    onSelect: (String?) -> Unit,
) {
    val palette = mockColors()
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.Sm)) {
        Text(
            label,
            color = palette.muted,
            style = MaterialTheme.typography.labelSmall,
            fontWeight = FontWeight.SemiBold,
        )
        options.forEachIndexed { index, value ->
            val text = labels[index]
            val active = selected == value
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(12.dp))
                    .background(if (active) palette.accentSoft else palette.card)
                    .clickable { onSelect(value) }
                    .padding(horizontal = Spacing.Md, vertical = Spacing.Xl),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween,
            ) {
                Text(
                    text,
                    color = if (active) palette.accent else palette.ink,
                    style = MaterialTheme.typography.bodyMedium,
                    fontWeight = if (active) FontWeight.SemiBold else FontWeight.Normal,
                    maxLines = 1,
                    modifier = Modifier.weight(1f),
                )
                if (active) {
                    Icon(
                        Lucide.Check,
                        contentDescription = "Selected",
                        tint = palette.accent,
                        modifier = Modifier.size(Spacing.Section),
                    )
                }
            }
        }
    }
}

@Composable
private fun AttendanceDateField(
    label: String,
    value: String?,
    modifier: Modifier = Modifier,
    onClick: () -> Unit,
) {
    val palette = mockColors()
    Box(
        modifier = modifier
            .clip(RoundedCornerShape(10.dp))
            .background(palette.card)
            .clickable { onClick() },
        contentAlignment = Alignment.Center,
    ) {
        Text(
            value ?: "Select date",
            color = if (value == null) palette.muted else palette.ink,
            style = MaterialTheme.typography.bodyMedium,
        )
    }
}
