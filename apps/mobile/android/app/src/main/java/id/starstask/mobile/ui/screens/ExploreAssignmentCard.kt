package id.starstask.mobile.ui.screens

import id.starstask.mobile.ui.theme.Spacing

import android.content.Intent
import android.net.Uri
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import id.starstask.mobile.data.ExploreAssignment
import id.starstask.mobile.data.deadlineStateLabel
import id.starstask.mobile.data.excerpt
import id.starstask.mobile.data.formatCreatedDate
import id.starstask.mobile.data.formatDeadline
import id.starstask.mobile.data.getDeadlineState
import id.starstask.mobile.data.pluralize
import id.starstask.mobile.ui.theme.Accent
import id.starstask.mobile.ui.theme.Danger
import id.starstask.mobile.ui.theme.Foreground
import id.starstask.mobile.ui.components.WebCompactCard
import id.starstask.mobile.ui.components.WebEmptyState
import id.starstask.mobile.ui.theme.MutedForeground
import id.starstask.mobile.ui.theme.Warning

// Translation of AssignmentCard.tsx + DeadlineBadge.tsx + AssignmentList empty state.

@Composable
fun AssignmentEmptyState(onRetry: (() -> Unit)? = null) {
    WebEmptyState(
        title = "No assignments found",
        description = "Try a different search, or be the first to contribute an assignment for this course.",
        modifier = Modifier.fillMaxWidth(),
    )
}

@Composable
fun ExploreAssignmentCard(
    assignment: ExploreAssignment,
    onOpen: () -> Unit,
    userId: String = "",
    completed: Boolean = false,
    onCompletedChanged: (Boolean) -> Unit = {},
    showCompletion: Boolean = false,
) {
    val courseLabel = if (!assignment.courseCode.isNullOrBlank()) {
        "${assignment.courseCode} · ${assignment.courseName.orEmpty()}"
    } else {
        assignment.courseName.orEmpty()
    }
    WebCompactCard(modifier = Modifier.fillMaxWidth(), onClick = onOpen) {
        Column(verticalArrangement = Arrangement.spacedBy(Spacing.Md)) {
            Row(
                horizontalArrangement = Arrangement.SpaceBetween,
                modifier = Modifier.fillMaxWidth(),
            ) {
                Text(courseLabel, color = MutedForeground, style = MaterialTheme.typography.bodySmall)
                DeadlineBadge(deadline = assignment.deadline)
            }
            if (assignment.contentType != null) {
                Text(
                    if (assignment.contentType == "class_announcement") {
                        "Class announcement"
                    } else {
                        "Lecturer assignment"
                    },
                    color = Accent,
                    style = MaterialTheme.typography.bodySmall,
                )
                if (assignment.contentType != "class_announcement" && !assignment.sourceLabel.isNullOrBlank()) {
                    Text(
                        assignment.sourceLabel,
                        color = MutedForeground,
                        style = MaterialTheme.typography.bodySmall,
                    )
                }
            }
            if (!assignment.semester.isNullOrBlank()) {
                Text(
                    assignment.semester,
                    color = MutedForeground,
                    style = MaterialTheme.typography.bodySmall,
                )
            }
            Text(assignment.title, style = MaterialTheme.typography.titleMedium, color = Foreground)
            Text(
                excerpt(assignment.description, 200),
                color = MutedForeground,
                style = MaterialTheme.typography.bodySmall,
            )
            if (assignment.tags.isNotEmpty()) {
                Row(horizontalArrangement = Arrangement.spacedBy(Spacing.Sm)) {
                    assignment.tags.take(4).forEach { tag ->
                        Text("#$tag", color = MutedForeground, style = MaterialTheme.typography.bodySmall)
                    }
                }
            }
            Row(horizontalArrangement = Arrangement.SpaceBetween, modifier = Modifier.fillMaxWidth()) {
                Text(
                    listOfNotNull(
                        assignment.authorDisplayName,
                        assignment.createdAt?.let { formatCreatedDate(it) },
                    ).joinToString(" · "),
                    color = MutedForeground,
                    style = MaterialTheme.typography.bodySmall,
                )
                Row(horizontalArrangement = Arrangement.spacedBy(Spacing.Xl)) {
                    if (!assignment.driveUrl.isNullOrBlank()) {
                        val context = LocalContext.current
                        Text(
                            "Drive",
                            color = Accent,
                            style = MaterialTheme.typography.bodySmall,
                            modifier = Modifier.clickable {
                                context.startActivity(
                                    Intent(Intent.ACTION_VIEW, Uri.parse(assignment.driveUrl)),
                                )
                            },
                        )
                    }
                    if (assignment.attachmentCount > 0) {
                        Text(
                            "${assignment.attachmentCount} ${pluralize(assignment.attachmentCount, "file")}",
                            color = MutedForeground,
                            style = MaterialTheme.typography.bodySmall,
                        )
                    }
                    if (showCompletion) {
                        CompletionToggle(
                            userId = userId,
                            assignmentId = assignment.id,
                            completed = completed,
                            title = assignment.title,
                            onChanged = onCompletedChanged,
                        )
                    }
                }
            }
        }
    }
}

@Composable
fun DeadlineBadge(deadline: String?) {
    val state = getDeadlineState(deadline)
    val label = if (state.name == "NONE" || deadline == null) {
        "No deadline"
    } else {
        "${deadlineStateLabel(state)} · ${formatDeadline(deadline)}"
    }
    val color = when (state.name) {
        "OVERDUE" -> Danger
        "DUE_TODAY" -> Warning
        else -> Accent
    }
    Text(label, color = color, style = MaterialTheme.typography.bodySmall)
}
