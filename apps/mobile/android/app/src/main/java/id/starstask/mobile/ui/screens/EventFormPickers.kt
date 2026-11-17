package id.starstask.mobile.ui.screens

import id.starstask.mobile.ui.theme.Spacing

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import id.starstask.mobile.data.CALENDAR_EVENT_TYPE_LABELS
import id.starstask.mobile.data.OFFICIAL_EVENT_TYPES
import id.starstask.mobile.data.WorkspaceClassOption
import id.starstask.mobile.ui.theme.Accent
import id.starstask.mobile.ui.theme.AccentSoft
import id.starstask.mobile.ui.theme.Border
import id.starstask.mobile.ui.theme.Foreground
import id.starstask.mobile.ui.theme.MutedForeground

// Class / type / subject pickers for EventFormSheet. Extracted to keep form <300 lines.

@Composable
fun EventClassPicker(
    adminClasses: List<WorkspaceClassOption>,
    classId: String,
    onClassChange: (String) -> Unit,
    editing: Boolean,
) {
    Text("Class", style = MaterialTheme.typography.labelLarge, color = Foreground, fontWeight = FontWeight.SemiBold)
    adminClasses.forEach { option ->
        Row(
            modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(8.dp))
                .border(1.dp, if (classId == option.id) Accent else Border, RoundedCornerShape(8.dp))
                .background(if (classId == option.id) AccentSoft else Color.Transparent)
                .clickable(enabled = !editing) { onClassChange(option.id) }
                .padding(horizontal = Spacing.Xl, vertical = Spacing.Lg),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(option.name, color = Foreground, modifier = Modifier.weight(1f))
            if (classId == option.id) Text("Selected", color = Accent, style = MaterialTheme.typography.labelMedium)
        }
    }
    if (editing) {
        Text("The class cannot change when editing an event.", color = MutedForeground, style = MaterialTheme.typography.bodySmall)
    }
}

@Composable
fun EventTypePicker(eventType: String, onTypeChange: (String) -> Unit) {
    Text("Event type", style = MaterialTheme.typography.labelLarge, color = Foreground, fontWeight = FontWeight.SemiBold)
    OFFICIAL_EVENT_TYPES.forEach { type ->
        Row(
            modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(8.dp))
                .border(1.dp, if (eventType == type) Accent else Border, RoundedCornerShape(8.dp))
                .clickable { onTypeChange(type) }
                .padding(horizontal = Spacing.Xl, vertical = Spacing.Lg),
        ) {
            Text(CALENDAR_EVENT_TYPE_LABELS[type] ?: type, color = Foreground, modifier = Modifier.weight(1f))
        }
    }
}

@Composable
fun EventSubjectPicker(
    availableSubjects: List<id.starstask.mobile.data.WorkspaceSubject>,
    subjectId: String?,
    onSubjectChange: (String?) -> Unit,
) {
    if (availableSubjects.isNotEmpty()) {
        Text("Subject (optional)", style = MaterialTheme.typography.labelLarge, color = Foreground, fontWeight = FontWeight.SemiBold)
        Row(horizontalArrangement = Arrangement.spacedBy(Spacing.Sm)) {
            Box(
                modifier = Modifier.clip(RoundedCornerShape(12.dp))
                    .border(1.dp, if (subjectId == null) Accent else Border, RoundedCornerShape(12.dp))
                    .clickable { onSubjectChange(null) }
                    .padding(horizontal = Spacing.Xl, vertical = Spacing.Sm),
            ) { Text("All", style = MaterialTheme.typography.labelMedium) }
            availableSubjects.forEach { subject ->
                Box(
                    modifier = Modifier.clip(RoundedCornerShape(12.dp))
                        .border(1.dp, if (subjectId == subject.id) Accent else Border, RoundedCornerShape(12.dp))
                        .clickable { onSubjectChange(subject.id) }
                        .padding(horizontal = Spacing.Xl, vertical = Spacing.Sm),
                ) { Text(subject.name, style = MaterialTheme.typography.labelMedium) }
            }
        }
    }
}
