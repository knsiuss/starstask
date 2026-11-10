package id.starstask.mobile.ui.screens.classdir

// Create attendance session card (admin). Location is mandatory: the server RPC
// (create_attendance_meeting) rejects a missing location or coordinates.

import android.Manifest
import android.app.DatePickerDialog
import android.app.TimePickerDialog
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.material3.TextField
import androidx.compose.material3.TextFieldDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import id.starstask.mobile.data.CaptureOutcome
import id.starstask.mobile.data.ClassCourse
import id.starstask.mobile.data.captureFailureMessage
import id.starstask.mobile.data.capturePositionDetailed
import id.starstask.mobile.data.createAttendanceMeeting
import id.starstask.mobile.ui.components.GradientPillButton
import id.starstask.mobile.ui.components.WebAlert
import id.starstask.mobile.ui.icons.Lucide
import id.starstask.mobile.ui.theme.mockColors
import kotlinx.coroutines.launch

private val RADIUS_OPTIONS = listOf(50, 100, 200, 500)

@Composable
fun ClassCreateAttendanceMeetingForm(
    classId: String,
    subjects: List<ClassCourse>,
    meetings: List<id.starstask.mobile.data.AttendanceMeeting>,
    onCreated: () -> Unit,
) {
    val palette = mockColors()
    val context = LocalContext.current
    val scope = rememberCoroutineScope()

    var subjectId by remember(subjects) { mutableStateOf(subjects.firstOrNull()?.id ?: "") }
    var meetingNumber by remember { mutableStateOf("1") }
    var meetingDate by remember { mutableStateOf(java.time.LocalDate.now().toString()) }
    var startTime by remember { mutableStateOf("") }
    var endTime by remember { mutableStateOf("") }
    var location by remember { mutableStateOf("") }
    var radiusM by remember { mutableStateOf(200) }
    var latitude by remember { mutableStateOf<Double?>(null) }
    var longitude by remember { mutableStateOf<Double?>(null) }
    var accuracyM by remember { mutableStateOf<Double?>(null) }
    var busy by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    var subjectMenuOpen by remember { mutableStateOf(false) }
    var radiusMenuOpen by remember { mutableStateOf(false) }

    val selectedSubject = subjects.firstOrNull { it.id == subjectId }

    // Suggest the next meeting number for the selected subject.
    androidx.compose.runtime.LaunchedEffect(subjectId, meetings) {
        val last = meetings.filter { it.subjectId == subjectId }.mapNotNull { it.meetingNumber }.maxOrNull() ?: 0
        meetingNumber = (last + 1).toString()
    }

    suspend fun captureLocation() {
        val outcome = capturePositionDetailed(context)
        when (outcome) {
            is CaptureOutcome.Fix -> {
                latitude = outcome.position.latitude
                longitude = outcome.position.longitude
                accuracyM = outcome.position.accuracyM
            }
            is CaptureOutcome.Failed -> {
                error = captureFailureMessage(outcome.reason)
            }
        }
    }

    val locationPermission = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
        if (granted) {
            scope.launch { captureLocation() }
        } else {
            error = id.starstask.mobile.data.captureFailureMessage(id.starstask.mobile.data.CaptureFailureReason.PermissionDenied)
        }
    }

    fun pickTime(initial: String, onPick: (String) -> Unit) {
        val (h, m) = initial.split(":").map { it.toIntOrNull() ?: 9 }.let { if (it.size == 2) it[0] to it[1] else 9 to 0 }
        TimePickerDialog(context, { _, hour, minute ->
            onPick("%02d:%02d".format(hour, minute))
        }, h, m, true).show()
    }

    if (subjects.isEmpty()) {
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(22.dp))
                .padding(16.dp),
        ) {
            Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Text("This class has no active course", color = palette.ink, fontSize = 15.sp, fontWeight = FontWeight.SemiBold)
                Text(
                    "Attendance meetings belong to a course. Add a course first before creating a meeting.",
                    color = palette.muted,
                    fontSize = 13.sp,
                    lineHeight = 19.sp,
                )
            }
        }
        return
    }

    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        if (error != null) WebAlert(message = error!!)

        // Subject / Course
        Box {
            PickerField(
                label = "Subject / Course",
                icon = Lucide.BookOpen,
                value = selectedSubject?.let { s -> s.code?.let { "$it · ${s.name}" } ?: s.name } ?: "Choose a course",
                onClick = { subjectMenuOpen = true },
                palette = palette,
            )
            DropdownMenu(expanded = subjectMenuOpen, onDismissRequest = { subjectMenuOpen = false }) {
                subjects.forEach { subject ->
                    DropdownMenuItem(
                        text = { Text(subject.code?.let { "$it · ${subject.name}" } ?: subject.name) },
                        onClick = { subjectId = subject.id; subjectMenuOpen = false },
                    )
                }
            }
        }

        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            // Meeting number
            Column(
                modifier = Modifier
                    .weight(1f)
                    .clip(RoundedCornerShape(16.dp))
                    .padding(horizontal = 12.dp, vertical = 10.dp),
                verticalArrangement = Arrangement.spacedBy(4.dp),
            ) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    Icon(Lucide.Hash, contentDescription = null, tint = palette.muted, modifier = Modifier.size(14.dp))
                    Text("Meeting number", color = palette.muted, fontSize = 11.sp)
                }
                TextField(
                    value = meetingNumber,
                    onValueChange = { meetingNumber = it.filter { ch -> ch.isDigit() }.take(3) },
                    singleLine = true,
                    textStyle = androidx.compose.ui.text.TextStyle(color = palette.ink, fontSize = 15.sp, fontWeight = FontWeight.SemiBold),
                    shape = RoundedCornerShape(12.dp),
                    colors = formFieldColors(palette),
                    modifier = Modifier.fillMaxWidth(),
                )
            }
            // Meeting date
            Column(
                modifier = Modifier.weight(1f),
                verticalArrangement = Arrangement.spacedBy(4.dp),
            ) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    Icon(Lucide.CalendarDays, contentDescription = null, tint = palette.muted, modifier = Modifier.size(14.dp))
                    Text("Meeting date", color = palette.muted, fontSize = 11.sp)
                }
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(12.dp))
                        .clickable {
                            val parts = meetingDate.split("-").mapNotNull { it.toIntOrNull() }
                            val yy = parts.getOrElse(0) { java.time.LocalDate.now().year }
                            val mm = parts.getOrElse(1) { java.time.LocalDate.now().monthValue }
                            val dd = parts.getOrElse(2) { java.time.LocalDate.now().dayOfMonth }
                            DatePickerDialog(context, { _, y, m, d -> meetingDate = "%04d-%02d-%02d".format(y, m + 1, d) }, yy, mm - 1, dd).show()
                        }
                        .padding(horizontal = 12.dp, vertical = 12.dp),
                ) {
                    Text(meetingDate, color = palette.ink, fontSize = 15.sp, fontWeight = FontWeight.SemiBold)
                }
            }
        }

        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            TimeField(
                label = "Start time",
                value = startTime,
                onPick = { pickTime(if (startTime.isNotBlank()) startTime else "09:00") { v -> startTime = v } },
                palette = palette,
                modifier = Modifier.weight(1f),
            )
            TimeField(
                label = "End time",
                value = endTime,
                onPick = { pickTime(if (endTime.isNotBlank()) endTime else "11:00") { v -> endTime = v } },
                palette = palette,
                modifier = Modifier.weight(1f),
            )
        }

        // Location (required)
        Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                Icon(Lucide.MapPin, contentDescription = null, tint = palette.muted, modifier = Modifier.size(14.dp))
                Text("Location", color = palette.muted, fontSize = 11.sp)
            }
            TextField(
                value = location,
                onValueChange = { location = it },
                singleLine = true,
                placeholder = { Text("Room 3.04, Faculty of Computer Science", color = palette.muted) },
                textStyle = androidx.compose.ui.text.TextStyle(color = palette.ink, fontSize = 15.sp),
                shape = RoundedCornerShape(12.dp),
                colors = formFieldColors(palette),
                modifier = Modifier.fillMaxWidth(),
            )
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(10.dp),
                modifier = Modifier
                    .clip(RoundedCornerShape(12.dp))
                    .clickable {
                        error = null
                        if (androidx.core.content.ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION) == android.content.pm.PackageManager.PERMISSION_GRANTED) {
                            scope.launch { captureLocation() }
                        } else {
                            locationPermission.launch(Manifest.permission.ACCESS_FINE_LOCATION)
                        }
                    }
                    .padding(horizontal = 12.dp, vertical = 10.dp),
            ) {
                Icon(Lucide.LocateFixed, contentDescription = null, tint = palette.accent, modifier = Modifier.size(16.dp))
                Text(
                    if (latitude != null && longitude != null) {
                        accuracyM?.let { "Location set (±%.0f m)".format(it) } ?: "Location set"
                    } else {
                        "Use my location"
                    },
                    color = palette.accent,
                    fontSize = 13.sp,
                    fontWeight = FontWeight.SemiBold,
                )
            }
        }

        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            // Allowed radius
            Box(modifier = Modifier.weight(1f)) {
                PickerField(
                    label = "Allowed radius",
                    icon = Lucide.Crosshair,
                    value = "$radiusM metres",
                    onClick = { radiusMenuOpen = true },
                    palette = palette,
                )
                DropdownMenu(expanded = radiusMenuOpen, onDismissRequest = { radiusMenuOpen = false }) {
                    RADIUS_OPTIONS.forEach { option ->
                        DropdownMenuItem(text = { Text("$option metres") }, onClick = { radiusM = option; radiusMenuOpen = false })
                    }
                }
            }
        }

        GradientPillButton(
            label = if (busy) "Creating…" else "Create meeting",
            enabled = !busy && subjectId.isNotBlank() && meetingNumber.isNotBlank() &&
                startTime.isNotBlank() && endTime.isNotBlank() &&
                location.trim().length >= 3 && latitude != null && longitude != null,
            onClick = {
                scope.launch {
                    busy = true
                    error = null
                    try {
                        val zone = java.time.ZoneId.of("Asia/Jakarta")
                        val startsAt = java.time.LocalDateTime.parse("${meetingDate}T$startTime").atZone(zone).toInstant().toString()
                        val endsAt = java.time.LocalDateTime.parse("${meetingDate}T$endTime").atZone(zone).toInstant().toString()
                        createAttendanceMeeting(
                            classId = classId,
                            subjectId = subjectId,
                            meetingNumber = meetingNumber.toIntOrNull() ?: 1,
                            meetingDate = meetingDate,
                            startsAtIso = startsAt,
                            endsAtIso = endsAt,
                            location = location.trim(),
                            lateAfterMinutes = 10,
                            radiusM = radiusM,
                            latitude = latitude!!,
                            longitude = longitude!!,
                            title = null,
                        )
                        onCreated()
                    } catch (_: Exception) {
                        error = "Could not create the meeting. Check the details and try again."
                    }
                    busy = false
                }
            },
            icon = Lucide.CirclePlus,
        )
    }
}

@Composable
private fun formFieldColors(palette: id.starstask.mobile.ui.theme.MockPalette) = TextFieldDefaults.colors(
    focusedContainerColor = palette.chip,
    unfocusedContainerColor = palette.chip,
    focusedIndicatorColor = palette.accent,
    unfocusedIndicatorColor = palette.cardBorder,
    cursorColor = palette.accent,
    focusedTextColor = palette.ink,
    unfocusedTextColor = palette.ink,
)

@Composable
private fun PickerField(
    label: String,
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    value: String,
    onClick: () -> Unit,
    palette: id.starstask.mobile.ui.theme.MockPalette,
) {
    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            Icon(icon, contentDescription = null, tint = palette.muted, modifier = Modifier.size(14.dp))
            Text(label, color = palette.muted, fontSize = 11.sp)
        }
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(12.dp))
                .clickable(onClick = onClick)
                .heightIn(min = 48.dp)
                .padding(horizontal = 12.dp, vertical = 12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(value, color = palette.ink, fontSize = 15.sp, fontWeight = FontWeight.SemiBold, modifier = Modifier.weight(1f), maxLines = 1)
            Icon(Lucide.ChevronDown, contentDescription = null, tint = palette.muted, modifier = Modifier.size(16.dp))
        }
    }
}

@Composable
private fun TimeField(
    label: String,
    value: String,
    onPick: () -> Unit,
    palette: id.starstask.mobile.ui.theme.MockPalette,
    modifier: Modifier = Modifier,
) {
    Column(modifier = modifier, verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            Icon(Lucide.Clock, contentDescription = null, tint = palette.muted, modifier = Modifier.size(14.dp))
            Text(label, color = palette.muted, fontSize = 11.sp)
        }
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(12.dp))
                .clickable(onClick = onPick)
                .heightIn(min = 48.dp)
                .padding(horizontal = 12.dp, vertical = 12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(
                if (value.isBlank()) "--:--" else value,
                color = if (value.isBlank()) palette.muted else palette.ink,
                fontSize = 15.sp,
                fontWeight = FontWeight.SemiBold,
            )
        }
    }
}
