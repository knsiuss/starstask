package id.starstask.mobile.ui.screens

import id.starstask.mobile.ui.icons.Lucide

import id.starstask.mobile.ui.theme.Spacing
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import id.starstask.mobile.data.CALENDAR_OFFICIAL_WINDOW_MS
import id.starstask.mobile.data.CALENDAR_PERSONAL_WINDOW_MS
import id.starstask.mobile.data.CalendarTimelineItem
import id.starstask.mobile.data.OFFICIAL_EVENT_TYPES
import id.starstask.mobile.data.WorkspaceClassOption
import id.starstask.mobile.data.formatCalendarTime
import id.starstask.mobile.data.formatDayLabel
import id.starstask.mobile.data.deviceLocalDateTime
import id.starstask.mobile.data.deviceLocalToInstantIso
import id.starstask.mobile.data.validateCalendarEvent
import id.starstask.mobile.data.userFacingMessage
import id.starstask.mobile.ui.components.WebAlert
import id.starstask.mobile.ui.components.WebButton
import id.starstask.mobile.ui.components.WebButtonVariant
import id.starstask.mobile.ui.components.WebInput
import id.starstask.mobile.ui.theme.Accent
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
fun EventFormSheet(
    userId: String,
    scope: String,
    existing: CalendarTimelineItem?,
    defaultDateKey: String,
    classes: List<WorkspaceClassOption>,
    onDismiss: () -> Unit,
    onSaved: () -> Unit,
) {
    val scopeJob = rememberCoroutineScope()
    val adminClasses = classes.filter { it.isAdmin }
    val editing = existing != null
    val initialStart = existing?.startsAtIso?.takeIf { it.isNotEmpty() }?.let { deviceLocalDateTime(it) }
        ?: LocalDate.parse(defaultDateKey).atStartOfDay()
    val initialEnd = existing?.endsAtIso?.let { deviceLocalDateTime(it) }
        ?: initialStart.plusHours(1)
    var title by remember(existing) { mutableStateOf(existing?.title ?: "") }
    var description by remember(existing) { mutableStateOf(existing?.description ?: "") }
    var location by remember(existing) { mutableStateOf(existing?.location ?: "") }
    var startDate by remember(existing) { mutableStateOf(initialStart.toLocalDate()) }
    var startTime by remember(existing) { mutableStateOf(initialStart.toLocalTime().let { if (it == LocalTime.MIDNIGHT) LocalTime.of(9, 0) else it }) }
    var endDate by remember(existing) { mutableStateOf(initialEnd.toLocalDate()) }
    var endTime by remember(existing) { mutableStateOf(initialEnd.toLocalTime().let { if (it == LocalTime.MIDNIGHT) LocalTime.of(10, 0) else it }) }
    var classId by remember(existing) { mutableStateOf(existing?.classId ?: adminClasses.firstOrNull()?.id ?: "") }
    var subjectId by remember(existing) { mutableStateOf(existing?.subjectId) }
    var eventType by remember(existing) { mutableStateOf(existing?.kind?.takeIf { it in OFFICIAL_EVENT_TYPES } ?: "class_schedule") }
    var busy by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    var confirmRemove by remember { mutableStateOf(false) }
    var showStartDate by remember { mutableStateOf(false) }
    var showStartTime by remember { mutableStateOf(false) }
    var showEndDate by remember { mutableStateOf(false) }
    var showEndTime by remember { mutableStateOf(false) }

    val maxMs = if (scope == "personal") CALENDAR_PERSONAL_WINDOW_MS else CALENDAR_OFFICIAL_WINDOW_MS
    val descMax = if (scope == "personal") id.starstask.mobile.data.CALENDAR_DESCRIPTION_MAX else id.starstask.mobile.data.CALENDAR_OFFICIAL_DESCRIPTION_MAX
    val availableSubjects = classes.firstOrNull { it.id == classId }?.subjects ?: emptyList()
    val status = existing?.status

    fun fieldErrors() = validateCalendarEvent(
        title = title,
        startsAtIso = deviceLocalToInstantIso(startDate.toString(), startTime),
        endsAtIso = deviceLocalToInstantIso(endDate.toString(), endTime),
        description = description,
        location = location,
        maxDurationMs = maxMs,
        descriptionMax = descMax,
    )

    ModalBottomSheet(onDismissRequest = onDismiss) {
        Column(
            modifier = Modifier.fillMaxWidth().padding(Spacing.Block).verticalScroll(rememberScrollState()),
            verticalArrangement = Arrangement.spacedBy(Spacing.Xl),
        ) {
            Text(
                if (editing) "Edit event" else "New event",
                style = MaterialTheme.typography.titleLarge,
                color = Foreground,
                fontWeight = FontWeight.SemiBold,
            )
            Text(
                if (scope == "personal") "Personal events are visible only to you."
                else "Official events are visible to everyone in the class group.",
                color = MutedForeground,
                style = MaterialTheme.typography.bodySmall,
            )
            WebInput(
                value = title,
                onValueChange = { title = it },
                label = "Title",
                isError = fieldErrors().title != null,
                supportingText = fieldErrors().title,
            )
            if (scope == "official") {
                EventClassPicker(adminClasses = adminClasses, classId = classId, onClassChange = { classId = it; subjectId = null }, editing = editing)
                EventTypePicker(eventType = eventType, onTypeChange = { eventType = it })
                EventSubjectPicker(availableSubjects = availableSubjects, subjectId = subjectId, onSubjectChange = { subjectId = it })
            }
            Row(horizontalArrangement = Arrangement.spacedBy(Spacing.Md)) {
                PickerButton(
                    label = "Starts",
                    value = formatDayLabel(startDate.toString()),
                    modifier = Modifier.weight(1f),
                ) { showStartDate = true }
                PickerButton(
                    label = "Time",
                    value = "%02d:%02d".format(startTime.hour, startTime.minute),
                    modifier = Modifier.weight(1f),
                ) { showStartTime = true }
            }
            Row(horizontalArrangement = Arrangement.spacedBy(Spacing.Md)) {
                PickerButton(
                    label = "Ends",
                    value = formatDayLabel(endDate.toString()),
                    modifier = Modifier.weight(1f),
                ) { showEndDate = true }
                PickerButton(
                    label = "Time",
                    value = "%02d:%02d".format(endTime.hour, endTime.minute),
                    modifier = Modifier.weight(1f),
                ) { showEndTime = true }
            }
            fieldErrors().endsAt?.let { Text(it, color = Danger, style = MaterialTheme.typography.bodySmall) }
            WebInput(value = location, onValueChange = { location = it }, label = "Location (optional)")
            WebInput(
                value = description,
                onValueChange = { description = it },
                label = "Description (optional)",
                singleLine = false,
                minLines = 2,
            )
            fieldErrors().description?.let { Text(it, color = Danger, style = MaterialTheme.typography.bodySmall) }
            Text("Times are shown and saved in your device timezone.", color = MutedForeground, style = MaterialTheme.typography.bodySmall)
            if (error != null) WebAlert(message = error!!)
            WebButton(
                label = if (busy) "Saving…" else if (editing) "Save changes" else "Create event",
                onClick = {
                    if (fieldErrors().hasErrors()) return@WebButton
                    if (scope == "official" && classId.isEmpty()) {
                        error = "Choose the class this event belongs to."
                        return@WebButton
                    }
                    busy = true
                    error = null
                    scopeJob.launch {
                        runCatching {
                            val input = id.starstask.mobile.data.CalendarEventInput(
                                title = title,
                                description = description,
                                startsAtIso = deviceLocalToInstantIso(startDate.toString(), startTime),
                                endsAtIso = deviceLocalToInstantIso(endDate.toString(), endTime),
                                location = location,
                                eventType = if (scope == "official") eventType else null,
                                subjectId = if (scope == "official") subjectId else null,
                            )
                            if (scope == "personal") {
                                if (existing != null) {
                                    id.starstask.mobile.data.updatePersonalEvent(userId, existing.sourceId, input)
                                } else {
                                    id.starstask.mobile.data.createPersonalEvent(userId, input)
                                }
                            } else {
                                if (existing != null) {
                                    id.starstask.mobile.data.updateOfficialEvent(existing.classId ?: classId, existing.sourceId, input)
                                } else {
                                    id.starstask.mobile.data.createOfficialEvent(classId, userId, input)
                                }
                            }
                        }.onSuccess { busy = false; onSaved() }
                            .onFailure { error = userFacingMessage(it, "Could not save the event."); busy = false }
                    }
                },
                modifier = Modifier.fillMaxWidth(),
                enabled = !busy,
            )
            if (existing != null) {
                Row(horizontalArrangement = Arrangement.spacedBy(Spacing.Md)) {
                    if (scope == "official") {
                        WebButton(
                            label = if (status == "cancelled") "Reopen" else "Cancel event",
                            variant = WebButtonVariant.SECONDARY,
                            onClick = {
                                busy = true
                                error = null
                                scopeJob.launch {
                                    runCatching {
                                        id.starstask.mobile.data.setOfficialEventStatus(
                                            existing.classId ?: "",
                                            existing.sourceId,
                                            if (status == "cancelled") "published" else "cancelled",
                                        )
                                    }.onSuccess { busy = false; onSaved() }
                                        .onFailure { error = "Could not change the event status."; busy = false }
                                }
                            },
                            modifier = Modifier.weight(1f),
                            enabled = !busy,
                        )
                    }
                    if (!confirmRemove) {
                        WebButton(
                            label = if (scope == "personal") "Delete" else "Archive",
                            onClick = { confirmRemove = true },
                            modifier = Modifier.weight(1f),
                            enabled = !busy,
                            variant = WebButtonVariant.DANGER,
                        )
                    } else {
                        WebButton(
                            label = "Confirm remove?",
                            variant = WebButtonVariant.DANGER,
                            onClick = {
                                busy = true
                                error = null
                                scopeJob.launch {
                                    runCatching {
                                        if (scope == "personal") {
                                            id.starstask.mobile.data.deletePersonalEvent(userId, existing.sourceId)
                                        } else {
                                            id.starstask.mobile.data.archiveOfficialEvent(existing.classId ?: "", existing.sourceId)
                                        }
                                    }.onSuccess { busy = false; onSaved() }
                                        .onFailure { error = "Could not remove the event."; busy = false }
                                }
                            },
                            modifier = Modifier.weight(1f),
                            enabled = !busy,
                        )
                    }
                }
                if (confirmRemove && scope == "official") {
                    Text(
                        "Archiving hides this event from the calendar but keeps it on record.",
                        color = MutedForeground,
                        style = MaterialTheme.typography.bodySmall,
                    )
                }
            }
            WebButton(label = "Cancel", onClick = onDismiss, variant = WebButtonVariant.GHOST, enabled = !busy)
        }
    }

    if (showStartDate) {
        DateDialog(initial = startDate, onPick = { startDate = it; showStartDate = false }, onDismiss = { showStartDate = false })
    }
    if (showEndDate) {
        DateDialog(initial = endDate, onPick = { endDate = it; showEndDate = false }, onDismiss = { showEndDate = false })
    }
    if (showStartTime) {
        TimeDialog(initial = startTime, onPick = { startTime = it; showStartTime = false }, onDismiss = { showStartTime = false })
    }
    if (showEndTime) {
        TimeDialog(initial = endTime, onPick = { endTime = it; showEndTime = false }, onDismiss = { showEndTime = false })
    }
}

