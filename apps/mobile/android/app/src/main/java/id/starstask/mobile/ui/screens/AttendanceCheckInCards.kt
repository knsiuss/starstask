package id.starstask.mobile.ui.screens

import id.starstask.mobile.ui.theme.Spacing

import id.starstask.mobile.ui.icons.Lucide
import android.Manifest // check-in location permission
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
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
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
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
import androidx.compose.ui.unit.dp
import id.starstask.mobile.data.ActiveMeeting
import id.starstask.mobile.data.AttendanceIdentity
import id.starstask.mobile.data.CaptureOutcome
import id.starstask.mobile.data.captureFailureMessage
import id.starstask.mobile.data.capturePositionDetailed
import id.starstask.mobile.data.checkInLegacySession
import id.starstask.mobile.data.checkInToSession
import id.starstask.mobile.ui.components.StatusBadge
import id.starstask.mobile.data.formatDateShort
import id.starstask.mobile.data.formatTime
import id.starstask.mobile.data.hasLocationPermission
import id.starstask.mobile.ui.components.WebAlert
import id.starstask.mobile.ui.theme.Accent
import id.starstask.mobile.ui.theme.AccentSoft
import id.starstask.mobile.ui.theme.Border
import id.starstask.mobile.ui.theme.Danger
import id.starstask.mobile.ui.theme.Foreground
import id.starstask.mobile.ui.theme.MutedForeground
import id.starstask.mobile.ui.theme.Success
import id.starstask.mobile.ui.theme.Surface
import kotlinx.coroutines.launch
@Composable
fun ActiveMeetingCard(
    meeting: ActiveMeeting,
    identity: AttendanceIdentity?,
    userId: String,
    onChanged: () -> Unit,
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var formOpen by remember(meeting.sessionId) { mutableStateOf(false) }
    var fullName by remember(meeting.sessionId) { mutableStateOf(identity?.fullName ?: "") }
    var nim by remember(meeting.sessionId) { mutableStateOf(identity?.nim ?: "") }
    var busy by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    var success by remember { mutableStateOf<String?>(null) }
    var fieldError by remember { mutableStateOf<String?>(null) }
    var localStatus by remember(meeting.sessionId) { mutableStateOf(meeting.checkInStatus) }
    var localCheckedInAt by remember(meeting.sessionId) { mutableStateOf(meeting.checkedInAt) }
    var permissionPending by remember { mutableStateOf(false) }
    fun isOpenNow(): Boolean = when (meeting.phase) {
        "open" -> true
        "before" -> false
        "closed" -> false
        else -> meeting.phase == "open"
    }
    val identityReady = !identity?.nim.isNullOrBlank() && !identity?.fullName.isNullOrBlank()
    val checkedIn = localStatus != null
    val openNow = isOpenNow()

    suspend fun runCheckIn() {
        busy = true
        error = null
        success = null
        try {
            val outcome = capturePositionDetailed(context)
            val position = when (outcome) {
                is CaptureOutcome.Fix -> outcome.position
                is CaptureOutcome.Failed -> {
                    error = captureFailureMessage(outcome.reason)
                    return
                }
            }
            if (System.currentTimeMillis() - position.capturedAtMs > 60_000) {
                error = STALE_LOCATION_MSG
                return
            }
            if (position.accuracyM > SESSION_CHECKIN_ACCURACY_MAX_M) {
                error = accuracyMsg(position.accuracyM)
                return
            }
            val result = if (meeting.isMeeting) {
                checkInToSession(
                    userId = userId,
                    sessionId = meeting.sessionId,
                    latitude = position.latitude,
                    longitude = position.longitude,
                    accuracyM = position.accuracyM,
                )
            } else {
                checkInLegacySession(
                    sessionId = meeting.sessionId,
                    latitude = position.latitude,
                    longitude = position.longitude,
                    accuracyM = position.accuracyM,
                    capturedAtIso = java.time.Instant.ofEpochMilli(position.capturedAtMs).toString(),
                )
            }
            if (result.ok) {
                localStatus = result.status ?: "present"
                localCheckedInAt = java.time.Instant.now().toString()
                success = "Checked in. You are marked present."
                formOpen = false
                onChanged()
            } else {
                error = result.message ?: "The server did not confirm your check-in. Try again before leaving the meeting point."
            }
        } catch (_: Exception) {
            error = "Could not record your check-in. Please check your connection and try again."
        } finally {
            busy = false
            permissionPending = false
        }
    }

    val permissionLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestPermission(),
    ) { granted ->
        if (granted) {
            scope.launch { runCheckIn() }
        } else {
            error = "Location permission needed to check in."
        }
    }

    fun requestCheckIn() {
        error = null
        fieldError = null
        if (!hasLocationPermission(context)) {
            permissionLauncher.launch(Manifest.permission.ACCESS_FINE_LOCATION)
            return
        }
        scope.launch { runCheckIn() }
    }

    Card(
        colors = CardDefaults.cardColors(containerColor = Surface),
        shape = RoundedCornerShape(12.dp),
        modifier = Modifier
            .fillMaxWidth()
            .border(1.dp, Border, RoundedCornerShape(12.dp)),
    ) {
        Column(modifier = Modifier.padding(Spacing.Section), verticalArrangement = Arrangement.spacedBy(Spacing.Lg)) {
            Row(horizontalArrangement = Arrangement.spacedBy(Spacing.Xl)) {
                Box(
                    modifier = Modifier
                        .size(44.dp)
                        .clip(RoundedCornerShape(12.dp))
                        .background(AccentSoft),
                    contentAlignment = Alignment.Center,
                ) {
                    Icon(Lucide.CalendarDays, contentDescription = null, tint = Accent, modifier = Modifier.size(22.dp))
                }
                Column(modifier = Modifier.weight(1f)) {
                    Row(horizontalArrangement = Arrangement.spacedBy(Spacing.Md), verticalAlignment = Alignment.CenterVertically) {
                        Text(
                            meeting.subjectName,
                            color = Foreground,
                            style = MaterialTheme.typography.titleMedium,
                            modifier = Modifier.weight(1f, fill = false),
                        )
                        PhaseBadge(open = openNow, phase = meeting.phase)
                    }
                    val meetingLine = if (meeting.isMeeting) {
                        "Pertemuan ${meeting.meetingNumber} · ${meeting.className}"
                    } else {
                        meeting.className
                    }
                    Text(meetingLine, color = MutedForeground, style = MaterialTheme.typography.bodySmall)
                    MeetingLine(icon = Lucide.CalendarDays, text = formatDateShort(meeting.startsAt))
                    MeetingLine(
                        icon = Lucide.CalendarClock,
                        text = "${formatTime(meeting.startsAt)}–${formatTime(meeting.endsAt)} ${id.starstask.mobile.data.timezoneLabel(meeting.timeZone)}",
                    )
                    if (meeting.closesAt != null) {
                        MeetingLine(icon = Lucide.CalendarClock, text = "Check-in closes ${formatTime(meeting.closesAt)} ${id.starstask.mobile.data.timezoneLabel(meeting.timeZone)}")
                    }
                    MeetingLine(
                        icon = Lucide.MapPin,
                        text = (meeting.location?.let { "$it · " } ?: "") + "Within ${meeting.radiusM} m",
                    )
                }
                if (busy) CircularProgressIndicator(modifier = Modifier.size(20.dp))
            }

            if (checkedIn) {
                StatusBadge(status = localStatus!!)
                Text(
                    "Checked in at ${formatTime(localCheckedInAt ?: meeting.startsAt)} ${id.starstask.mobile.data.timezoneLabel(meeting.timeZone)}",
                    color = MutedForeground,
                    style = MaterialTheme.typography.bodySmall,
                )
                if (openNow) {
                    OutlinedButton(onClick = { formOpen = !formOpen }, enabled = !busy) {
                        Text(if (formOpen) "Hide check-in" else "Check in again")
                    }
                }
            } else if (openNow && identityReady) {
                Button(onClick = { formOpen = !formOpen }, enabled = !busy) {
                    Text(if (formOpen) "Hide check-in" else "Check In")
                }
            } else if (!identityReady) {
                Text(
                    "Add your full name and NIM in your profile before checking in.",
                    color = MutedForeground,
                    style = MaterialTheme.typography.bodySmall,
                )
            }

            if (formOpen && openNow) {
                HorizontalDivider(color = Border)
                Text("Confirm your identity", color = Foreground, style = MaterialTheme.typography.titleSmall)
                Text(
                    "The server checks these values against your verified profile, plus the meeting window, membership, GPS accuracy, and radius.",
                    color = MutedForeground,
                    style = MaterialTheme.typography.bodySmall,
                )
                Row(horizontalArrangement = Arrangement.spacedBy(Spacing.Lg)) {
                    OutlinedTextField(
                        value = fullName,
                        onValueChange = { fullName = it },
                        label = { Text("Full name") },
                        modifier = Modifier.weight(1f),
                        singleLine = true,
                        enabled = !busy,
                        isError = fieldError != null,
                    )
                    OutlinedTextField(
                        value = nim,
                        onValueChange = { nim = it },
                        label = { Text("NIM") },
                        modifier = Modifier.weight(1f),
                        singleLine = true,
                        enabled = !busy,
                        isError = fieldError != null,
                    )
                }
                if (fieldError != null) {
                    Text(fieldError!!, color = Danger, style = MaterialTheme.typography.bodySmall)
                }
                Row(horizontalArrangement = Arrangement.spacedBy(Spacing.Lg)) {
                    Button(
                        onClick = {
                            fieldError = null
                            if (fullName.trim().length < 2) {
                                fieldError = "Enter your full name."
                                return@Button
                            }
                            if (!NIM_PATTERN.matches(nim.trim())) {
                                fieldError = "Enter a valid NIM."
                                return@Button
                            }
                            requestCheckIn()
                        },
                        enabled = !busy,
                    ) {
                        Text(if (busy) "Checking location…" else "Confirm and check in")
                    }
                    OutlinedButton(onClick = { formOpen = false }, enabled = !busy) { Text("Cancel") }
                }
            }

            if (error != null) {
                WebAlert(message = error!!)
            }
            if (success != null) {
                Text(success!!, color = Success, style = MaterialTheme.typography.bodyMedium)
            }
        }
    }
}
