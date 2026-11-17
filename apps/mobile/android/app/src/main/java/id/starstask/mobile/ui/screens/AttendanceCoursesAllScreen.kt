package id.starstask.mobile.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import id.starstask.mobile.data.CourseAttendanceRow
import id.starstask.mobile.data.buildCourseRows
import id.starstask.mobile.data.loadStudentAttendance
import id.starstask.mobile.ui.components.WebButton
import id.starstask.mobile.ui.components.WebButtonVariant
import id.starstask.mobile.ui.components.WebSkeletonCard
import id.starstask.mobile.ui.theme.Spacing
import id.starstask.mobile.ui.theme.mockColors
import id.starstask.mobile.ui.theme.mockPageBrush
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.MaterialTheme
import androidx.compose.ui.text.font.FontWeight

@Composable
fun AttendanceCoursesAllScreen(
    userId: String,
    onBack: () -> Unit,
    onOpenCourse: (Triple<String, String, String?>) -> Unit,
) {
    val palette = mockColors()
    var rows by remember { mutableStateOf<List<CourseAttendanceRow>?>(null) }
    var error by remember { mutableStateOf<String?>(null) }

    LaunchedEffect(userId) {
        try {
            rows = buildCourseRows(loadStudentAttendance(userId))
            error = null
        } catch (_: Exception) {
            error = "Could not load your courses. Check your connection and try again."
        }
    }

    LazyColumn(
        modifier = Modifier.fillMaxSize().background(mockPageBrush()),
        contentPadding = PaddingValues(
            start = Spacing.Section,
            end = Spacing.Section,
            top = Spacing.Sm,
            bottom = 104.dp,
        ),
        verticalArrangement = Arrangement.spacedBy(Spacing.Xxl),
    ) {
        item {
            Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                Text(
                    "All courses",
                    color = palette.ink,
                    style = MaterialTheme.typography.titleLarge,
                    fontSize = 22.sp,
                    fontWeight = FontWeight.SemiBold,
                )
                Text(
                    "Attendance per enrolled course, ordered by course code.",
                    color = palette.muted,
                    style = MaterialTheme.typography.bodySmall,
                )
            }
        }
        when {
            error != null -> item {
                Column(verticalArrangement = Arrangement.spacedBy(Spacing.Md)) {
                    androidx.compose.material3.Text(error!!, color = palette.ink)
                    WebButton(label = "Back", onClick = onBack, variant = WebButtonVariant.SECONDARY)
                }
            }
            rows == null -> items(4) { WebSkeletonCard() }
            rows.isNullOrEmpty() -> item {
                androidx.compose.material3.Text(
                    "No courses yet. Join a class that has subjects first.",
                    color = palette.muted,
                    style = MaterialTheme.typography.bodyMedium,
                )
            }
            else -> item {
                Column(modifier = Modifier.fillMaxWidth()) {
                    CourseAttendanceSection(
                        rows = rows!!,
                        onOpenCourse = onOpenCourse,
                        onViewAll = null,
                    )
                }
            }
        }
    }
}
