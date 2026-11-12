package id.starstask.mobile.ui.screens.assignmentdetail

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import id.starstask.mobile.data.AssignmentDetail
import id.starstask.mobile.data.formatDateShort
import id.starstask.mobile.ui.icons.Lucide
import id.starstask.mobile.ui.theme.Spacing
import id.starstask.mobile.ui.theme.mockColors
import androidx.compose.material3.MaterialTheme

// Leave-request style detail cards: labelSmall (muted) + bodyMedium (ink),
// 20.dp radius, 1.dp cardBorder, mockColors, Spacing.Block padding.
@Composable
fun InformationCard(detail: AssignmentDetail) {
    val palette = mockColors()
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .background(palette.card)
            .border(1.dp, palette.cardBorder, RoundedCornerShape(12.dp))
            .padding(Spacing.Block),
        verticalArrangement = Arrangement.spacedBy(Spacing.Md),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Icon(Lucide.Info, contentDescription = null, tint = palette.muted, modifier = Modifier.size(16.dp))
            Text(
                "Assignment information",
                style = MaterialTheme.typography.titleSmall,
                color = palette.ink,
                fontWeight = FontWeight.SemiBold,
                modifier = Modifier.padding(start = 8.dp),
            )
        }
        DetailValueRow(label = "Course", value = detail.courseName)
        detail.courseCode?.takeIf { it.isNotBlank() }?.let { DetailValueRow(label = "Course code", value = it) }
        detail.courseDepartment?.takeIf { it.isNotBlank() }?.let { DetailValueRow(label = "Department", value = it) }
        detail.semester?.takeIf { it.isNotBlank() }?.let { DetailValueRow(label = "Semester", value = it) }
        detail.lecturerName?.takeIf { it.isNotBlank() }?.let { DetailValueRow(label = "Lecturer", value = it) }
        detail.academicYear?.takeIf { it.isNotBlank() }?.let { DetailValueRow(label = "Academic year", value = it) }
        detail.assignmentType?.takeIf { it.isNotBlank() }?.let { DetailValueRow(label = "Type", value = it.replaceFirstChar { c -> c.uppercase() }) }
        DetailValueRow(
            label = "Status",
            value = statusLabel(detail.status),
            trailing = { StatusChip(detail.status) },
        )
    }
}

@Composable
private fun DetailValueRow(
    label: String,
    value: String,
    trailing: (@Composable () -> Unit)? = null,
) {
    val palette = mockColors()
    Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
        Text(label, style = MaterialTheme.typography.labelSmall, color = palette.muted)
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween,
        ) {
            Text(value, style = MaterialTheme.typography.bodyMedium, color = palette.ink, modifier = Modifier.weight(1f).padding(end = 12.dp))
            trailing?.invoke()
        }
    }
}

@Composable
fun StatusChip(status: String, modifier: Modifier = Modifier) {
    val palette = mockColors()
    val (label, fg, bg) = when (status) {
        "published" -> Triple("Published", palette.goodFg, palette.goodBg)
        "pending_review", "pending" -> Triple("Pending", palette.fairFg, palette.fairBg)
        "rejected", "revision" -> Triple("Needs changes", palette.riskFg, palette.riskBg)
        "draft" -> Triple("Draft", palette.muted, palette.chip)
        else -> Triple(statusLabel(status), palette.muted, palette.chip)
    }
    Box(
        modifier = modifier
            .clip(RoundedCornerShape(999.dp))
            .background(bg)
            .padding(horizontal = 12.dp, vertical = 6.dp),
    ) {
        Text(label, color = fg, style = MaterialTheme.typography.labelSmall, fontWeight = FontWeight.SemiBold)
    }
}

fun statusLabel(status: String): String = when (status) {
    "published" -> "Published"
    "pending_review", "pending" -> "Pending"
    "rejected" -> "Rejected"
    "revision" -> "Needs changes"
    "draft" -> "Draft"
    else -> status.replace('_', ' ').replaceFirstChar { it.uppercase() }
}

@Composable
fun ContributorCard(displayName: String?, avatarUrl: String?, createdAt: String) {
    val palette = mockColors()
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .background(palette.card)
            .border(1.dp, palette.cardBorder, RoundedCornerShape(12.dp))
            .padding(Spacing.Block),
        verticalArrangement = Arrangement.spacedBy(Spacing.Md),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Icon(Lucide.Users, contentDescription = null, tint = palette.muted, modifier = Modifier.size(16.dp))
            Text(
                "Contributor",
                style = MaterialTheme.typography.titleSmall,
                color = palette.ink,
                fontWeight = FontWeight.SemiBold,
                modifier = Modifier.padding(start = 8.dp),
            )
        }
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(Spacing.Md),
        ) {
            val initials = displayName
                ?.trim()
                ?.takeIf { it.isNotBlank() }
                ?.split(" ", " ")
                ?.filter { it.isNotBlank() }
                ?.take(2)
                ?.joinToString("") { it.first().uppercaseChar().toString() }
                ?: "?"
            Box(
                modifier = Modifier
                    .size(44.dp)
                    .clip(RoundedCornerShape(999.dp))
                    .background(palette.accentSoft),
                contentAlignment = Alignment.Center,
            ) {
                Text(initials, color = palette.accent, fontSize = 15.sp, fontWeight = FontWeight.SemiBold)
            }
            Column {
                Text(
                    displayName ?: "Unknown contributor",
                    style = MaterialTheme.typography.bodyMedium,
                    color = palette.ink,
                    fontWeight = FontWeight.SemiBold,
                    maxLines = 1,
                )
                if (createdAt.isNotBlank()) {
                    Text(
                        "Contributed ${formatDateShort(createdAt)}",
                        style = MaterialTheme.typography.bodySmall,
                        color = palette.muted,
                    )
                }
            }
        }
    }
}

@Composable
fun RevisionHistoryCard(revisions: List<id.starstask.mobile.data.AssignmentRevision>) {
    val palette = mockColors()
    if (revisions.isEmpty()) return
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .background(palette.card)
            .border(1.dp, palette.cardBorder, RoundedCornerShape(12.dp))
            .padding(Spacing.Block),
        verticalArrangement = Arrangement.spacedBy(Spacing.Md),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Icon(Lucide.History, contentDescription = null, tint = palette.muted, modifier = Modifier.size(16.dp))
            Text(
                "Revision history",
                style = MaterialTheme.typography.titleSmall,
                color = palette.ink,
                fontWeight = FontWeight.SemiBold,
                modifier = Modifier.padding(start = 8.dp),
            )
        }
        revisions.forEach { rev ->
            val kind = when (rev.changeKind) {
                "created" -> "Published"
                "moderated" -> "Status changed"
                else -> "Updated"
            }
            Column {
                Text(kind, style = MaterialTheme.typography.bodyMedium, color = palette.ink, fontWeight = FontWeight.Medium)
                val fields = rev.changedFields.takeIf { it.isNotEmpty() }?.joinToString(", ").orEmpty()
                if (fields.isNotBlank()) {
                    Text(fields, style = MaterialTheme.typography.bodySmall, color = palette.muted)
                }
                Text(formatDateShort(rev.createdAt), style = MaterialTheme.typography.labelSmall, color = palette.muted)
            }
        }
    }
}
