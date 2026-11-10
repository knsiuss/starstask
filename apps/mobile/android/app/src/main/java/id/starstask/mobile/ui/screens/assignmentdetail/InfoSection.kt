package id.starstask.mobile.ui.screens.assignmentdetail

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import id.starstask.mobile.data.AssignmentDetail
import id.starstask.mobile.ui.components.StarsTaskBadge
import id.starstask.mobile.ui.components.BadgeVariant
import id.starstask.mobile.ui.icons.Lucide
import id.starstask.mobile.ui.theme.Accent
import id.starstask.mobile.ui.theme.Foreground
import id.starstask.mobile.ui.theme.MutedForeground
import id.starstask.mobile.ui.theme.Surface

@Composable
fun InformationCard(detail: AssignmentDetail) {
    Card(
        colors = CardDefaults.cardColors(containerColor = Surface),
        shape = RoundedCornerShape(12.dp),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(Lucide.Info, contentDescription = null, tint = MutedForeground, modifier = Modifier.size(16.dp))
                Text("Assignment information", color = Foreground, fontSize = 14.sp, fontWeight = FontWeight.SemiBold, modifier = Modifier.padding(start = 8.dp))
            }
            Column(modifier = Modifier.padding(top = 12.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                InfoRow(label = "Course", value = detail.courseName)
                if (!detail.courseCode.isNullOrBlank()) InfoRow(label = "Course code", value = detail.courseCode!!)
                if (!detail.courseDepartment.isNullOrBlank()) InfoRow(label = "Department", value = detail.courseDepartment!!)
                if (!detail.semester.isNullOrBlank()) InfoRow(label = "Semester", value = detail.semester!!)
                if (!detail.lecturerName.isNullOrBlank()) InfoRow(label = "Lecturer", value = detail.lecturerName!!)
                if (!detail.academicYear.isNullOrBlank()) InfoRow(label = "Academic year", value = detail.academicYear!!)
                if (!detail.assignmentType.isNullOrBlank()) InfoRow(label = "Type", value = detail.assignmentType!!.replaceFirstChar { it.uppercase() })
                Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                    Text("Status", color = MutedForeground, fontSize = 13.sp)
                    StatusChip(status = detail.status)
                }
            }
        }
    }
}

@Composable
private fun InfoRow(label: String, value: String) {
    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
        Text(label, color = MutedForeground, fontSize = 13.sp)
        Text(value, color = Foreground, fontSize = 13.sp, fontWeight = FontWeight.Medium, modifier = Modifier.padding(start = 16.dp))
    }
}

@Composable
fun StatusChip(status: String) {
    val (label, variant) = when (status) {
        "published" -> "Published" to BadgeVariant.ACCENT
        "pending_review", "pending" -> "Pending" to BadgeVariant.WARNING
        "rejected", "revision" -> "Needs changes" to BadgeVariant.DANGER
        "draft" -> "Draft" to BadgeVariant.NEUTRAL
        else -> status.replace('_', ' ').replaceFirstChar { it.uppercase() } to BadgeVariant.NEUTRAL
    }
    StarsTaskBadge(label = label, variant = variant)
}

fun breadcrumbText(title: String): String = "Assignments > $title"

@Composable
fun ContributorCard(displayName: String?, avatarUrl: String?, createdAt: String) {
    Card(
        colors = CardDefaults.cardColors(containerColor = Surface),
        shape = RoundedCornerShape(12.dp),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(Lucide.Users, contentDescription = null, tint = MutedForeground, modifier = Modifier.size(16.dp))
                Text("Contributor", color = Foreground, fontSize = 14.sp, fontWeight = FontWeight.SemiBold, modifier = Modifier.padding(start = 8.dp))
            }
            Row(modifier = Modifier.padding(top = 12.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                val initials = displayName
                    ?.trim()
                    ?.takeIf { it.length >= 2 }
                    ?.substring(0, 2)
                    ?.uppercase()
                    ?: (displayName?.firstOrNull()?.uppercase() ?: "?")
                Box(
                    modifier = Modifier
                        .size(40.dp)
                        .clip(RoundedCornerShape(999.dp))
                        .background(androidx.compose.ui.graphics.Color(0xFFE8EDFA)),
                    contentAlignment = Alignment.Center,
                ) {
                    Text(initials, color = Accent, fontSize = 14.sp, fontWeight = FontWeight.SemiBold)
                }
                Column {
                    Text(displayName ?: "Unknown contributor", color = Foreground, fontSize = 14.sp, fontWeight = FontWeight.SemiBold, maxLines = 1)
                    if (createdAt.isNotBlank()) {
                        Text("Contributed ${id.starstask.mobile.data.formatDateShort(createdAt)}", color = MutedForeground, fontSize = 12.sp, modifier = Modifier.padding(top = 2.dp))
                    }
                }
            }
        }
    }
}

@Composable
fun RevisionHistoryCard(revisions: List<id.starstask.mobile.data.AssignmentRevision>) {
    if (revisions.isEmpty()) return
    Card(
        colors = CardDefaults.cardColors(containerColor = Surface),
        shape = RoundedCornerShape(12.dp),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(Lucide.History, contentDescription = null, tint = MutedForeground, modifier = Modifier.size(16.dp))
                Text("Revision history", color = Foreground, fontSize = 14.sp, fontWeight = FontWeight.SemiBold, modifier = Modifier.padding(start = 8.dp))
            }
            Column(modifier = Modifier.padding(top = 12.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                revisions.forEach { rev ->
                    val kind = when (rev.changeKind) {
                        "created" -> "Published"
                        "moderated" -> "Status changed"
                        else -> "Updated"
                    }
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.Top) {
                        Column(modifier = Modifier.weight(1f)) {
                            Text(kind, color = Foreground, fontSize = 13.sp, fontWeight = FontWeight.Medium)
                            val fields = rev.changedFields.takeIf { it.isNotEmpty() }?.joinToString(", ") ?: ""
                            if (fields.isNotBlank()) {
                                Text(fields, color = MutedForeground, fontSize = 12.sp, modifier = Modifier.padding(top = 2.dp))
                            }
                        }
                        Text(id.starstask.mobile.data.formatDateShort(rev.createdAt), color = MutedForeground, fontSize = 12.sp)
                    }
                }
            }
        }
    }
}
