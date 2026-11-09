package id.starstask.mobile.ui.screens

import id.starstask.mobile.ui.theme.Spacing

import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.AssistChip
import androidx.compose.material3.AssistChipDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.unit.dp
import id.starstask.mobile.data.ASSIGNMENT_SORT_LABELS
import id.starstask.mobile.data.ASSIGNMENT_TYPES
import id.starstask.mobile.ui.theme.Accent
import id.starstask.mobile.ui.theme.MutedForeground

// Translation of AssignmentFilters.tsx toolbar controls.
// Web waits for Enter in search (no per-keystroke navigation) — same via ImeAction.Search.

@Composable
fun AssignmentSearchField(
    value: String,
    onValueChange: (String) -> Unit,
    onSearch: () -> Unit,
    onClear: () -> Unit,
) {
    OutlinedTextField(
        value = value,
        onValueChange = onValueChange,
        label = { Text("Search assignments") },
        placeholder = { Text("Search assignments") },
        singleLine = true,
        keyboardOptions = KeyboardOptions(imeAction = ImeAction.Search),
        keyboardActions = KeyboardActions(onSearch = { onSearch() }),
        trailingIcon = {
            if (value.isNotEmpty()) {
                Text(
                    "Clear",
                    color = Accent,
                    style = MaterialTheme.typography.bodySmall,
                    modifier = Modifier.clickableAction(onClear),
                )
            }
        },
        modifier = Modifier.fillMaxWidth(),
    )
}

@Composable
fun AssignmentTypeChips(selected: String?, onSelect: (String?) -> Unit) {
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.Xs)) {
        Text("Type", color = MutedForeground, style = MaterialTheme.typography.bodySmall)
        Row(modifier = Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(Spacing.Sm)) {
            AssistChip(modifier = Modifier.heightIn(min = 32.dp, max = 32.dp),
                onClick = { onSelect(null) },
                label = { Text("All types", maxLines = 1, softWrap = false) },
                colors = chipColors(selected == null),
            )
            ASSIGNMENT_TYPES.forEach { type ->
                AssistChip(modifier = Modifier.heightIn(min = 32.dp, max = 32.dp),
                    onClick = { onSelect(type) },
                    label = { Text(type.replaceFirstChar { it.uppercase() }) },
                    colors = chipColors(selected == type),
                )
            }
        }
    }
}

@Composable
fun AssignmentSortChips(selected: String, onSelect: (String) -> Unit) {
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.Xs)) {
        Text("Sort by", color = MutedForeground, style = MaterialTheme.typography.bodySmall)
        Row(modifier = Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(Spacing.Sm)) {
            ASSIGNMENT_SORT_LABELS.forEach { (key, label) ->
                AssistChip(modifier = Modifier.heightIn(min = 32.dp, max = 32.dp),
                    onClick = { onSelect(key) },
                    label = { Text(label, maxLines = 1, softWrap = false) },
                    colors = chipColors(selected == key),
                )
            }
        }
    }
}

val SCHEDULE_STATUS_OPTIONS = listOf(
    "all" to "All statuses",
    "published" to "Published",
    "upcoming" to "Upcoming deadline",
    "overdue" to "Past deadline",
    "no_deadline" to "No deadline",
)

val COURSE_TAB_OPTIONS = listOf(
    "all" to "All",
    "upcoming" to "Upcoming",
    "in-progress" to "In progress",
    "submitted" to "Submitted",
    "closed" to "Closed",
)

@Composable
fun ScheduleStatusChips(selected: String, onSelect: (String) -> Unit) {
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.Xs)) {
        Text("Status", color = MutedForeground, style = MaterialTheme.typography.bodySmall)
        Row(modifier = Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(Spacing.Sm)) {
            SCHEDULE_STATUS_OPTIONS.forEach { (key, label) ->
                AssistChip(modifier = Modifier.heightIn(min = 32.dp, max = 32.dp),
                    onClick = { onSelect(key) },
                    label = { Text(label, maxLines = 1, softWrap = false) },
                    colors = chipColors(selected == key),
                )
            }
        }
    }
}

@Composable
fun CourseTabChips(selected: String, onSelect: (String) -> Unit) {
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.Xs)) {
        Text("Course tab", color = MutedForeground, style = MaterialTheme.typography.bodySmall)
        Row(modifier = Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(Spacing.Sm)) {
            COURSE_TAB_OPTIONS.forEach { (key, label) ->
                AssistChip(modifier = Modifier.heightIn(min = 32.dp, max = 32.dp),
                    onClick = { onSelect(key) },
                    label = { Text(label, maxLines = 1, softWrap = false) },
                    colors = chipColors(selected == key),
                )
            }
        }
    }
}

@Composable
fun ClassFilterChips(
    classes: List<id.starstask.mobile.data.ClassDetail>,
    selected: String?,
    onSelect: (String?) -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.Xs)) {
        Text("Class", color = MutedForeground, style = MaterialTheme.typography.bodySmall)
        Row(modifier = Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(Spacing.Sm)) {
            AssistChip(modifier = Modifier.heightIn(min = 32.dp, max = 32.dp),
                onClick = { onSelect(null) },
                label = { Text("All classes", maxLines = 1, softWrap = false) },
                colors = chipColors(selected == null),
            )
            classes.forEach { clazz ->
                AssistChip(modifier = Modifier.heightIn(min = 32.dp, max = 32.dp),
                    onClick = { onSelect(clazz.id) },
                    label = {
                        Text(
                            if (clazz.slug.isNotEmpty()) {
                                "${clazz.name} (${clazz.slug})"
                            } else {
                                clazz.name
                            },
                        )
                    },
                    colors = chipColors(selected == clazz.id),
                )
            }
        }
    }
}

@Composable
private fun chipColors(selected: Boolean) =
    if (selected) {
        AssistChipDefaults.assistChipColors(containerColor = id.starstask.mobile.ui.theme.AccentSoft)
    } else {
        AssistChipDefaults.assistChipColors()
    }

private fun Modifier.clickableAction(action: () -> Unit): Modifier =
    this.then(Modifier.clickable(onClick = action))
