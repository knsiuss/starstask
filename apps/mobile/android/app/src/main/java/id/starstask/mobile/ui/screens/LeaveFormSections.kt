package id.starstask.mobile.ui.screens

// Apple-clean grouped sections for the leave request form. Follows the
// Assignment / Profile language: light page background, white grouped
// surfaces with hairline borders and 20dp radii, disclosure rows. No
// WebCard chrome, no per-section icon badges, no grey hero cards.

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import id.starstask.mobile.data.StagedEvidenceFile
import id.starstask.mobile.ui.icons.Lucide
import id.starstask.mobile.ui.theme.AssignmentBorder
import id.starstask.mobile.ui.theme.AssignmentForeground
import id.starstask.mobile.ui.theme.AssignmentSecondary
import id.starstask.mobile.ui.theme.Danger

val leaveRadius = RoundedCornerShape(20.dp)
val leaveDividerColor = AssignmentBorder

@Composable
fun LeaveSectionTitle(text: String) {
    Text(
        text.uppercase(),
        color = AssignmentSecondary,
        fontSize = 13.sp,
        fontWeight = FontWeight.Medium,
        modifier = Modifier.padding(start = 16.dp, bottom = 8.dp),
    )
}

@Composable
fun LeaveGroupedSurface(content: @Composable ColumnScope.() -> Unit) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .border(0.5.dp, leaveDividerColor, leaveRadius)
            .background(androidx.compose.ui.graphics.Color.White, leaveRadius)
            .padding(horizontal = 16.dp, vertical = 4.dp),
        content = content,
    )
}

@Composable
fun LeaveDisclosureRow(
    label: String,
    value: String?,
    placeholder: String,
    onClick: () -> Unit,
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .heightIn(min = 48.dp)
            .clickable(onClick = onClick)
            .padding(vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            label,
            color = AssignmentForeground,
            fontSize = 17.sp,
            modifier = Modifier.weight(1f),
        )
        Text(
            value ?: placeholder,
            color = if (value == null) AssignmentSecondary else AssignmentForeground,
            fontSize = 17.sp,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            modifier = Modifier.padding(horizontal = 8.dp),
        )
        Icon(
            Lucide.ChevronRight,
            contentDescription = null,
            tint = AssignmentSecondary,
            modifier = Modifier.size(20.dp),
        )
    }
}

@Composable
fun LeaveSectionDivider() {
    HorizontalDivider(color = leaveDividerColor)
}

@Composable
fun LeaveFootnote(text: String) {
    Text(
        text,
        color = AssignmentSecondary,
        fontSize = 13.sp,
        lineHeight = 18.sp,
        modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp),
    )
}

@Composable
fun LeaveEvidenceRow(
    file: StagedEvidenceFile,
    onRemove: (StagedEvidenceFile) -> Unit,
) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(
            Lucide.FileText,
            contentDescription = null,
            tint = AssignmentSecondary,
            modifier = Modifier.size(22.dp),
        )
        Column(modifier = Modifier.weight(1f).padding(horizontal = 12.dp)) {
            Text(
                file.name,
                color = AssignmentForeground,
                fontSize = 15.sp,
                fontWeight = FontWeight.Medium,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            Text(
                formatLeaveFileSize(file.size),
                color = AssignmentSecondary,
                fontSize = 13.sp,
            )
        }
        IconButton(onClick = { onRemove(file) }) {
            Icon(Lucide.X, contentDescription = "Remove file", tint = Danger)
        }
    }
}

fun formatLeaveFileSize(bytes: Long): String = when {
    bytes < 1024 -> "$bytes B"
    bytes < 1024 * 1024 -> "%.1f KB".format(bytes / 1024.0)
    else -> "%.1f MB".format(bytes / (1024.0 * 1024.0))
}
