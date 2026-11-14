package id.starstask.mobile.ui.screens

import id.starstask.mobile.ui.theme.Spacing

import id.starstask.mobile.ui.icons.Lucide

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import id.starstask.mobile.data.ASSIGNMENT_TYPES
import id.starstask.mobile.data.WorkspaceClassOption
import id.starstask.mobile.ui.theme.Foreground
import id.starstask.mobile.ui.theme.dashColors
import id.starstask.mobile.ui.theme.MutedForeground
import id.starstask.mobile.ui.theme.Surface

// Filter redesign: the old four horizontal chip rows are gone. Tapping
// Filter opens this sheet; selections are staged locally and applied on
// "Apply filters" so the list only reloads once. ModalBottomSheet is
// scrollable by default, so it stays usable on small screens.

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AssignmentsFilterSheet(
    initialType: String?,
    initialStatus: String,
    initialClassId: String?,
    initialSort: String,
    classes: List<WorkspaceClassOption>,
    manages: Boolean,
    onDismiss: () -> Unit,
    onApply: (type: String?, status: String, classId: String?, sort: String) -> Unit,
) {
    val palette = dashColors()
    var type = initialType
    var status = initialStatus
    var classId = initialClassId
    var sort = initialSort
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = sheetState,
        containerColor = Surface,
    ) {
        LazyColumn(
            modifier = Modifier
                .fillMaxWidth()
                .imePadding()
                .padding(horizontal = Spacing.Block, vertical = Spacing.Md),
            verticalArrangement = Arrangement.spacedBy(Spacing.Sections),
        ) {
            item {
                Text("Filters", style = MaterialTheme.typography.titleMedium, color = Foreground, fontWeight = FontWeight.SemiBold)
            }
            item {
                FilterGroup(
                    label = "Type",
                    options = listOf<String?>(null) + ASSIGNMENT_TYPES,
                    labels = listOf("All types") + ASSIGNMENT_TYPES.map { it.replaceFirstChar { c -> c.uppercase() } },
                    selected = type,
                    onSelect = { type = it },
                )
            }
            item {
                val statusOptions = if (manages) SCHEDULE_STATUSES + REVIEW_STATUSES else SCHEDULE_STATUSES
                FilterGroup(
                    label = "Status",
                    options = statusOptions.map { it.first as String? },
                    labels = statusOptions.map { it.second },
                    selected = status,
                    onSelect = { value -> if (value != null) status = value },
                )
            }
            item {
                FilterGroup(
                    label = "Class",
                    options = listOf<String?>(null) + classes.map { it.id },
                    labels = listOf("All classes") + classes.map { it.name },
                    selected = classId,
                    onSelect = { classId = it },
                )
            }
            item {
                FilterGroup(
                    label = "Sort",
                    options = SORTS.map { it.first as String? },
                    labels = SORTS.map { it.second },
                    selected = sort,
                    onSelect = { value -> if (value != null) sort = value },
                )
            }
            item {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(Spacing.Md),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    TextButton(
                        onClick = {
                            type = null
                            status = "all"
                            classId = null
                            sort = "newest"
                        },
                        modifier = Modifier.weight(1f),
                    ) {
                        Text("Reset filters", color = MutedForeground)
                    }
                    TextButton(
                        onClick = { onApply(type, status, classId, sort) },
                        modifier = Modifier.weight(1f),
                    ) {
                        Text("Apply filters", color = palette.accent, fontWeight = FontWeight.SemiBold)
                    }
                }
            }
        }
    }
}

@Composable
private fun FilterGroup(
    label: String,
    options: List<String?>,
    labels: List<String>,
    selected: String?,
    onSelect: (String?) -> Unit,
) {
    val palette = dashColors()
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.Sm)) {
        Text(label, color = MutedForeground, style = MaterialTheme.typography.labelSmall, fontWeight = FontWeight.SemiBold)
        options.forEachIndexed { index, value ->
            val text = labels[index]
            val active = selected == value
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(12.dp))
                    .background(if (active) Surface else Surface)
                    .clickable { onSelect(value) }
                    .padding(horizontal = Spacing.Md, vertical = Spacing.Xl),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween,
            ) {
                Text(
                    text,
                    color = if (active) palette.accent else Foreground,
                    style = MaterialTheme.typography.bodyMedium,
                    fontWeight = if (active) FontWeight.SemiBold else FontWeight.Normal,
                    modifier = Modifier.weight(1f),
                )
                if (active) {
                    Icon(Lucide.Check, contentDescription = "Selected", tint = palette.accent, modifier = Modifier.size(Spacing.Section))
                }
            }
        }
    }
}

fun activeFilterCount(type: String?, status: String, classId: String?, sort: String, defaultSort: String = "newest"): Int {
    var count = 0
    if (type != null) count++
    if (status != "all") count++
    if (classId != null) count++
    if (sort != defaultSort) count++
    return count
}
