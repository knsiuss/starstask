package id.starstask.mobile.ui.screens.classdir

// Glossy Assignments tab: real rows from listAssignmentPage scoped to this
// class, with a course filter and tap-to-detail. Not the legacy
// ClassAssignmentsTabClean — that one is shared with ClassDetailScreen.kt.

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import id.starstask.mobile.ui.components.StaggerDots
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.produceState
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import id.starstask.mobile.data.ExploreAssignment
import id.starstask.mobile.data.formatShortDayMonth
import id.starstask.mobile.data.listAssignmentPage
import id.starstask.mobile.data.listClassCourses
import id.starstask.mobile.ui.icons.Lucide
import id.starstask.mobile.ui.theme.mockColors

@Composable
fun ClassAssignmentsGlossy(
    classId: String,
    reloadTick: Int,
    onOpenAssignment: (id.starstask.mobile.data.Assignment) -> Unit,
    onReviewQueue: () -> Unit,
    isAdmin: Boolean,
) {
    val palette = mockColors()
    var courseFilter by remember { mutableStateOf<String?>(null) }

    val courses by produceState(initialValue = emptyList<id.starstask.mobile.data.ClassCourse>(), key1 = classId) {
        value = runCatching { listClassCourses(classId, includeArchived = false) }.getOrDefault(emptyList())
    }

    val state by produceState(
        initialValue = AssignmentsState(),
        key1 = classId,
        key2 = courseFilter,
        key3 = reloadTick,
    ) {
        value = try {
            val page = listAssignmentPage(
                classId = classId,
                courseId = courseFilter,
                sort = "newest",
                page = 1,
                pageSize = 30,
            )
            AssignmentsState(items = page.items, loading = false)
        } catch (_: Exception) {
            AssignmentsState(loading = false, failed = true)
        }
    }

    Column(verticalArrangement = Arrangement.spacedBy(14.dp)) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            Text(
                "Assignments",
                color = palette.ink,
                fontSize = 20.sp,
                fontWeight = FontWeight.SemiBold,
                modifier = Modifier.weight(1f),
            )
            if (isAdmin) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                    modifier = Modifier
                        .clip(RoundedCornerShape(999.dp))
                        .background(palette.chip)
                        .clickable(onClick = onReviewQueue)
                        .heightIn(min = 36.dp)
                        .padding(horizontal = 12.dp, vertical = 7.dp),
                ) {
                    Icon(Lucide.ClipboardCheck, contentDescription = null, tint = palette.accent, modifier = Modifier.size(15.dp))
                    Text("Review queue", color = palette.accent, fontSize = 13.sp, fontWeight = FontWeight.SemiBold)
                }
            }
        }

        CourseFilterRow(
            selected = courseFilter,
            courses = courses,
            onSelect = { courseFilter = if (courseFilter == it) null else it },
            onClear = { courseFilter = null },
            palette = palette,
        )

        Box(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(22.dp))
                .background(palette.card)
                .border(1.dp, palette.cardBorder, RoundedCornerShape(22.dp)),
        ) {
            when {
                state.loading -> Box(modifier = Modifier.fillMaxWidth().padding(24.dp), contentAlignment = Alignment.Center) {
                }
                state.failed -> Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Text("Could not load assignments.", color = palette.muted, fontSize = 13.sp)
                }
                state.items.isEmpty() -> Text(
                    if (courseFilter == null) "No published assignments yet." else "No published assignments in this course.",
                    color = palette.muted,
                    fontSize = 13.sp,
                    modifier = Modifier.padding(16.dp),
                )
                else -> Column {
                    state.items.forEachIndexed { index, item ->
                        if (index > 0) GlossyHairline(palette)
                        AssignmentRow(
                            item = item,
                            onClick = {
                                onOpenAssignment(
                                    id.starstask.mobile.data.Assignment(
                                        id = item.id,
                                        title = item.title,
                                        status = "published",
                                        deadline = item.deadline,
                                        className = item.courseName ?: item.courseCode,
                                    ),
                                )
                            },
                            palette = palette,
                        )
                    }
                }
            }
        }
    }
}

private data class AssignmentsState(
    val items: List<ExploreAssignment> = emptyList(),
    val loading: Boolean = true,
    val failed: Boolean = false,
)

@Composable
private fun CourseFilterRow(
    selected: String?,
    courses: List<id.starstask.mobile.data.ClassCourse>,
    onSelect: (String) -> Unit,
    onClear: () -> Unit,
    palette: id.starstask.mobile.ui.theme.MockPalette,
) {
    if (courses.isEmpty()) return
    androidx.compose.foundation.layout.Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        FilterChip(
            label = "All",
            selected = selected == null,
            onClick = onClear,
            palette = palette,
        )
        courses.take(6).forEach { course ->
            FilterChip(
                label = course.code ?: course.name,
                selected = selected == course.id,
                onClick = { onSelect(course.id) },
                palette = palette,
            )
        }
    }
}

@Composable
private fun FilterChip(
    label: String,
    selected: Boolean,
    onClick: () -> Unit,
    palette: id.starstask.mobile.ui.theme.MockPalette,
) {
    Box(
        modifier = Modifier
            .clip(RoundedCornerShape(999.dp))
            .background(if (selected) palette.accent else palette.chip)
            .clickable(onClick = onClick)
            .heightIn(min = 34.dp)
            .padding(horizontal = 12.dp, vertical = 7.dp),
    ) {
        Text(
            label,
            color = if (selected) androidx.compose.ui.graphics.Color.White else palette.ink,
            fontSize = 12.sp,
            fontWeight = FontWeight.SemiBold,
            maxLines = 1,
        )
    }
}

@Composable
internal fun AssignmentRow(
    item: ExploreAssignment,
    onClick: () -> Unit,
    palette: id.starstask.mobile.ui.theme.MockPalette,
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .padding(horizontal = 16.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(
                item.title,
                color = palette.ink,
                fontSize = 14.sp,
                fontWeight = FontWeight.SemiBold,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis,
            )
            Text(
                item.courseName ?: item.courseCode ?: "Assignment",
                color = palette.muted,
                fontSize = 12.sp,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
        }
        Column(horizontalAlignment = Alignment.End, verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(
                item.deadline?.let { formatShortDayMonth(it.take(10)) } ?: "No deadline",
                color = palette.accent,
                fontSize = 13.sp,
                fontWeight = FontWeight.Medium,
            )
            if (item.attachmentCount > 0) {
                Text("${item.attachmentCount} file${if (item.attachmentCount == 1L) "" else "s"}", color = palette.muted, fontSize = 11.sp)
            }
        }
    }
}

@Composable
internal fun GlossyHairline(palette: id.starstask.mobile.ui.theme.MockPalette) {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .height(1.dp)
            .background(palette.hairline),
    )
}
