package id.starstask.mobile.ui.screens.classdir

// Per-meeting detail push: live phase, admin open/close/finalize/reopen
// actions, the master roster (identity-verified statuses), recent verification
// failures, and manual corrections with the mandatory physical-verification
// attestation for marking a member present.

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
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.Icon
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
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
import id.starstask.mobile.data.MeetingFailure
import id.starstask.mobile.data.MeetingRosterEntry
import id.starstask.mobile.data.closeAttendanceMeeting
import id.starstask.mobile.data.loadMeetingFailures
import id.starstask.mobile.data.loadMeetingRoster
import id.starstask.mobile.data.listAttendanceMeetings
import id.starstask.mobile.data.openAttendanceMeeting
import id.starstask.mobile.data.recordAttendanceCorrection
import id.starstask.mobile.data.reopenAttendanceMeeting
import id.starstask.mobile.ui.components.WebAlert
import id.starstask.mobile.ui.icons.Lucide
import id.starstask.mobile.ui.theme.mockColors
import kotlinx.coroutines.launch

@Composable
fun ClassMeetingDetailGlossy(
    classId: String,
    sessionId: String,
    isAdmin: Boolean,
    onBack: () -> Unit,
) {
    val palette = mockColors()
    var reloadTick by remember { mutableIntStateOf(0) }
    var actionBusy by remember { mutableStateOf(false) }
    var actionError by remember { mutableStateOf<String?>(null) }
    var finalizeConfirmOpen by remember { mutableStateOf(false) }
    var correctionFor by remember { mutableStateOf<MeetingRosterEntry?>(null) }
    val scope = rememberCoroutineScope()

    val meeting by produceState(initialValue = null as AttendanceMeeting?, key1 = classId, key2 = sessionId, key3 = reloadTick) {
        value = runCatching { listAttendanceMeetings(classId).firstOrNull { it.sessionId == sessionId } }.getOrNull()
    }
    val roster by produceState(initialValue = emptyList<MeetingRosterEntry>(), key1 = sessionId, key2 = reloadTick) {
        value = runCatching { loadMeetingRoster(sessionId) }.getOrDefault(emptyList())
    }
    val failures by produceState(initialValue = emptyList<MeetingFailure>(), key1 = sessionId, key2 = reloadTick) {
        value = runCatching { loadMeetingFailures(sessionId) }.getOrDefault(emptyList())
    }

    val current = meeting

    GlossyBackSurface(
        title = current?.let { "${it.subjectName} · Pertemuan ${it.meetingNumber ?: "—"}" } ?: "Attendance meeting",
        subtitle = current?.let { formatMeetingDateTimeFull(it.startsAt) },
        onBack = onBack,
    ) {
        when {
            current == null -> GlossyLoadingRow()
            else -> {
                Column(verticalArrangement = Arrangement.spacedBy(18.dp)) {
                    if (actionError != null) WebAlert(message = actionError!!)

                    Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        StatTile(label = "Expected", value = current.expected.toString(), palette = palette, modifier = Modifier.weight(1f))
                        StatTile(label = "Present", value = current.present.toString(), palette = palette, tint = StatTint.Good, modifier = Modifier.weight(1f))
                        StatTile(label = "Late", value = current.late.toString(), palette = palette, tint = StatTint.Fair, modifier = Modifier.weight(1f))
                        StatTile(label = "Absent", value = current.absent.toString(), palette = palette, tint = StatTint.Risk, modifier = Modifier.weight(1f))
                        StatTile(label = "NR", value = current.notRecorded.toString(), palette = palette, modifier = Modifier.weight(1f))
                    }

                    if (isAdmin) {
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            when (current.phase) {
                                "scheduled" -> ActionChip("Open attendance", !actionBusy, palette, accent = true) { runAction(scope, { openAttendanceMeeting(sessionId) }, { actionBusy = it }, { actionError = it }) { reloadTick++ } }
                                "open" -> {
                                    ActionChip("Close", !actionBusy, palette, accent = false) { runAction(scope, { closeAttendanceMeeting(sessionId, false) }, { actionBusy = it }, { actionError = it }) { reloadTick++ } }
                                    ActionChip("Finalize", !actionBusy, palette, accent = true) { finalizeConfirmOpen = true }
                                }
                                "closed", "finalized" -> ActionChip("Reopen", !actionBusy, palette, accent = false) { runAction(scope, { reopenAttendanceMeeting(sessionId) }, { actionBusy = it }, { actionError = it }) { reloadTick++ } }
                            }
                        }
                        if (current.failed > 0) {
                            Text(
                                "${current.failed} failed verification attempt${if (current.failed == 1) "" else "s"} this meeting.",
                                color = palette.muted,
                                fontSize = 12.sp,
                            )
                        }
                    }

                    SectionTitle("Roster", palette)
                    if (roster.isEmpty()) {
                        Text("No roster loaded.", color = palette.muted, fontSize = 13.sp)
                    } else {
                        roster.forEach { entry ->
                            RosterRow(
                                entry = entry,
                                canCorrect = isAdmin && entry.eligible,
                                palette = palette,
                                onCorrect = { correctionFor = entry },
                            )
                        }
                    }

                    if (failures.isNotEmpty()) {
                        SectionTitle("Failed attempts", palette)
                        failures.take(10).forEach { failure ->
                            DetailCard(palette) {
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Column(modifier = Modifier.weight(1f)) {
                                        Text(failure.displayName, color = palette.ink, fontSize = 14.sp, fontWeight = FontWeight.Medium, maxLines = 1, overflow = TextOverflow.Ellipsis)
                                        Text(failure.outcome.replace('_', ' '), color = palette.muted, fontSize = 12.sp)
                                    }
                                    Text(formatMeetingDateTime(failure.createdAt), color = palette.muted, fontSize = 11.sp)
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    if (finalizeConfirmOpen) {
        AlertDialog(
            onDismissRequest = { finalizeConfirmOpen = false },
            title = { Text("Finalize this meeting?") },
            text = { Text("Eligible members without a record are written as absent (system-generated). Reopening removes only those automatic absences.") },
            confirmButton = {
                TextButton(onClick = {
                    finalizeConfirmOpen = false
                    runAction(scope, { closeAttendanceMeeting(sessionId, true) }, { actionBusy = it }, { actionError = it }) { reloadTick++ }
                }) { Text("Finalize") }
            },
            dismissButton = { TextButton(onClick = { finalizeConfirmOpen = false }) { Text("Cancel") } },
        )
    }

    correctionFor?.let { target ->
        CorrectionDialog(
            entry = target,
            onDismiss = { correctionFor = null },
            onCorrected = { correctionFor = null; reloadTick++ },
            sessionId = sessionId,
        )
    }
}

private enum class StatTint { Good, Fair, Risk, Neutral }

@Composable
private fun StatTile(label: String, value: String, palette: id.starstask.mobile.ui.theme.MockPalette, tint: StatTint = StatTint.Neutral, modifier: Modifier = Modifier) {
    val (bg, fg) = when (tint) {
        StatTint.Good -> palette.goodBg to palette.goodFg
        StatTint.Fair -> palette.fairBg to palette.fairFg
        StatTint.Risk -> palette.riskBg to palette.riskFg
        StatTint.Neutral -> palette.chip to palette.ink
    }
    Column(
        modifier = modifier
            .clip(RoundedCornerShape(16.dp))
            .background(bg)
            .padding(horizontal = 8.dp, vertical = 10.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(2.dp),
    ) {
        Text(value, color = fg, fontSize = 20.sp, fontWeight = FontWeight.Bold, lineHeight = 22.sp)
        Text(label, color = palette.muted, fontSize = 10.sp)
    }
}

@Composable
private fun SectionTitle(text: String, palette: id.starstask.mobile.ui.theme.MockPalette) {
    Text(
        text,
        color = palette.ink,
        fontSize = 16.sp,
        fontWeight = FontWeight.SemiBold,
        modifier = Modifier.padding(start = 2.dp),
    )
}

@Composable
private fun DetailCard(palette: id.starstask.mobile.ui.theme.MockPalette, content: @Composable () -> Unit) {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(18.dp))
            .background(palette.card)
            .border(1.dp, palette.cardBorder, RoundedCornerShape(18.dp))
            .padding(14.dp),
    ) {
        content()
    }
}

@Composable
private fun RosterRow(
    entry: MeetingRosterEntry,
    canCorrect: Boolean,
    palette: id.starstask.mobile.ui.theme.MockPalette,
    onCorrect: () -> Unit,
) {
    DetailCard(palette) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(3.dp)) {
                Text(entry.fullName, color = palette.ink, fontSize = 14.sp, fontWeight = FontWeight.SemiBold, maxLines = 1, overflow = TextOverflow.Ellipsis)
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    StatusPill(entry.status, palette)
                    if (!entry.eligible) {
                        Text("Joined after the meeting", color = palette.muted, fontSize = 11.sp)
                    }
                    entry.method?.let {
                        Text("· ${it.replaceFirstChar { c -> c.uppercase() }}", color = palette.muted, fontSize = 11.sp)
                    }
                }
            }
            if (canCorrect) {
                Text(
                    "Correct",
                    color = palette.accent,
                    fontSize = 13.sp,
                    fontWeight = FontWeight.SemiBold,
                    modifier = Modifier
                        .clip(RoundedCornerShape(999.dp))
                        .clickable(onClick = onCorrect)
                        .padding(horizontal = 10.dp, vertical = 6.dp),
                )
            }
        }
    }
}

@Composable
private fun StatusPill(status: String, palette: id.starstask.mobile.ui.theme.MockPalette) {
    val (label, bg, fg) = when (status) {
        "present" -> Triple("Present", palette.goodBg, palette.goodFg)
        "late" -> Triple("Late", palette.fairBg, palette.fairFg)
        "excused" -> Triple("Excused", palette.accentSofter, palette.accent)
        "sick" -> Triple("Sick", palette.accentSofter, palette.accent)
        "absent" -> Triple("Absent", palette.riskBg, palette.riskFg)
        "not_recorded" -> Triple("Not recorded", palette.chip, palette.muted)
        else -> Triple("N/A", palette.chip, palette.muted)
    }
    Box(
        modifier = Modifier
            .clip(RoundedCornerShape(999.dp))
            .background(bg)
            .padding(horizontal = 10.dp, vertical = 2.dp),
    ) {
        Text(label, color = fg, fontSize = 11.sp, fontWeight = FontWeight.SemiBold)
    }
}

private fun runAction(
    scope: kotlinx.coroutines.CoroutineScope,
    action: suspend () -> Unit,
    setBusy: (Boolean) -> Unit,
    setError: (String?) -> Unit,
    onDone: () -> Unit,
) {
    scope.launch {
        setBusy(true)
        setError(null)
        runCatching { action() }
            .onFailure { setError("Could not update the meeting.") }
        setBusy(false)
        onDone()
    }
}

@Composable
private fun ActionChip(
    label: String,
    enabled: Boolean,
    palette: id.starstask.mobile.ui.theme.MockPalette,
    accent: Boolean,
    onClick: () -> Unit,
) {
    Box(
        modifier = Modifier
            .clip(RoundedCornerShape(999.dp))
            .background(if (accent) palette.accent else palette.chip)
            .clickable(enabled = enabled, onClick = onClick)
            .heightIn(min = 38.dp)
            .padding(horizontal = 16.dp, vertical = 9.dp),
    ) {
        Text(
            label,
            color = if (accent) androidx.compose.ui.graphics.Color.White else palette.ink,
            fontSize = 13.sp,
            fontWeight = FontWeight.SemiBold,
        )
    }
}

@Composable
private fun CorrectionDialog(
    entry: MeetingRosterEntry,
    sessionId: String,
    onDismiss: () -> Unit,
    onCorrected: () -> Unit,
) {
    var status by remember { mutableStateOf(if (entry.status in setOf("present", "late", "excused", "sick", "absent")) entry.status else "present") }
    var reason by remember { mutableStateOf("") }
    var physicallyVerified by remember { mutableStateOf(false) }
    var menuOpen by remember { mutableStateOf(false) }
    var busy by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()
    val palette = mockColors()

    val statuses = listOf("present", "late", "excused", "sick", "absent")
    val valid = reason.trim().length in 3..500 && (status != "present" || physicallyVerified)

    AlertDialog(
        onDismissRequest = { if (!busy) onDismiss() },
        title = { Text("Correct attendance") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Text("${entry.fullName}", color = palette.ink, fontSize = 14.sp, fontWeight = FontWeight.SemiBold)
                Text("Current status: ${formatAttendanceStatusLabel(entry.status)}", color = palette.muted, fontSize = 12.sp)
                if (error != null) WebAlert(message = error!!)

                Box {
                    OutlinedButton(onClick = { menuOpen = true }, modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(14.dp)) {
                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            Text("Mark as: ${formatAttendanceStatusLabel(status)}", color = palette.ink, fontWeight = FontWeight.Medium)
                            Icon(Lucide.ChevronDown, contentDescription = null, tint = palette.muted, modifier = Modifier.size(16.dp))
                        }
                    }
                    DropdownMenu(expanded = menuOpen, onDismissRequest = { menuOpen = false }) {
                        statuses.forEach { option ->
                            DropdownMenuItem(
                                text = { Text(formatAttendanceStatusLabel(option)) },
                                onClick = { status = option; menuOpen = false },
                            )
                        }
                    }
                }

                OutlinedTextField(
                    value = reason,
                    onValueChange = { reason = it },
                    label = { Text("Reason (3–500 characters)") },
                    minLines = 2,
                    singleLine = false,
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(14.dp),
                )

                if (status == "present") {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        androidx.compose.material3.Checkbox(
                            checked = physicallyVerified,
                            onCheckedChange = { physicallyVerified = it },
                        )
                        Text(
                            "I physically verified the student at the attendance location.",
                            color = palette.ink,
                            fontSize = 12.sp,
                            lineHeight = 17.sp,
                        )
                    }
                }
            }
        },
        confirmButton = {
            TextButton(
                enabled = valid && !busy,
                onClick = {
                    scope.launch {
                        busy = true
                        error = null
                        runCatching {
                            recordAttendanceCorrection(
                                sessionId = sessionId,
                                userId = entry.userId,
                                status = status,
                                reason = reason.trim(),
                                physicallyVerified = physicallyVerified,
                            )
                        }.onFailure {
                            error = "Could not save the correction."
                        }
                        busy = false
                        if (error == null) onCorrected()
                    }
                },
            ) { Text(if (busy) "Saving…" else "Save correction") }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Cancel") } },
    )
}
