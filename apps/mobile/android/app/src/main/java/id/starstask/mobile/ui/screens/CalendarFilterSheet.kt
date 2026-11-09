package id.starstask.mobile.ui.screens

import id.starstask.mobile.ui.theme.Spacing

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import id.starstask.mobile.ui.theme.Accent
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Checkbox
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import id.starstask.mobile.ui.components.WebButton
import id.starstask.mobile.ui.components.WebButtonVariant
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import id.starstask.mobile.data.CalendarAssignmentBar
import id.starstask.mobile.data.WorkspaceClassOption
import id.starstask.mobile.ui.theme.Accent
import id.starstask.mobile.ui.theme.Border
import id.starstask.mobile.ui.theme.Danger
import id.starstask.mobile.ui.theme.Foreground
import id.starstask.mobile.ui.theme.MutedForeground
import id.starstask.mobile.ui.theme.Success
import id.starstask.mobile.ui.theme.Warning
import id.starstask.mobile.ui.theme.Surface as SurfaceColor

data class CourseOption(
    val key: String,
    val name: String,
    val detail: String?,
    val assignmentCount: Int,
)

// Pastel course dots (web calendar palette). Index range must cover
// courseColorIndex() which returns 0..9.
private val COURSE_DOTS = listOf(
    Accent,
    Warning,
    Danger,
    Success,
    Color(0xFF6B4FA1),
    Color(0xFFB7791F),
    Color(0xFF3E7C8C),
    Color(0xFF96650B),
    Color(0xFF7A4E9E),
    Color(0xFF5A8A4A),
)

/**
 * Mirrors web `buildCourseOptions` (schedule/page.tsx): courses that own
 * assignment bars first (sorted by name), then subject courses without
 * bars. Null `selected` means all courses.
 */
fun courseOptionsOf(
    assignments: List<CalendarAssignmentBar>,
    classes: List<WorkspaceClassOption>,
): List<CourseOption> {
    val counts = assignments.groupingBy { it.courseKey ?: "unassigned" }.eachCount()
    val seen = mutableSetOf<String>()
    val options = mutableListOf<Pair<CourseOption, Int>>()
    for (bar in assignments) {
        val key = bar.courseKey ?: continue
        if (!seen.add(key)) continue
        val detail = listOfNotNull(bar.courseCode, bar.className).joinToString(" · ").ifEmpty { null }
        options += CourseOption(key, bar.courseName ?: "Course", detail, counts[key] ?: 0) to 0
    }
    for (klass in classes) {
        for (subject in klass.subjects) {
            val key = subject.id
            if (!seen.add(key)) continue
            options += CourseOption(key, subject.name, subject.code, 0) to 1
        }
    }
    return options
        .sortedWith(compareBy<Pair<CourseOption, Int>> { it.second }.thenBy { it.first.name })
        .map { it.first }
}

/** Mobile port of web FilterDrawer (TypeSelect + CourseFilterPanel + mine). */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CalendarCourseFilterSheet(
    assignments: List<CalendarAssignmentBar>,
    classes: List<WorkspaceClassOption>,
    selected: Set<String>?,
    mineOnly: Boolean,
    typeFilter: String,
    classFilter: String?,
    onToggleCourse: (String) -> Unit,
    onToggleMine: () -> Unit,
    onSelectType: (String) -> Unit,
    onSelectClass: (String?) -> Unit,
    onReset: () -> Unit,
    onDismiss: () -> Unit,
) {
    val options = courseOptionsOf(assignments, classes)
    ModalBottomSheet(onDismissRequest = onDismiss) {
        Column(
            modifier = Modifier.fillMaxWidth().padding(Spacing.Block).verticalScroll(rememberScrollState()),
            verticalArrangement = Arrangement.spacedBy(Spacing.Xl),
        ) {
            Text("Filters", style = MaterialTheme.typography.titleLarge, color = Foreground, fontWeight = FontWeight.SemiBold)
            Text(
                "Refine the calendar to the courses and event types you need.",
                color = MutedForeground,
                style = MaterialTheme.typography.bodySmall,
            )
            Text("Event type", style = MaterialTheme.typography.labelLarge, color = Foreground, fontWeight = FontWeight.SemiBold)
            listOf("all" to "All events", "assignment" to "Assignment deadline", "class_schedule" to "Class schedule", "exam" to "Exam", "academic_event" to "Academic event", "personal" to "Personal event", "absence" to "Absence notification").forEach { (value, label) ->
                Row(
                    modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(8.dp))
                        .border(1.dp, if (typeFilter == value) id.starstask.mobile.ui.theme.Accent else Border, RoundedCornerShape(8.dp))
                        .clickable { onSelectType(value) }
                        .padding(horizontal = Spacing.Xl, vertical = Spacing.Lg),
                ) {
                    Text(
                        label,
                        color = Foreground,
                        modifier = Modifier.weight(1f),
                    )
                    if (typeFilter == value) {
                        Text("Selected", color = id.starstask.mobile.ui.theme.Accent, style = MaterialTheme.typography.labelMedium)
                    }
                }
            }
            Text("Class", style = MaterialTheme.typography.labelLarge, color = Foreground, fontWeight = FontWeight.SemiBold)
            Row(horizontalArrangement = Arrangement.spacedBy(Spacing.Sm)) {
                Box(
                    modifier = Modifier.clip(RoundedCornerShape(16.dp))
                        .border(1.dp, if (classFilter == null) id.starstask.mobile.ui.theme.Accent else Border, RoundedCornerShape(16.dp))
                        .clickable { onSelectClass(null) }
                        .padding(horizontal = Spacing.Xl, vertical = Spacing.Sm),
                ) { Text("All classes", style = MaterialTheme.typography.labelMedium) }
                classes.forEach { klass ->
                    Box(
                        modifier = Modifier.clip(RoundedCornerShape(16.dp))
                            .border(1.dp, if (classFilter == klass.id) id.starstask.mobile.ui.theme.Accent else Border, RoundedCornerShape(16.dp))
                            .clickable { onSelectClass(if (classFilter == klass.id) null else klass.id) }
                            .padding(horizontal = Spacing.Xl, vertical = Spacing.Sm),
                    ) { Text(klass.name, style = MaterialTheme.typography.labelMedium) }
                }
            }
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween,
            ) {
                Text("Courses", style = MaterialTheme.typography.titleLarge, color = Foreground, fontWeight = FontWeight.SemiBold)
                WebButton(label = "Reset filters", onClick = onReset, variant = WebButtonVariant.LINK)
            }
            options.forEach { option ->
                val checked = selected == null || selected.contains(option.key)
                Row(
                    modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(8.dp))
                        .border(1.dp, Border, RoundedCornerShape(8.dp))
                        .background(if (checked) Color(0xFFE8EDFA) else SurfaceColor)
                        .clickable { onToggleCourse(option.key) }
                        .padding(horizontal = Spacing.Xl, vertical = Spacing.Lg),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(Spacing.Lg),
                ) {
                    Checkbox(checked = checked, onCheckedChange = { onToggleCourse(option.key) })
                    Box(
                        modifier = Modifier.size(10.dp).clip(androidx.compose.foundation.shape.CircleShape)
                            .background(COURSE_DOTS[id.starstask.mobile.data.courseColorIndex(option.key)]),
                    )
                    Column(Modifier.weight(1f)) {
                        Text(option.name, color = Foreground, style = MaterialTheme.typography.bodyMedium)
                        Text(
                            "${option.detail ?: "Course"} · ${option.assignmentCount} ${if (option.assignmentCount == 1) "assignment" else "assignments"}",
                            color = MutedForeground,
                            style = MaterialTheme.typography.bodySmall,
                        )
                    }
                }
            }
            HorizontalDivider(color = Border)
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween,
            ) {
                Column {
                    Text("Show only my assignments", color = Foreground, style = MaterialTheme.typography.bodyMedium)
                    Text("Only the ones you uploaded", color = MutedForeground, style = MaterialTheme.typography.bodySmall)
                }
                Checkbox(checked = mineOnly, onCheckedChange = { onToggleMine() })
            }
            WebButton(label = "Show Results", onClick = onDismiss, modifier = Modifier.fillMaxWidth())
        }
    }
}
