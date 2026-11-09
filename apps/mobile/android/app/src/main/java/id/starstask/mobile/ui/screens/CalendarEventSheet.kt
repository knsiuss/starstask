package id.starstask.mobile.ui.screens

import id.starstask.mobile.ui.theme.Spacing

import id.starstask.mobile.ui.icons.Lucide

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.DatePicker
import androidx.compose.material3.DatePickerDialog
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.TimePicker
import androidx.compose.material3.rememberDatePickerState
import androidx.compose.material3.rememberTimePickerState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import id.starstask.mobile.data.CALENDAR_EVENT_TYPE_LABELS
import id.starstask.mobile.data.CALENDAR_OFFICIAL_WINDOW_MS
import id.starstask.mobile.data.CALENDAR_PERSONAL_WINDOW_MS
import id.starstask.mobile.data.CalendarTimelineItem
import id.starstask.mobile.data.OFFICIAL_EVENT_TYPES
import id.starstask.mobile.data.WorkspaceClassOption
import id.starstask.mobile.data.formatCalendarTime
import id.starstask.mobile.data.formatDayLabel
import id.starstask.mobile.data.jakartaLocalDateTime
import id.starstask.mobile.data.jakartaLocalToInstantIso
import id.starstask.mobile.data.validateCalendarEvent
import id.starstask.mobile.ui.components.WebAlert
import id.starstask.mobile.ui.components.WebButton
import id.starstask.mobile.ui.components.WebButtonVariant
import id.starstask.mobile.ui.theme.Accent
import id.starstask.mobile.ui.theme.AccentSoft
import id.starstask.mobile.ui.theme.Border
import id.starstask.mobile.ui.theme.Danger
import id.starstask.mobile.ui.theme.Foreground
import id.starstask.mobile.ui.theme.MutedForeground
import kotlinx.coroutines.launch
import java.time.Instant
import java.time.LocalDate
import java.time.LocalTime
import java.time.ZoneOffset

@OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class)
@Composable
fun EventDetailSheet(
    userId: String,
    item: CalendarTimelineItem,
    onDismiss: () -> Unit,
    onAssignmentClick: () -> Unit,
    onSessionClick: () -> Unit,
    onLeaveClick: () -> Unit,
    onOpenClass: () -> Unit,
    onEdit: () -> Unit,
) {
    ModalBottomSheet(onDismissRequest = onDismiss) {
        Column(
            modifier = Modifier.fillMaxWidth().padding(Spacing.Block).verticalScroll(rememberScrollState()),
            verticalArrangement = Arrangement.spacedBy(Spacing.Lg),
        ) {
            Text(item.title, style = MaterialTheme.typography.titleLarge, color = Foreground, fontWeight = FontWeight.SemiBold)
            Text(
                CALENDAR_EVENT_TYPE_LABELS[item.kind] ?: "Calendar",
                color = Accent,
                style = MaterialTheme.typography.labelLarge,
            )
            HorizontalDivider(color = Border)
            CalendarDetailRow("Date", formatDayLabel(item.startKey))
            if (item.startKey != item.endKey) CalendarDetailRow("Until", formatDayLabel(item.endKey))
            if (item.startsAtIso.isNotEmpty()) CalendarDetailRow("Time (WIB)", formatCalendarTime(item.startsAtIso))
            if (item.location != null) CalendarDetailRow("Location", item.location)
            if (item.className != null) CalendarDetailRow("Class", item.className)
            if (item.subjectName != null) CalendarDetailRow("Subject", item.subjectName)
            if (item.description != null) CalendarDetailRow("Description", item.description)
            CalendarDetailRow("Status", item.status.replaceFirstChar { it.uppercase() })

            val canEdit = item.editable && item.owner in listOf("personal", "official")
            if (canEdit) {
                WebButton(
                    label = "Edit event",
                    onClick = onEdit,
                    modifier = Modifier.fillMaxWidth(),
                    variant = WebButtonVariant.SECONDARY,
                    icon = Lucide.Pencil,
                )
            }

            when {
                item.kind == "assignment" -> WebButton(
                    label = "Open assignment",
                    onClick = onAssignmentClick,
                    modifier = Modifier.fillMaxWidth(),
                    variant = WebButtonVariant.SECONDARY,
                    icon = Lucide.LogOut,
                )
                item.owner == "absence" -> WebButton(
                    label = "Open absence request",
                    onClick = onLeaveClick,
                    modifier = Modifier.fillMaxWidth(),
                    variant = WebButtonVariant.SECONDARY,
                    icon = Lucide.LogOut,
                )
                item.managedInClass && item.classId != null -> WebButton(
                    label = "Open class schedule",
                    onClick = onOpenClass,
                    modifier = Modifier.fillMaxWidth(),
                    variant = WebButtonVariant.SECONDARY,
                    icon = Lucide.LogOut,
                )
                item.kind == "class_schedule" && item.owner == "official" && !item.managedInClass && item.id.startsWith("session:") -> WebButton(
                    label = "Open session",
                    onClick = onSessionClick,
                    modifier = Modifier.fillMaxWidth(),
                    variant = WebButtonVariant.SECONDARY,
                    icon = Lucide.LogOut,
                )
            }
            WebButton(label = "Close", onClick = onDismiss, variant = WebButtonVariant.GHOST)
        }
    }
}

@Composable
private fun CalendarDetailRow(label: String, value: String) {
    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(Spacing.Xl)) {
        Text(label, modifier = Modifier.size(width = 96.dp, height = 20.dp), color = MutedForeground, style = MaterialTheme.typography.bodySmall)
        Text(value, color = Foreground, style = MaterialTheme.typography.bodyMedium, modifier = Modifier.weight(1f))
    }
}

// Event form lives in EventFormSheet.kt (web EventFormFields).
