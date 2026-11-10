package id.starstask.mobile.ui.screens

// Grouped sections for the leave request form, aligned to the pastel
// dashboard palette. White surfaces with hairline borders and 20dp radii;
// no WebCard chrome, no per-section icon badges, no grey hero cards.

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
import id.starstask.mobile.ui.theme.Danger
import id.starstask.mobile.ui.theme.mockColors

val leaveRadius = RoundedCornerShape(20.dp)

@Composable
fun LeaveSectionTitle(text: String) {
    val palette = mockColors()
    Text(
        text.uppercase(),
        color = palette.muted,
        fontSize = 13.sp,
        fontWeight = FontWeight.Medium,
        modifier = Modifier.padding(start = 16.dp, bottom = 8.dp),
    )
}

@Composable
fun LeaveGroupedSurface(content: @Composable ColumnScope.() -> Unit) {
    val palette = mockColors()
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .border(0.5.dp, palette.cardBorder, leaveRadius)
            .background(palette.card, leaveRadius)
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
    val palette = mockColors()
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
            color = palette.ink,
            fontSize = 17.sp,
            modifier = Modifier.weight(1f),
        )
        Text(
            value ?: placeholder,
            color = if (value == null) palette.muted else palette.ink,
            fontSize = 17.sp,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            modifier = Modifier.padding(horizontal = 8.dp),
        )
        Icon(
            Lucide.ChevronRight,
            contentDescription = null,
            tint = palette.muted,
            modifier = Modifier.size(20.dp),
        )
    }
}

@Composable
fun LeaveSectionDivider() {
    HorizontalDivider(color = mockColors().cardBorder)
}

@Composable
fun LeaveFootnote(text: String) {
    val palette = mockColors()
    Text(
        text,
        color = palette.muted,
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
    val palette = mockColors()
    Row(
        modifier = Modifier.fillMaxWidth().padding(vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(
            Lucide.FileText,
            contentDescription = null,
            tint = palette.muted,
            modifier = Modifier.size(22.dp),
        )
        Column(modifier = Modifier.weight(1f).padding(horizontal = 12.dp)) {
            Text(
                file.name,
                color = palette.ink,
                fontSize = 15.sp,
                fontWeight = FontWeight.Medium,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            Text(
                formatLeaveFileSize(file.size),
                color = palette.muted,
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
