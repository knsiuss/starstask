package id.starstask.mobile.ui.screens.classdir

// Manage sessions: list of attendance meetings in this class, grouped by phase,
// with Open/Close/Finalize/Reopen actions. List rows show live counts from the
// server; actions call the same RPCs the web uses.

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.produceState
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import id.starstask.mobile.data.AttendanceMeeting
import id.starstask.mobile.data.closeAttendanceMeeting
import id.starstask.mobile.data.listAttendanceMeetings
import id.starstask.mobile.data.openAttendanceMeeting
import id.starstask.mobile.data.reopenAttendanceMeeting
import id.starstask.mobile.ui.components.WebAlert
import id.starstask.mobile.ui.icons.Lucide
import id.starstask.mobile.ui.theme.mockColors
import kotlinx.coroutines.launch

@Composable
fun ClassManageSessionsGlossy(
    clazz: id.starstask.mobile.data.DirectoryClass,
    onBack: () -> Unit,
    onOpenMeeting: (String) -> Unit,
) {
    val palette = mockColors()
    var reloadTick by remember { mutableIntStateOf(0) }
    var busyId by remember { mutableStateOf<String?>(null) }
    var error by remember { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()

    val meetings by produceState(initialValue = emptyList<AttendanceMeeting>(), key1 = clazz.id, key2 = reloadTick) {
        value = runCatching { listAttendanceMeetings(clazz.id) }.getOrDefault(emptyList())
    }

    GlossyBackSurface(
        title = "Manage sessions",
        subtitle = "Attendance meetings of this class.",
        onBack = onBack,
    ) {
        Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
            if (error != null) WebAlert(message = error!!)
            if (meetings.isEmpty()) {
                Text("No attendance meetings yet. Create one from the Attendance tab.", color = palette.muted, fontSize = 13.sp, modifier = Modifier.padding(top = 8.dp))
            }
            meetings.forEach { meeting ->
                MeetingManageRow(
                    meeting = meeting,
                    busy = busyId == meeting.sessionId,
                    palette = palette,
                    onOpen = {
                        scope.launch {
                            busyId = meeting.sessionId
                            error = null
                            runCatching { openAttendanceMeeting(meeting.sessionId) }
                                .onFailure { error = "Could not open the meeting." }
                            busyId = null
                            reloadTick++
                        }
                    },
                    onClose = { finalize ->
                        scope.launch {
                            busyId = meeting.sessionId
                            error = null
                            runCatching { closeAttendanceMeeting(meeting.sessionId, finalize) }
                                .onFailure { error = if (finalize) "Could not finalize the meeting." else "Could not close the meeting." }
                            busyId = null
                            reloadTick++
                        }
                    },
                    onReopen = {
                        scope.launch {
                            busyId = meeting.sessionId
                            error = null
                            runCatching { reopenAttendanceMeeting(meeting.sessionId) }
                                .onFailure { error = "Could not reopen the meeting." }
                            busyId = null
                            reloadTick++
                        }
                    },
                    onOpenMeeting = { onOpenMeeting(meeting.sessionId) },
                )
            }
        }
    }
}

@Composable
private fun MeetingManageRow(
    meeting: AttendanceMeeting,
    busy: Boolean,
    palette: id.starstask.mobile.ui.theme.MockPalette,
    onOpen: () -> Unit,
    onClose: (finalize: Boolean) -> Unit,
    onReopen: () -> Unit,
    onOpenMeeting: () -> Unit,
) {
    var finalizeConfirmOpen by remember { mutableStateOf(false) }

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(18.dp))
            .background(palette.card)
            .border(1.dp, palette.cardBorder, RoundedCornerShape(18.dp))
            .padding(14.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    "${meeting.subjectName} · Pertemuan ${meeting.meetingNumber ?: "—"}",
                    color = palette.ink,
                    fontSize = 14.sp,
                    fontWeight = FontWeight.SemiBold,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
                Text(formatMeetingDateTime(meeting.startsAt), color = palette.muted, fontSize = 12.sp)
                Text(
                    "${meeting.present} present · ${meeting.late} late · ${meeting.excused} excused · ${meeting.sick} sick · ${meeting.absent} absent · ${meeting.notRecorded} NR · ${meeting.failed} failed",
                    color = palette.muted,
                    fontSize = 11.sp,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
            }
            PhasePill(meeting.phase, palette)
        }

        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            if (meeting.phase == "scheduled") {
                ActionChip(label = if (busy) "Opening…" else "Open", enabled = !busy, onClick = onOpen, palette = palette, accent = true)
            } else if (meeting.phase == "open") {
                ActionChip(label = if (busy) "Closing…" else "Close", enabled = !busy, onClick = { onClose(false) }, palette = palette, accent = false)
                ActionChip(label = if (busy) "Finalizing…" else "Finalize", enabled = !busy, onClick = { finalizeConfirmOpen = true }, palette = palette, accent = true)
            } else if (meeting.phase == "closed" || meeting.phase == "finalized") {
                ActionChip(label = if (busy) "Reopening…" else "Reopen", enabled = !busy, onClick = onReopen, palette = palette, accent = false)
            }
            ActionChip(label = "Roster", enabled = !busy, onClick = onOpenMeeting, palette = palette, accent = false)
        }
    }

    if (finalizeConfirmOpen) {
        AlertDialog(
            onDismissRequest = { finalizeConfirmOpen = false },
            title = { Text("Finalize this meeting?") },
            text = { Text("Eligible members without a record are written as absent (system-generated). Reopening removes only those automatic absences; manual corrections stay.") },
            confirmButton = {
                TextButton(onClick = { finalizeConfirmOpen = false; onClose(true) }) {
                    Text("Finalize")
                }
            },
            dismissButton = {
                TextButton(onClick = { finalizeConfirmOpen = false }) {
                    Text("Cancel")
                }
            },
        )
    }
}

@Composable
private fun PhasePill(phase: String, palette: id.starstask.mobile.ui.theme.MockPalette) {
    val (label, bg, fg) = when (phase) {
        "open" -> Triple("Open", palette.goodBg, palette.goodFg)
        "scheduled" -> Triple("Scheduled", palette.chip, palette.muted)
        "closed" -> Triple("Closed", palette.fairBg, palette.fairFg)
        else -> Triple("Finalized", palette.accentSofter, palette.accent)
    }
    Box(
        modifier = Modifier
            .clip(RoundedCornerShape(999.dp))
            .background(bg)
            .padding(horizontal = 10.dp, vertical = 3.dp),
    ) {
        Text(label, color = fg, fontSize = 11.sp, fontWeight = FontWeight.SemiBold)
    }
}

@Composable
private fun ActionChip(
    label: String,
    enabled: Boolean,
    onClick: () -> Unit,
    palette: id.starstask.mobile.ui.theme.MockPalette,
    accent: Boolean,
) {
    Box(
        modifier = Modifier
            .clip(RoundedCornerShape(999.dp))
            .background(if (accent) palette.accent else palette.chip)
            .clickable(enabled = enabled, onClick = onClick)
            .heightIn(min = 36.dp)
            .padding(horizontal = 14.dp, vertical = 8.dp),
    ) {
        Text(
            label,
            color = if (accent) androidx.compose.ui.graphics.Color.White else palette.ink,
            fontSize = 13.sp,
            fontWeight = FontWeight.SemiBold,
        )
    }
}
