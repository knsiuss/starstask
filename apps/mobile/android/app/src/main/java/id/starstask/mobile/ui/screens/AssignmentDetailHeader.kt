package id.starstask.mobile.ui.screens

import id.starstask.mobile.ui.theme.Spacing

import id.starstask.mobile.ui.icons.Lucide

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import id.starstask.mobile.data.Assignment
import id.starstask.mobile.data.AssignmentDetail
import id.starstask.mobile.data.formatDateShort
import id.starstask.mobile.data.formatDeadline
import id.starstask.mobile.data.getDeadlineState
import id.starstask.mobile.data.loadProfileClasses
import id.starstask.mobile.ui.components.BadgeVariant
import id.starstask.mobile.ui.components.DeadlineBadge
import id.starstask.mobile.ui.components.StarsTaskBadge
import id.starstask.mobile.ui.components.StatusBadge
import id.starstask.mobile.ui.components.WebAlert
import id.starstask.mobile.ui.components.WebAlertVariant
import id.starstask.mobile.ui.components.WebCard
import id.starstask.mobile.ui.components.WebCardHeader
import id.starstask.mobile.ui.components.WebSectionTitle
import id.starstask.mobile.ui.theme.Accent
import id.starstask.mobile.ui.theme.Foreground
import id.starstask.mobile.ui.theme.MutedForeground
import id.starstask.mobile.ui.theme.Surface

// Mirrors web /assignments/[id]: breadcrumb, badge row, H1, meta row
// (author / published date / due), then a single-column article card
// (Description, Attachments inline via screen, Drive) — 2-column grid is
// desktop-only on web, so mobile stacks with the same card chrome.

@Composable
fun AssignmentDetailHeader(
    assignment: Assignment,
    detail: AssignmentDetail?,
    onBack: () -> Unit,
    userId: String = "",
) {
    // Breadcrumb: Back -> Assignments (truncated, foreground, medium) like web.
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Spacing.Sm)) {
        Icon(Lucide.ArrowLeft, contentDescription = null, tint = MutedForeground, modifier = Modifier.size(16.dp))
        Text("Assignments", color = MutedForeground, style = MaterialTheme.typography.bodySmall)
        Text("›", color = MutedForeground, style = MaterialTheme.typography.bodySmall)
        Text(
            assignment.title,
            color = Foreground,
            style = MaterialTheme.typography.bodySmall.copy(fontWeight = FontWeight.Medium),
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
        )
    }

    val courseLabel = when {
        !detail?.courseCode.isNullOrBlank() -> "${detail.courseCode} · ${detail.courseName}"
        else -> detail?.courseName ?: assignment.className ?: "Course"
    }
    Row(horizontalArrangement = Arrangement.spacedBy(Spacing.Sm), modifier = Modifier.fillMaxWidth()) {
        StarsTaskBadge(label = courseLabel, variant = BadgeVariant.ACCENT)
        val contentType = detail?.contentType
        if (!contentType.isNullOrBlank()) {
            StarsTaskBadge(label = contentTypeLabel(contentType), variant = BadgeVariant.NEUTRAL)
        }
        val typeLabel = detail?.assignmentType
        if (!typeLabel.isNullOrBlank()) {
            StarsTaskBadge(label = typeLabel.replaceFirstChar { it.uppercase() }, variant = BadgeVariant.NEUTRAL)
        }
    }

    // H1 like web text-2xl sm:text-3xl; mobile uses headlineSmall for parity.
    Text(
        assignment.title,
        color = Foreground,
        style = MaterialTheme.typography.headlineSmall,
        fontWeight = FontWeight.SemiBold,
    )

    // Meta row mirrors web: author, published/submitted date, due.
    val isPublished = detail?.status == "published"
    val publishedAt = detail?.publishedAt ?: detail?.createdAt ?: ""
    val deadline = detail?.deadline ?: assignment.deadline
    Column(verticalArrangement = Arrangement.spacedBy(Spacing.Xxs)) {
        Row(horizontalArrangement = Arrangement.spacedBy(Spacing.Xs), verticalAlignment = Alignment.CenterVertically) {
            MetaIcon(Lucide.Info)
            Text(detail?.authorDisplayName ?: "Contributor", color = MutedForeground, style = MaterialTheme.typography.bodySmall)
        }
        Row(horizontalArrangement = Arrangement.spacedBy(Spacing.Xs), verticalAlignment = Alignment.CenterVertically) {
            Text(if (isPublished) "Published " else "Submitted ", color = MutedForeground, style = MaterialTheme.typography.bodySmall)
            if (publishedAt.isNotBlank()) Text(formatDateShort(publishedAt), color = MutedForeground, style = MaterialTheme.typography.bodySmall)
        }
        if (!deadline.isNullOrBlank()) {
            val state = getDeadlineState(deadline)
            Text(
                "Due " + formatDeadline(deadline),
                color = if (state.name == "OVERDUE") id.starstask.mobile.ui.theme.Danger else MutedForeground,
                style = MaterialTheme.typography.bodySmall,
            )
        }
    }
}

@Composable
private fun MetaIcon(icon: androidx.compose.ui.graphics.vector.ImageVector) {
    Icon(icon, contentDescription = null, tint = MutedForeground, modifier = Modifier.size(14.dp))
}

@Composable
fun AssignmentInfoCard(detail: AssignmentDetail?) {
    if (detail == null) return
    WebCard {
        WebCardHeader(title = "Assignment information", description = "")
        InfoRow("Course", detail.courseName)
        if (!detail.courseCode.isNullOrBlank()) InfoRow("Course code", detail.courseCode)
        if (!detail.className.isNullOrBlank()) InfoRow("Class", detail.className)
        if (!detail.assignmentType.isNullOrBlank()) InfoRow("Type", detail.assignmentType.replaceFirstChar { it.uppercase() })
        Row(modifier = Modifier.fillMaxWidth().padding(vertical = Spacing.Xs), horizontalArrangement = Arrangement.SpaceBetween) {
            Text("Status", color = MutedForeground, style = MaterialTheme.typography.bodySmall)
            StatusBadge(status = detail.status)
        }
    }
}

@Composable
private fun InfoRow(label: String, value: String) {
    Row(modifier = Modifier.fillMaxWidth().padding(vertical = Spacing.Xs), horizontalArrangement = Arrangement.SpaceBetween) {
        Text(label, color = MutedForeground, style = MaterialTheme.typography.bodySmall)
        Text(value, color = Foreground, style = MaterialTheme.typography.bodySmall, fontWeight = FontWeight.Medium)
    }
}

@Composable
fun AssignmentContributorCard(detail: AssignmentDetail?) {
    if (detail?.authorDisplayName.isNullOrBlank()) return
    WebCard {
        WebCardHeader(title = "Contributor", description = "")
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Spacing.Xl)) {
            Box(
                modifier = Modifier.size(36.dp).clip(CircleShape).padding(Spacing.None),
                contentAlignment = Alignment.Center,
            ) {
                // Initial avatar mirrors web fallback (accent-soft circle, initial letter).
                Box(modifier = Modifier.size(36.dp).clip(CircleShape).padding(Spacing.None), contentAlignment = Alignment.Center) {
                    Text(
                        (detail.authorDisplayName?.firstOrNull()?.uppercase() ?: "S"),
                        color = Accent,
                        style = MaterialTheme.typography.titleSmall,
                    )
                }
            }
            Column {
                Text(detail.authorDisplayName!!, color = Foreground, style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.Medium)
                Text("Contributed " + formatDateShort(detail.createdAt), color = MutedForeground, style = MaterialTheme.typography.labelSmall)
            }
        }
    }
}

@Composable
fun AssignmentShareCard(onCopyLink: () -> Unit, onShareWhatsApp: () -> Unit) {
    WebCard {
        WebCardHeader(title = "Share assignment", description = "Share this assignment with your class.")
        Row(horizontalArrangement = Arrangement.spacedBy(Spacing.Md)) {
            OutlinedButton(onClick = onCopyLink) { Text("Copy link") }
            OutlinedButton(onClick = onShareWhatsApp) { Text("Share on WhatsApp") }
        }
    }
}

// Web "Have additional assignment materials?" dashed card with Contribute.
@Composable
fun AssignmentContributeCard(onContribute: () -> Unit) {
    WebCard {
        WebCardHeader(
            title = "Have additional assignment materials?",
            description = "Help your classmates by contributing useful information.",
        )
        OutlinedButton(onClick = onContribute) { Text("Contribute") }
    }
}
